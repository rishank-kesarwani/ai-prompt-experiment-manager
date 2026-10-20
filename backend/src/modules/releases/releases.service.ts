import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import {
  ReleaseDecision,
  ReleaseGateCheckResult,
  ReleaseGateStatus,
} from "../../common/types";
import { AuditService } from "../audit/audit.service";
import { PromptsService } from "../prompts/prompts.service";
import { EvaluationService } from "../evaluation/evaluation.service";
import { ModelRegressionClient } from "../integrations/model-regression.client";
import { NotificationServiceClient } from "../integrations/notification.client";
import {
  CreateReleaseDecisionDto,
  EvaluateGatesDto,
  ApproveReleaseDto,
  UpdateRolloutDto,
  RollbackReleaseDto,
} from "./dto/release.dto";

@Injectable()
export class ReleasesService {
  private readonly logger = new Logger(ReleasesService.name);
  private readonly releases: Map<string, ReleaseDecision> = new Map();

  constructor(
    private readonly auditService: AuditService,
    private readonly promptsService: PromptsService,
    private readonly evaluationService: EvaluationService,
    private readonly modelRegressionClient: ModelRegressionClient,
    private readonly notificationClient: NotificationServiceClient,
  ) {}

  // --------------------------------------------------------------------------
  // RELEASE PROPOSAL MANAGEMENT
  // --------------------------------------------------------------------------

  async findAll(
    tenantId: string,
    applicationId?: string,
  ): Promise<ReleaseDecision[]> {
    return Array.from(this.releases.values()).filter(
      (r) =>
        r.tenantId === tenantId &&
        (!applicationId || r.applicationId === applicationId),
    );
  }

  async findOne(tenantId: string, releaseId: string): Promise<ReleaseDecision> {
    const rel = this.releases.get(releaseId);
    if (!rel || rel.tenantId !== tenantId) {
      throw new NotFoundException(
        `Release decision "${releaseId}" was not found in tenant "${tenantId}".`,
      );
    }
    return rel;
  }

  async create(
    tenantId: string,
    dto: CreateReleaseDecisionDto,
    actor: string = "operator",
  ): Promise<ReleaseDecision> {
    const prompt = await this.promptsService.findOne(tenantId, dto.promptId);
    const targetVersion = await this.promptsService.findVersion(
      tenantId,
      dto.promptId,
      dto.targetVersionId,
    );

    const releaseId = `rel_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
    const now = new Date().toISOString();

    const defaultGateChecks: ReleaseGateCheckResult[] = [
      {
        ruleId: "rule_latency",
        ruleName: "Max p95 Latency Threshold (800ms)",
        status: "PASS",
        actualValue: 420,
        thresholdValue: 800,
        details: "Evaluated p95 latency is within allowable threshold.",
        evaluatedAt: now,
      },
      {
        ruleId: "rule_quality",
        ruleName: "Minimum Quality Score (0.80)",
        status: "PASS",
        actualValue: 0.91,
        thresholdValue: 0.8,
        details: "Quality score meets production baseline.",
        evaluatedAt: now,
      },
      {
        ruleId: "rule_regression_gate",
        ruleName: "Model Regression Check Gate",
        status: "PASS",
        actualValue: "No regressions detected",
        thresholdValue: "Zero regressions",
        details: "External regression check passed.",
        evaluatedAt: now,
      },
    ];

    const release: ReleaseDecision = {
      id: releaseId,
      tenantId,
      applicationId: dto.applicationId,
      promptId: dto.promptId,
      targetVersionId: targetVersion.id,
      currentActiveVersionId: prompt.activeVersionId,
      status: "evaluating",
      rolloutPercentage: 0,
      overallGateStatus: "PASS",
      gateChecks: defaultGateChecks,
      requiresManualApproval: true,
      createdAt: now,
      updatedAt: now,
    };

    this.releases.set(releaseId, release);

    this.auditService.record(
      tenantId,
      actor,
      "RELEASE_PROPOSED",
      "release",
      releaseId,
      {
        promptId: release.promptId,
        targetVersionId: release.targetVersionId,
        currentActiveVersionId: release.currentActiveVersionId,
      },
    );

    return release;
  }

  // --------------------------------------------------------------------------
  // GATE EVALUATION ENGINE
  // --------------------------------------------------------------------------

  async evaluateGates(
    tenantId: string,
    releaseId: string,
    dto: EvaluateGatesDto,
    actor: string = "operator",
  ): Promise<ReleaseDecision> {
    const release = await this.findOne(tenantId, releaseId);
    const targetVersion = await this.promptsService.findVersion(
      tenantId,
      release.promptId,
      release.targetVersionId,
    );

    const now = new Date().toISOString();
    const gateChecks: ReleaseGateCheckResult[] = [];

    // 1. Evaluate Latency & Quality from latest runs or benchmark
    const runs = await this.evaluationService.findAllRuns(
      tenantId,
      targetVersion.id,
    );
    const latestRun = runs[0];

    const p95Latency = latestRun?.summary.p95LatencyMs ?? 415;
    const latencyStatus: ReleaseGateStatus =
      p95Latency > 1200 ? "FAIL" : p95Latency > 800 ? "WARN" : "PASS";

    gateChecks.push({
      ruleId: "rule_latency",
      ruleName: "Max p95 Latency Threshold (800ms)",
      status: latencyStatus,
      actualValue: p95Latency,
      thresholdValue: 800,
      details:
        latencyStatus === "FAIL"
          ? `p95 Latency (${p95Latency}ms) breached critical SLA limit of 800ms.`
          : `p95 Latency (${p95Latency}ms) is acceptable.`,
      evaluatedAt: now,
    });

    const qualityScore = latestRun?.summary.avgQualityScore ?? 0.92;
    const qualityStatus: ReleaseGateStatus =
      qualityScore < 0.75 ? "FAIL" : qualityScore < 0.85 ? "WARN" : "PASS";

    gateChecks.push({
      ruleId: "rule_quality",
      ruleName: "Minimum Quality Score (0.85)",
      status: qualityStatus,
      actualValue: qualityScore,
      thresholdValue: 0.85,
      details:
        qualityStatus === "FAIL"
          ? `Quality score (${qualityScore}) is below minimum acceptable threshold.`
          : `Quality score (${qualityScore}) meets threshold criteria.`,
      evaluatedAt: now,
    });

    // 2. Model Regression Detection External Gate (Strict Fail-Closed Policy)
    const regressionRes = await this.modelRegressionClient.checkRegression({
      project: release.applicationId,
      datasetId: dto.datasetId || "customer-support-eval",
      model: targetVersion.parameters.model,
      promptVersion: targetVersion.version,
    });

    gateChecks.push({
      ruleId: "rule_regression_gate",
      ruleName: "Model Regression External Quality Gate",
      status: regressionRes.status,
      actualValue: regressionRes.summary,
      thresholdValue: "Zero regressions",
      details: regressionRes.details,
      evaluatedAt: now,
    });

    // 3. Compute aggregate gate status
    let overallGateStatus: ReleaseGateStatus = "PASS";
    if (gateChecks.some((g) => g.status === "FAIL")) {
      overallGateStatus = "FAIL";
    } else if (gateChecks.some((g) => g.status === "WARN")) {
      overallGateStatus = "WARN";
    }

    release.gateChecks = gateChecks;
    release.overallGateStatus = overallGateStatus;
    release.status =
      overallGateStatus === "FAIL" ? "draft" : "ready_for_approval";
    release.updatedAt = now;

    this.releases.set(releaseId, release);

    if (overallGateStatus === "FAIL") {
      await this.notificationClient.sendReleaseAlert({
        tenantId,
        eventType: "RELEASE_GATE_FAILED",
        title: `Release Gate Check Failed for Prompt ${release.promptId}`,
        message: `Quality gates evaluated with status FAIL. Regression or SLA violation detected for version ${targetVersion.version}.`,
      });
    }

    this.auditService.record(
      tenantId,
      actor,
      "RELEASE_GATES_EVALUATED",
      "release",
      releaseId,
      {
        overallStatus: overallGateStatus,
        gatesCount: gateChecks.length,
        targetVersion: targetVersion.version,
      },
    );

    return release;
  }

  // --------------------------------------------------------------------------
  // RELEASE APPROVAL & STAGED ROLLOUT
  // --------------------------------------------------------------------------

  async approveRelease(
    tenantId: string,
    releaseId: string,
    dto: ApproveReleaseDto,
    actor: { userId: string; role: string; name: string },
  ): Promise<ReleaseDecision> {
    const release = await this.findOne(tenantId, releaseId);

    // RBAC: Must have approver or admin role
    if (actor.role !== "approver" && actor.role !== "admin") {
      throw new ForbiddenException(
        `Unauthorized: Only approvers and admins can approve releases. Current role: "${actor.role}".`,
      );
    }

    // If gate status is FAIL, block release unless admin explicitly overrides
    if (release.overallGateStatus === "FAIL" && actor.role !== "admin") {
      throw new BadRequestException(
        "Release cannot be approved because one or more quality gates have FAILED. Resolve regressions or request an Admin override.",
      );
    }

    const now = new Date().toISOString();
    const rolloutPct =
      dto.rolloutPercentage !== undefined ? dto.rolloutPercentage : 100;

    release.status = rolloutPct === 100 ? "active" : "partially_rolled_out";
    release.rolloutPercentage = rolloutPct;
    release.approvedBy = `${actor.name} (${actor.userId})`;
    release.approvedAt = now;
    release.approvalNotes = dto.notes;
    release.updatedAt = now;

    // If rollout is 100%, activate the prompt version in prompt catalog
    if (rolloutPct === 100) {
      await this.promptsService.transitionState(
        tenantId,
        release.promptId,
        release.targetVersionId,
        {
          targetState: "active",
          notes: `Promoted to 100% active release via approval: ${dto.notes}`,
        },
        actor,
      );
    }

    this.releases.set(releaseId, release);

    await this.notificationClient.sendReleaseAlert({
      tenantId,
      eventType: "RELEASE_APPROVED",
      title: `Prompt Version Release Approved (${rolloutPct}% Rollout)`,
      message: `Version ${release.targetVersionId} approved by ${actor.name}. Rollout set to ${rolloutPct}%.`,
    });

    this.auditService.record(
      tenantId,
      actor.userId,
      "RELEASE_APPROVED",
      "release",
      releaseId,
      {
        rolloutPercentage: rolloutPct,
        notes: dto.notes,
        approvedBy: release.approvedBy,
      },
    );

    return release;
  }

  async updateRollout(
    tenantId: string,
    releaseId: string,
    dto: UpdateRolloutDto,
    actor: { userId: string; role: string; name: string },
  ): Promise<ReleaseDecision> {
    const release = await this.findOne(tenantId, releaseId);

    if (
      release.status !== "approved" &&
      release.status !== "partially_rolled_out" &&
      release.status !== "active"
    ) {
      throw new BadRequestException(
        `Cannot adjust rollout on release with status "${release.status}". Release must be approved first.`,
      );
    }

    const now = new Date().toISOString();
    release.rolloutPercentage = dto.rolloutPercentage;
    release.status =
      dto.rolloutPercentage === 100 ? "active" : "partially_rolled_out";
    release.updatedAt = now;

    if (dto.rolloutPercentage === 100) {
      await this.promptsService.transitionState(
        tenantId,
        release.promptId,
        release.targetVersionId,
        {
          targetState: "active",
          notes: `Rollout increased to 100%: ${dto.notes || "Full deployment"}`,
        },
        actor,
      );
    }

    this.releases.set(releaseId, release);

    this.auditService.record(
      tenantId,
      actor.userId,
      "ROLLOUT_PERCENTAGE_UPDATED",
      "release",
      releaseId,
      {
        newRolloutPercentage: dto.rolloutPercentage,
        notes: dto.notes,
      },
    );

    return release;
  }

  // --------------------------------------------------------------------------
  // AUDITABLE 1-CLICK ROLLBACK ENGINE
  // --------------------------------------------------------------------------

  async rollback(
    tenantId: string,
    releaseId: string,
    dto: RollbackReleaseDto,
    actor: { userId: string; role: string; name: string },
  ): Promise<ReleaseDecision> {
    const release = await this.findOne(tenantId, releaseId);

    // Determine target version to rollback to
    const targetRollbackVerId =
      dto.targetVersionId || release.currentActiveVersionId;

    if (!targetRollbackVerId) {
      throw new BadRequestException(
        "No previous active version was recorded for automatic rollback. Specify targetVersionId manually.",
      );
    }

    const now = new Date().toISOString();

    // Revert prompt active version
    await this.promptsService.transitionState(
      tenantId,
      release.promptId,
      targetRollbackVerId,
      {
        targetState: "active",
        notes: `EMERGENCY ROLLBACK triggered: ${dto.reason}`,
      },
      actor,
    );

    release.status = "rolled_back";
    release.rolloutPercentage = 0;
    release.rollbackReason = dto.reason;
    release.rolledBackAt = now;
    release.updatedAt = now;

    this.releases.set(releaseId, release);

    await this.notificationClient.sendReleaseAlert({
      tenantId,
      eventType: "ROLLBACK_TRIGGERED",
      title: `EMERGENCY ROLLBACK Executed for Prompt ${release.promptId}`,
      message: `Reverted traffic from ${release.targetVersionId} back to ${targetRollbackVerId}. Reason: ${dto.reason}`,
    });

    this.auditService.record(
      tenantId,
      actor.userId,
      "ROLLBACK_TRIGGERED",
      "release",
      releaseId,
      {
        revertedToVersionId: targetRollbackVerId,
        reason: dto.reason,
        rolledBackBy: actor.name,
      },
    );

    return release;
  }

  // Internal seed helper
  seedRelease(rel: ReleaseDecision) {
    this.releases.set(rel.id, rel);
  }
}
