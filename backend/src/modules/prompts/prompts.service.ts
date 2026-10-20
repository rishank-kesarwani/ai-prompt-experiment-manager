import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import * as crypto from "crypto";
import * as Diff from "diff";
import { v4 as uuidv4 } from "uuid";
import {
  Prompt,
  PromptVersion,
  PromptVariable,
  LifecycleState,
} from "../../common/types";
import { AuditService } from "../audit/audit.service";
import {
  CreatePromptDto,
  CreateVersionDto,
  TransitionVersionDto,
} from "./dto/prompt.dto";

@Injectable()
export class PromptsService {
  private readonly logger = new Logger(PromptsService.name);

  // In-memory persistent data stores (tenant-scoped)
  private readonly prompts: Map<string, Prompt> = new Map();
  private readonly versions: Map<string, PromptVersion> = new Map();

  constructor(private readonly auditService: AuditService) {}

  // --------------------------------------------------------------------------
  // PROMPT MANAGEMENT
  // --------------------------------------------------------------------------

  async findAll(tenantId: string, applicationId?: string): Promise<Prompt[]> {
    return Array.from(this.prompts.values()).filter(
      (p) =>
        p.tenantId === tenantId &&
        (!applicationId || p.applicationId === applicationId),
    );
  }

  async findOne(
    tenantId: string,
    promptId: string,
  ): Promise<Prompt & { versions: PromptVersion[] }> {
    const prompt = this.prompts.get(promptId);
    if (!prompt || prompt.tenantId !== tenantId) {
      throw new NotFoundException(
        `Prompt with identifier "${promptId}" was not found in tenant "${tenantId}".`,
      );
    }

    const versions = this.getVersionsForPrompt(promptId);
    return {
      ...prompt,
      versions,
    };
  }

  async create(
    tenantId: string,
    dto: CreatePromptDto,
    actor: string = "operator",
  ): Promise<Prompt & { versions: PromptVersion[] }> {
    const promptId = `pmt_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
    const now = new Date().toISOString();

    const prompt: Prompt = {
      id: promptId,
      tenantId,
      applicationId: dto.applicationId,
      name: dto.name,
      description: dto.description || "",
      tags: dto.tags || [],
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };

    this.prompts.set(promptId, prompt);

    this.auditService.record(
      tenantId,
      actor,
      "PROMPT_CREATED",
      "prompt",
      promptId,
      { name: prompt.name, applicationId: prompt.applicationId },
    );

    let initialVer: PromptVersion | undefined;
    if (dto.initialVersion) {
      initialVer = await this.createVersion(
        tenantId,
        promptId,
        dto.initialVersion,
        actor,
      );
    }

    return {
      ...prompt,
      versions: initialVer ? [initialVer] : [],
    };
  }

  // --------------------------------------------------------------------------
  // VERSION MANAGEMENT
  // --------------------------------------------------------------------------

  getVersionsForPrompt(promptId: string): PromptVersion[] {
    return Array.from(this.versions.values())
      .filter((v) => v.promptId === promptId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findVersion(
    tenantId: string,
    promptId: string,
    versionId: string,
  ): Promise<PromptVersion> {
    const prompt = await this.findOne(tenantId, promptId);
    const ver = this.versions.get(versionId);

    if (!ver || ver.promptId !== prompt.id) {
      throw new NotFoundException(
        `Version "${versionId}" for prompt "${promptId}" was not found.`,
      );
    }

    return ver;
  }

  async createVersion(
    tenantId: string,
    promptId: string,
    dto: CreateVersionDto,
    actor: string = "operator",
  ): Promise<PromptVersion> {
    const prompt = await this.findOne(tenantId, promptId);

    // Check version uniqueness for this prompt
    const existingVersions = this.getVersionsForPrompt(promptId);
    if (existingVersions.some((v) => v.version === dto.version)) {
      throw new BadRequestException(
        `A version labeled "${dto.version}" already exists for prompt "${promptId}". Versions must be unique.`,
      );
    }

    // Validate template syntax and disallow dangerous code execution
    this.validateTemplateSyntax(dto.template, dto.systemInstruction);

    // Auto-discover variables in template and merge with provided schema
    const extractedVarNames = this.extractVariableNames(
      dto.template + " " + (dto.systemInstruction || ""),
    );
    const mergedVariables = this.resolveVariables(
      extractedVarNames,
      dto.variables || [],
    );

    // Compute deterministic content checksum
    const checksum = this.calculateChecksum(
      dto.template,
      dto.systemInstruction || "",
      dto.parameters,
      mergedVariables,
    );

    const versionId = `ver_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
    const now = new Date().toISOString();

    const versionEntity: PromptVersion = {
      id: versionId,
      promptId,
      version: dto.version,
      template: dto.template,
      systemInstruction: dto.systemInstruction,
      variables: mergedVariables,
      parameters: {
        model: dto.parameters.model,
        provider: dto.parameters.provider,
        temperature: dto.parameters.temperature,
        maxTokens: dto.parameters.maxTokens,
        topP: dto.parameters.topP,
        stopSequences: dto.parameters.stopSequences || [],
      },
      lifecycleState: "draft",
      author: dto.author || actor,
      changelog: dto.changelog,
      checksum,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };

    this.versions.set(versionId, versionEntity);

    // Update prompt updatedAt and revision
    prompt.updatedAt = now;
    prompt.revision += 1;
    this.prompts.set(promptId, prompt);

    this.auditService.record(
      tenantId,
      actor,
      "VERSION_COMMITTED",
      "version",
      versionId,
      {
        promptId,
        version: versionEntity.version,
        checksum,
        variablesCount: mergedVariables.length,
      },
    );

    return versionEntity;
  }

  // --------------------------------------------------------------------------
  // LIFECYCLE TRANSITIONS
  // --------------------------------------------------------------------------

  async transitionState(
    tenantId: string,
    promptId: string,
    versionId: string,
    dto: TransitionVersionDto,
    actor: { userId: string; role: string; name: string },
  ): Promise<PromptVersion> {
    const prompt = await this.findOne(tenantId, promptId);
    const version = await this.findVersion(tenantId, promptId, versionId);

    // Optimistic Concurrency Control Check
    if (
      dto.expectedRevision !== undefined &&
      version.revision !== dto.expectedRevision
    ) {
      throw new ConflictException(
        `Optimistic Concurrency Conflict: Version "${version.version}" was modified concurrently (expected revision ${dto.expectedRevision}, found ${version.revision}). Refresh and retry.`,
      );
    }

    const currentState = version.lifecycleState;
    const targetState = dto.targetState;

    if (currentState === targetState) {
      return version;
    }

    // Role Enforcement for Approvals and Activations
    if (targetState === "approved" || targetState === "active") {
      if (actor.role !== "approver" && actor.role !== "admin") {
        throw new ForbiddenException(
          `Unauthorized: Transitioning to "${targetState}" requires role "approver" or "admin". Current role: "${actor.role}".`,
        );
      }
    }

    // Valid Transition Graph
    const validTransitions: Record<LifecycleState, LifecycleState[]> = {
      draft: ["candidate", "archived"],
      candidate: ["draft", "approved", "archived"],
      approved: ["candidate", "active", "archived"],
      active: ["archived"], // Direct rollback switches active pointer
      archived: ["draft"],
    };

    const allowed = validTransitions[currentState] || [];
    if (!allowed.includes(targetState)) {
      throw new BadRequestException(
        `Invalid lifecycle transition from "${currentState}" to "${targetState}". Allowed transitions: [${allowed.join(
          ", ",
        )}].`,
      );
    }

    const now = new Date().toISOString();
    version.lifecycleState = targetState;
    version.updatedAt = now;
    version.revision += 1;

    if (targetState === "approved") {
      version.approvedBy = `${actor.name} (${actor.userId})`;
      version.approvedAt = now;
    }

    if (targetState === "active") {
      // Demote previous active version if any
      if (prompt.activeVersionId && prompt.activeVersionId !== version.id) {
        const prevActive = this.versions.get(prompt.activeVersionId);
        if (prevActive) {
          prevActive.lifecycleState = "approved";
          prevActive.updatedAt = now;
          prevActive.revision += 1;
          this.versions.set(prevActive.id, prevActive);
        }
      }

      prompt.activeVersionId = version.id;
      prompt.updatedAt = now;
      prompt.revision += 1;
      this.prompts.set(promptId, prompt);
    }

    this.versions.set(versionId, version);

    this.auditService.record(
      tenantId,
      actor.userId,
      "LIFECYCLE_TRANSITION",
      "version",
      versionId,
      {
        promptId,
        fromState: currentState,
        toState: targetState,
        notes: dto.notes || "",
        versionNumber: version.version,
      },
    );

    return version;
  }

  // --------------------------------------------------------------------------
  // TEMPLATE RENDERING & VARIABLE VALIDATION
  // --------------------------------------------------------------------------

  renderPrompt(
    version: PromptVersion,
    inputVariables: Record<string, any>,
  ): { renderedPrompt: string; renderedSystemInstruction?: string } {
    const provided = inputVariables || {};

    // Validate required variables
    for (const v of version.variables) {
      if (
        v.required &&
        (provided[v.name] === undefined ||
          provided[v.name] === null ||
          provided[v.name] === "")
      ) {
        if (v.defaultValue !== undefined && v.defaultValue !== "") {
          provided[v.name] = v.defaultValue;
        } else {
          throw new BadRequestException(
            `Missing required prompt variable "${v.name}" (${v.description || "no description"}).`,
          );
        }
      }

      // Regex validation if configured
      if (v.validationRegex && provided[v.name] !== undefined) {
        const reg = new RegExp(v.validationRegex);
        if (!reg.test(String(provided[v.name]))) {
          throw new BadRequestException(
            `Variable "${v.name}" with value "${provided[v.name]}" failed validation regex /${v.validationRegex}/.`,
          );
        }
      }
    }

    // Safe interpolation (replaces {{var}} with sanitized string representation)
    const interpolate = (tmpl: string): string => {
      return tmpl.replace(
        /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
        (_match, varName) => {
          if (provided[varName] !== undefined && provided[varName] !== null) {
            const val = provided[varName];
            return typeof val === "object" ? JSON.stringify(val) : String(val);
          }
          return "";
        },
      );
    };

    const renderedPrompt = interpolate(version.template);
    const renderedSystemInstruction = version.systemInstruction
      ? interpolate(version.systemInstruction)
      : undefined;

    return {
      renderedPrompt,
      renderedSystemInstruction,
    };
  }

  // --------------------------------------------------------------------------
  // DIFF COMPUTATION
  // --------------------------------------------------------------------------

  async computeDiff(
    tenantId: string,
    promptId: string,
    v1Id: string,
    v2Id: string,
  ): Promise<{
    version1: PromptVersion;
    version2: PromptVersion;
    unifiedDiff: string;
    lineChanges: Diff.Change[];
    parameterDiffs: Record<string, { v1: any; v2: any; changed: boolean }>;
    variableDiffs: {
      added: string[];
      removed: string[];
      modified: string[];
    };
  }> {
    const version1 = await this.findVersion(tenantId, promptId, v1Id);
    const version2 = await this.findVersion(tenantId, promptId, v2Id);

    const unifiedDiff = Diff.createTwoFilesPatch(
      `version-${version1.version}.txt`,
      `version-${version2.version}.txt`,
      version1.template,
      version2.template,
    );

    const lineChanges = Diff.diffLines(version1.template, version2.template);

    // Parameters comparison
    const parameterDiffs: Record<
      string,
      { v1: any; v2: any; changed: boolean }
    > = {
      model: {
        v1: version1.parameters.model,
        v2: version2.parameters.model,
        changed: version1.parameters.model !== version2.parameters.model,
      },
      temperature: {
        v1: version1.parameters.temperature,
        v2: version2.parameters.temperature,
        changed:
          version1.parameters.temperature !== version2.parameters.temperature,
      },
      maxTokens: {
        v1: version1.parameters.maxTokens,
        v2: version2.parameters.maxTokens,
        changed:
          version1.parameters.maxTokens !== version2.parameters.maxTokens,
      },
      systemInstruction: {
        v1: version1.systemInstruction || "",
        v2: version2.systemInstruction || "",
        changed:
          (version1.systemInstruction || "") !==
          (version2.systemInstruction || ""),
      },
    };

    // Variables comparison
    const v1Vars = new Set(version1.variables.map((v) => v.name));
    const v2Vars = new Set(version2.variables.map((v) => v.name));

    const added = [...v2Vars].filter((x) => !v1Vars.has(x));
    const removed = [...v1Vars].filter((x) => !v2Vars.has(x));
    const common = [...v1Vars].filter((x) => v2Vars.has(x));

    const modified: string[] = [];
    for (const name of common) {
      const var1 = version1.variables.find((v) => v.name === name);
      const var2 = version2.variables.find((v) => v.name === name);
      if (
        var1?.type !== var2?.type ||
        var1?.required !== var2?.required ||
        var1?.defaultValue !== var2?.defaultValue
      ) {
        modified.push(name);
      }
    }

    return {
      version1,
      version2,
      unifiedDiff,
      lineChanges,
      parameterDiffs,
      variableDiffs: { added, removed, modified },
    };
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS
  // --------------------------------------------------------------------------

  private validateTemplateSyntax(
    template: string,
    systemInstruction?: string,
  ): void {
    const combined = template + " " + (systemInstruction || "");

    // Check for dangerous code patterns
    const forbiddenPatterns = [
      /<script\b/i,
      /\beval\s*\(/i,
      /\bFunction\s*\(/i,
      /\bprocess\.env\b/i,
      /\brequire\s*\(/i,
      /\bimport\s*\(/i,
      /\bchild_process\b/i,
    ];

    for (const pat of forbiddenPatterns) {
      if (pat.test(combined)) {
        throw new BadRequestException(
          `Security violation: Prompt template contains forbidden or dangerous pattern (${pat.toString()}). Prompts must not execute arbitrary code.`,
        );
      }
    }

    // Check for unclosed braces e.g. {{foo without }}
    const openBraces = (combined.match(/\{\{/g) || []).length;
    const closeBraces = (combined.match(/\}\}/g) || []).length;
    if (openBraces !== closeBraces) {
      throw new BadRequestException(
        `Template syntax error: Mismatched Handlebars delimiters. Found ${openBraces} opening "{{" and ${closeBraces} closing "}}".`,
      );
    }
  }

  private extractVariableNames(content: string): string[] {
    const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    const vars = new Set<string>();
    let match;
    while ((match = regex.exec(content)) !== null) {
      vars.add(match[1]);
    }
    return Array.from(vars);
  }

  private resolveVariables(
    extractedNames: string[],
    provided: PromptVariable[],
  ): PromptVariable[] {
    const map = new Map<string, PromptVariable>();

    // Put provided variables first
    for (const p of provided) {
      map.set(p.name, p);
    }

    // Ensure any variable appearing in the template has a schema entry
    for (const name of extractedNames) {
      if (!map.has(name)) {
        map.set(name, {
          name,
          type: "string",
          required: true,
          description: `Auto-detected template variable {{${name}}}`,
        });
      }
    }

    return Array.from(map.values());
  }

  private calculateChecksum(
    template: string,
    systemInstruction: string,
    parameters: any,
    variables: PromptVariable[],
  ): string {
    const hash = crypto.createHash("sha256");
    hash.update(template || "");
    hash.update("||");
    hash.update(systemInstruction || "");
    hash.update("||");
    hash.update(JSON.stringify(parameters || {}));
    hash.update("||");
    hash.update(JSON.stringify(variables || []));
    return hash.digest("hex");
  }

  // Internal helper for seeding and cross-service lookups
  seedPrompt(prompt: Prompt, versions: PromptVersion[]) {
    this.prompts.set(prompt.id, prompt);
    for (const v of versions) {
      this.versions.set(v.id, v);
    }
  }
}
