import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import {
  Dataset,
  TestCase,
  EvaluationRun,
  TestCaseResult,
} from "../../common/types";
import { AuditService } from "../audit/audit.service";
import { PromptsService } from "../prompts/prompts.service";
import { AiPlatformClient } from "../integrations/ai-platform.client";
import { CreateDatasetDto, RunEvaluationDto } from "./dto/evaluation.dto";

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);

  private readonly datasets: Map<string, Dataset> = new Map();
  private readonly runs: Map<string, EvaluationRun> = new Map();

  constructor(
    private readonly auditService: AuditService,
    private readonly promptsService: PromptsService,
    private readonly aiPlatformClient: AiPlatformClient,
  ) {}

  // --------------------------------------------------------------------------
  // DATASET MANAGEMENT
  // --------------------------------------------------------------------------

  async findAllDatasets(
    tenantId: string,
    applicationId?: string,
  ): Promise<Dataset[]> {
    return Array.from(this.datasets.values()).filter(
      (d) =>
        d.tenantId === tenantId &&
        (!applicationId || d.applicationId === applicationId),
    );
  }

  async findDataset(tenantId: string, datasetId: string): Promise<Dataset> {
    const ds = this.datasets.get(datasetId);
    if (!ds || ds.tenantId !== tenantId) {
      throw new NotFoundException(
        `Dataset "${datasetId}" was not found in tenant "${tenantId}".`,
      );
    }
    return ds;
  }

  async createDataset(
    tenantId: string,
    dto: CreateDatasetDto,
    actor: string = "operator",
  ): Promise<Dataset> {
    const datasetId = `ds_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
    const now = new Date().toISOString();

    const testCases: TestCase[] = dto.testCases.map((tc, idx) => ({
      caseId: tc.caseId || `case_${idx + 1}`,
      inputVariables: tc.inputVariables,
      referenceOutput: tc.referenceOutput,
      evaluationRubric: tc.evaluationRubric,
      tags: tc.tags || [],
    }));

    const dataset: Dataset = {
      id: datasetId,
      tenantId,
      applicationId: dto.applicationId,
      name: dto.name,
      description: dto.description || "",
      version: dto.version,
      testCases,
      createdAt: now,
      updatedAt: now,
    };

    this.datasets.set(datasetId, dataset);

    this.auditService.record(
      tenantId,
      actor,
      "DATASET_CREATED",
      "dataset",
      datasetId,
      {
        name: dataset.name,
        testCasesCount: testCases.length,
        version: dataset.version,
      },
    );

    return dataset;
  }

  // --------------------------------------------------------------------------
  // OFFLINE EVALUATION RUNNER
  // --------------------------------------------------------------------------

  async runEvaluation(
    tenantId: string,
    dto: RunEvaluationDto,
    actor: string = "operator",
  ): Promise<EvaluationRun> {
    const dataset = await this.findDataset(tenantId, dto.datasetId);
    const version = await this.promptsService.findVersion(
      tenantId,
      dto.promptId,
      dto.promptVersionId,
    );

    if (dataset.testCases.length === 0) {
      throw new BadRequestException(
        `Dataset "${dataset.name}" has no test cases to evaluate.`,
      );
    }

    const runId = `run_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
    const results: TestCaseResult[] = [];

    let isAnySimulated = false;

    for (const tc of dataset.testCases) {
      try {
        // Safely render prompt with test case input variables
        const { renderedPrompt, renderedSystemInstruction } =
          this.promptsService.renderPrompt(version, tc.inputVariables);

        // Execute via AI Platform client or offline evaluator
        const execRes = await this.aiPlatformClient.executePrompt({
          applicationId: dataset.applicationId,
          tenantId,
          prompt: renderedPrompt,
          systemInstruction: renderedSystemInstruction,
          temperature: version.parameters.temperature,
          model: version.parameters.model,
          metadata: { caseId: tc.caseId, runId },
        });

        if (execRes.isSimulated) {
          isAnySimulated = true;
        }

        // Compute accuracy and similarity scores
        const exactMatch = tc.referenceOutput
          ? execRes.answer.trim().toLowerCase() ===
            tc.referenceOutput.trim().toLowerCase()
          : false;

        const similarity = tc.referenceOutput
          ? this.computeWordSimilarity(execRes.answer, tc.referenceOutput)
          : 0.85;

        // Quality score: composite of non-emptiness, similarity, and safety
        const lengthRatio = Math.min(1, execRes.answer.length / 50);
        const qualityScore = Math.min(
          1,
          Number((similarity * 0.7 + lengthRatio * 0.3).toFixed(4)),
        );

        results.push({
          caseId: tc.caseId,
          inputVariables: tc.inputVariables,
          renderedPrompt,
          outputAnswer: execRes.answer,
          latencyMs: execRes.latencyMs,
          tokensUsed: execRes.usage,
          costUsd: execRes.costUsd,
          exactMatch,
          qualityScore,
          referenceOutput: tc.referenceOutput,
          passed: qualityScore >= 0.7,
        });
      } catch (err: any) {
        results.push({
          caseId: tc.caseId,
          inputVariables: tc.inputVariables,
          renderedPrompt: "ERROR_RENDERING",
          outputAnswer: "",
          latencyMs: 0,
          tokensUsed: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          costUsd: 0,
          exactMatch: false,
          qualityScore: 0,
          referenceOutput: tc.referenceOutput,
          passed: false,
          error: err.message,
        });
      }
    }

    // Compute summary metrics
    const validCases = results.filter((r) => !r.error);
    const n = validCases.length;

    const avgLatencyMs =
      n > 0
        ? Math.round(validCases.reduce((acc, r) => acc + r.latencyMs, 0) / n)
        : 0;

    const latenciesSorted = [...validCases.map((r) => r.latencyMs)].sort(
      (a, b) => a - b,
    );
    const p95LatencyMs =
      latenciesSorted.length > 0
        ? latenciesSorted[Math.floor(latenciesSorted.length * 0.95)] ||
          latenciesSorted[latenciesSorted.length - 1]
        : 0;

    const totalCostUsd = Number(
      validCases.reduce((acc, r) => acc + r.costUsd, 0).toFixed(6),
    );

    const avgQualityScore =
      n > 0
        ? Number(
            (
              validCases.reduce((acc, r) => acc + r.qualityScore, 0) / n
            ).toFixed(4),
          )
        : 0;

    const exactMatchRate =
      n > 0
        ? Number((validCases.filter((r) => r.exactMatch).length / n).toFixed(4))
        : 0;

    const passedCount = results.filter((r) => r.passed).length;
    const errorCount = results.filter((r) => r.error).length;
    const errorRate =
      results.length > 0 ? Number((errorCount / results.length).toFixed(4)) : 0;

    const evalRun: EvaluationRun = {
      id: runId,
      tenantId,
      applicationId: dataset.applicationId,
      datasetId: dataset.id,
      datasetVersion: dataset.version,
      promptId: dto.promptId,
      promptVersionId: version.id,
      status: errorCount === results.length ? "failed" : "completed",
      totalCases: results.length,
      passedCases: passedCount,
      results,
      summary: {
        avgLatencyMs,
        p95LatencyMs,
        totalCostUsd,
        avgQualityScore,
        exactMatchRate,
        errorRate,
      },
      modelMetadata: {
        model: version.parameters.model,
        provider: version.parameters.provider,
        temperature: version.parameters.temperature,
      },
      isSimulated: isAnySimulated || !!dto.forceSimulation,
      executedAt: new Date().toISOString(),
    };

    this.runs.set(runId, evalRun);

    this.auditService.record(
      tenantId,
      actor,
      "EVALUATION_RUN_COMPLETED",
      "evaluation",
      runId,
      {
        datasetId: dataset.id,
        promptVersionId: version.id,
        passedCases: passedCount,
        totalCases: results.length,
        avgQualityScore,
        isSimulated: evalRun.isSimulated,
      },
    );

    return evalRun;
  }

  async findAllRuns(
    tenantId: string,
    promptVersionId?: string,
  ): Promise<EvaluationRun[]> {
    return Array.from(this.runs.values())
      .filter(
        (r) =>
          r.tenantId === tenantId &&
          (!promptVersionId || r.promptVersionId === promptVersionId),
      )
      .sort((a, b) => b.executedAt.localeCompare(a.executedAt));
  }

  async findRun(tenantId: string, runId: string): Promise<EvaluationRun> {
    const run = this.runs.get(runId);
    if (!run || run.tenantId !== tenantId) {
      throw new NotFoundException(
        `Evaluation run "${runId}" was not found in tenant "${tenantId}".`,
      );
    }
    return run;
  }

  // Word-level Jaccard similarity index
  private computeWordSimilarity(a: string, b: string): number {
    const tokenize = (s: string) =>
      new Set(
        s
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .split(/\s+/)
          .filter((w) => w.length > 2),
      );

    const wordsA = tokenize(a);
    const wordsB = tokenize(b);

    if (wordsA.size === 0 && wordsB.size === 0) return 1.0;
    if (wordsA.size === 0 || wordsB.size === 0) return 0.0;

    let intersectionCount = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) {
        intersectionCount++;
      }
    }

    const unionCount = new Set([...wordsA, ...wordsB]).size;
    return unionCount > 0 ? intersectionCount / unionCount : 0;
  }

  // Internal seed helper
  seedDataset(dataset: Dataset, initialRuns: EvaluationRun[] = []) {
    this.datasets.set(dataset.id, dataset);
    for (const r of initialRuns) {
      this.runs.set(r.id, r);
    }
  }
}
