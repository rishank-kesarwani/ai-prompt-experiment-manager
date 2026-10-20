import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import * as crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import {
  Experiment,
  StoredOutcome,
  ExperimentAssignmentResult,
  ExperimentAnalysis,
  VariantAnalyticsSummary,
  MetricComparison,
  MetricSummary,
} from "../../common/types";
import { AuditService } from "../audit/audit.service";
import { PromptsService } from "../prompts/prompts.service";
import {
  CreateExperimentDto,
  RecordOutcomeDto,
  UpdateExperimentStatusDto,
} from "./dto/experiment.dto";

@Injectable()
export class ExperimentsService {
  private readonly logger = new Logger(ExperimentsService.name);

  private readonly experiments: Map<string, Experiment> = new Map();
  private readonly outcomes: StoredOutcome[] = [];

  constructor(
    private readonly auditService: AuditService,
    private readonly promptsService: PromptsService,
  ) {}

  // --------------------------------------------------------------------------
  // EXPERIMENT LIFECYCLE
  // --------------------------------------------------------------------------

  async findAll(
    tenantId: string,
    applicationId?: string,
  ): Promise<Experiment[]> {
    return Array.from(this.experiments.values()).filter(
      (e) =>
        e.tenantId === tenantId &&
        (!applicationId || e.applicationId === applicationId),
    );
  }

  async findOne(tenantId: string, experimentId: string): Promise<Experiment> {
    const exp = this.experiments.get(experimentId);
    if (!exp || exp.tenantId !== tenantId) {
      throw new NotFoundException(
        `Experiment "${experimentId}" was not found in tenant "${tenantId}".`,
      );
    }
    return exp;
  }

  async create(
    tenantId: string,
    dto: CreateExperimentDto,
    actor: string = "operator",
  ): Promise<Experiment> {
    // Validate prompt exists in this tenant
    const prompt = await this.promptsService.findOne(tenantId, dto.promptId);

    // Validate control version exists
    await this.promptsService.findVersion(
      tenantId,
      prompt.id,
      dto.controlVersionId,
    );

    // Validate all candidate versions exist
    for (const candId of dto.candidateVersionIds) {
      await this.promptsService.findVersion(tenantId, prompt.id, candId);
    }

    // Validate traffic split adds up to 100%
    const totalPercentage = dto.variants.reduce(
      (sum, v) => sum + v.percentage,
      0,
    );
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new BadRequestException(
        `Traffic split percentages must sum to 100%. Current sum: ${totalPercentage}%.`,
      );
    }

    const experimentId = `exp_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
    const now = new Date().toISOString();
    const seed = crypto.randomBytes(8).toString("hex");

    const experiment: Experiment = {
      id: experimentId,
      tenantId,
      applicationId: dto.applicationId,
      promptId: dto.promptId,
      name: dto.name,
      description: dto.description || "",
      status: "draft",
      controlVersionId: dto.controlVersionId,
      candidateVersionIds: dto.candidateVersionIds,
      variants: dto.variants.map((v) => ({
        versionId: v.versionId,
        variantName: v.variantName,
        percentage: v.percentage,
      })),
      objectives: dto.objectives || [
        { metric: "quality_score", direction: "higher" },
        { metric: "latency_ms", direction: "lower" },
      ],
      seed,
      totalAssignments: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.experiments.set(experimentId, experiment);

    this.auditService.record(
      tenantId,
      actor,
      "EXPERIMENT_CREATED",
      "experiment",
      experimentId,
      {
        name: experiment.name,
        promptId: experiment.promptId,
        variantsCount: experiment.variants.length,
      },
    );

    return experiment;
  }

  async updateStatus(
    tenantId: string,
    experimentId: string,
    dto: UpdateExperimentStatusDto,
    actor: string = "operator",
  ): Promise<Experiment> {
    const experiment = await this.findOne(tenantId, experimentId);
    const oldStatus = experiment.status;
    const now = new Date().toISOString();

    experiment.status = dto.status;
    experiment.updatedAt = now;

    if (dto.status === "running" && !experiment.startedAt) {
      experiment.startedAt = now;
    }
    if (dto.status === "completed" || dto.status === "rolled_back") {
      experiment.endedAt = now;
    }

    this.experiments.set(experimentId, experiment);

    this.auditService.record(
      tenantId,
      actor,
      "EXPERIMENT_STATUS_CHANGED",
      "experiment",
      experimentId,
      {
        fromStatus: oldStatus,
        toStatus: dto.status,
        notes: dto.notes || "",
      },
    );

    return experiment;
  }

  // --------------------------------------------------------------------------
  // DETERMINISTIC TRAFFIC ASSIGNMENT ENGINE
  // --------------------------------------------------------------------------

  previewAssignment(
    experiment: Experiment,
    subjectId: string,
  ): ExperimentAssignmentResult {
    return this.calculateAssignment(experiment, subjectId, false);
  }

  assign(
    experiment: Experiment,
    subjectId: string,
  ): ExperimentAssignmentResult {
    const result = this.calculateAssignment(experiment, subjectId, true);
    experiment.totalAssignments += 1;
    this.experiments.set(experiment.id, experiment);
    return result;
  }

  private calculateAssignment(
    experiment: Experiment,
    subjectId: string,
    _isLive: boolean,
  ): ExperimentAssignmentResult {
    if (!subjectId || subjectId.trim() === "") {
      throw new BadRequestException(
        "A non-empty subjectId is required for bucketing.",
      );
    }

    // SHA-256 of tenantId + experimentId + subjectId + seed
    const key = `${experiment.tenantId}:${experiment.id}:${subjectId.trim()}:${experiment.seed}`;
    const hash = crypto.createHash("sha256").update(key).digest("hex");

    // Extract first 8 hex characters -> unsigned 32-bit int -> bucket 0..99
    const hashPrefix = hash.substring(0, 8);
    const intVal = parseInt(hashPrefix, 16);
    const bucket = intVal % 100;

    // Cumulative walk through variants
    let cumulative = 0;
    let assignedVariant = experiment.variants[0].variantName;
    let assignedVersionId = experiment.variants[0].versionId;

    for (const v of experiment.variants) {
      cumulative += v.percentage;
      if (bucket < cumulative) {
        assignedVariant = v.variantName;
        assignedVersionId = v.versionId;
        break;
      }
    }

    return {
      experimentId: experiment.id,
      tenantId: experiment.tenantId,
      applicationId: experiment.applicationId,
      subjectId,
      hash: hashPrefix,
      bucket,
      assignedVariant,
      assignedVersionId,
      assignedAt: new Date().toISOString(),
    };
  }

  // --------------------------------------------------------------------------
  // OUTCOME INGESTION & AUDITABLE STORAGE
  // --------------------------------------------------------------------------

  async recordOutcome(
    tenantId: string,
    experimentId: string,
    dto: RecordOutcomeDto,
  ): Promise<StoredOutcome> {
    const experiment = await this.findOne(tenantId, experimentId);

    const outcome: StoredOutcome = {
      id: `out_${uuidv4().replace(/-/g, "").slice(0, 12)}`,
      experimentId: experiment.id,
      tenantId,
      subjectId: dto.subjectId,
      versionId: dto.versionId,
      variantName: dto.variantName,
      metrics: {
        latencyMs: dto.metrics.latencyMs,
        costUsd: dto.metrics.costUsd,
        exactMatch: dto.metrics.exactMatch,
        qualityScore: dto.metrics.qualityScore,
        error: dto.metrics.error,
      },
      metadata: dto.metadata,
      source: dto.source || "online_telemetry",
      timestamp: new Date().toISOString(),
    };

    this.outcomes.push(outcome);
    return outcome;
  }

  // --------------------------------------------------------------------------
  // STATISTICAL ANALYSIS & HYPOTHESIS TESTING
  // --------------------------------------------------------------------------

  async analyzeExperiment(
    tenantId: string,
    experimentId: string,
  ): Promise<ExperimentAnalysis> {
    const experiment = await this.findOne(tenantId, experimentId);
    const minSampleRequired = parseInt(
      process.env.MIN_SAMPLE_SIZE_FOR_SIGNIFICANCE || "30",
      10,
    );

    const relevantOutcomes = this.outcomes.filter(
      (o) => o.experimentId === experiment.id && o.tenantId === tenantId,
    );

    // Group by variant name
    const variantGroups: Record<string, StoredOutcome[]> = {};
    for (const v of experiment.variants) {
      variantGroups[v.variantName] = [];
    }
    for (const o of relevantOutcomes) {
      if (variantGroups[o.variantName]) {
        variantGroups[o.variantName].push(o);
      }
    }

    // Compute metric summaries for each variant
    const variantSummaries: Record<string, VariantAnalyticsSummary> = {};
    for (const [varName, items] of Object.entries(variantGroups)) {
      const vConfig = experiment.variants.find(
        (v) => v.variantName === varName,
      );
      variantSummaries[varName] = {
        variantName: varName,
        versionId: vConfig?.versionId || "",
        sampleSize: items.length,
        metrics: {
          latencyMs: this.computeSummary(
            items
              .map((i) => i.metrics.latencyMs)
              .filter((x): x is number => x !== undefined),
          ),
          costUsd: this.computeSummary(
            items
              .map((i) => i.metrics.costUsd)
              .filter((x): x is number => x !== undefined),
          ),
          qualityScore: this.computeSummary(
            items
              .map((i) => i.metrics.qualityScore)
              .filter((x): x is number => x !== undefined),
          ),
          exactMatchRate: this.computeSummary(
            items.map((i) => (i.metrics.exactMatch ? 1 : 0)),
          ),
          errorRate: this.computeSummary(
            items.map((i) => (i.metrics.error ? 1 : 0)),
          ),
        },
      };
    }

    // Determine control variant
    const controlVariant =
      experiment.variants.find(
        (v) => v.versionId === experiment.controlVersionId,
      )?.variantName || experiment.variants[0].variantName;

    const controlSummary = variantSummaries[controlVariant];

    // Compute comparisons for candidate variants
    const comparisons: Record<string, MetricComparison[]> = {};
    let allCandidatesSufficient =
      controlSummary && controlSummary.sampleSize >= minSampleRequired;
    let anyRegression = false;
    let anySignificantImprovement = false;

    const objectiveMetricMap: Record<
      string,
      keyof VariantAnalyticsSummary["metrics"]
    > = {
      quality_score: "qualityScore",
      latency_ms: "latencyMs",
      cost_usd: "costUsd",
      exact_match_rate: "exactMatchRate",
      error_rate: "errorRate",
    };

    const targetedMetricKeys = new Set(
      experiment.objectives.map(
        (o) => objectiveMetricMap[o.metric] || o.metric,
      ),
    );

    for (const v of experiment.variants) {
      if (v.variantName === controlVariant) continue;

      const candSummary = variantSummaries[v.variantName];
      if (!candSummary || candSummary.sampleSize < minSampleRequired) {
        allCandidatesSufficient = false;
      }

      const metricList: (keyof VariantAnalyticsSummary["metrics"])[] = [
        "qualityScore",
        "latencyMs",
        "costUsd",
        "exactMatchRate",
        "errorRate",
      ];

      comparisons[v.variantName] = [];

      for (const mKey of metricList) {
        const cMetric = controlSummary.metrics[mKey];
        const tMetric = candSummary.metrics[mKey];

        const comp = this.performHypothesisTest(
          mKey,
          cMetric,
          tMetric,
          minSampleRequired,
        );

        comparisons[v.variantName].push(comp);

        // Only enforce sufficiency on targeted objectives or metrics with data
        if (targetedMetricKeys.has(mKey) && !comp.hasSufficientSample) {
          allCandidatesSufficient = false;
        }
        if (comp.status === "worse" && comp.isSignificant) {
          anyRegression = true;
        }
        if (comp.status === "better" && comp.isSignificant) {
          anySignificantImprovement = true;
        }
      }
    }

    // Overall recommendation synthesis
    let recommendation: ExperimentAnalysis["recommendation"] = "inconclusive";
    let recommendationReason = "";

    if (!allCandidatesSufficient) {
      recommendation = "inconclusive";
      recommendationReason = `Insufficient sample size. Each cohort requires at least N=${minSampleRequired} samples before claiming statistical significance. Current control size: N=${controlSummary.sampleSize}.`;
    } else if (anyRegression) {
      recommendation = "regressive";
      recommendationReason =
        "Candidate exhibited statistically significant regression in one or more primary metrics (latency, cost, or quality). Release gate should fail.";
    } else if (anySignificantImprovement) {
      recommendation = "ready_for_release";
      recommendationReason =
        "Candidate achieved statistically significant improvement with zero regressive metrics. Safe for staged promotion.";
    } else {
      recommendation = "promising";
      recommendationReason =
        "Directionally positive results observed, but statistical significance (p < 0.05) has not yet been established. Continue running experiment.";
    }

    const hasOnline = relevantOutcomes.some(
      (o) => o.source === "online_telemetry",
    );

    return {
      experimentId: experiment.id,
      tenantId,
      status: experiment.status,
      totalOutcomes: relevantOutcomes.length,
      isOnlineTelemetry: hasOnline,
      hasSufficientSampleSize: allCandidatesSufficient,
      minimumSampleSizeRequired: minSampleRequired,
      variants: variantSummaries,
      comparisons,
      recommendation,
      recommendationReason,
    };
  }

  // --------------------------------------------------------------------------
  // STATISTICAL MATH HELPERS
  // --------------------------------------------------------------------------

  private computeSummary(values: number[]): MetricSummary {
    const n = values.length;
    if (n === 0) {
      return {
        sampleSize: 0,
        mean: 0,
        variance: 0,
        stdDev: 0,
        stdError: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        sum: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const mean = sum / n;

    let variance = 0;
    if (n > 1) {
      const sumSq = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0);
      variance = sumSq / (n - 1);
    }

    const stdDev = Math.sqrt(variance);
    const stdError = n > 0 ? stdDev / Math.sqrt(n) : 0;

    const p50 = sorted[Math.floor(n * 0.5)];
    const p95 = sorted[Math.floor(n * 0.95)] ?? sorted[n - 1];

    return {
      sampleSize: n,
      mean: Number(mean.toFixed(5)),
      variance: Number(variance.toFixed(6)),
      stdDev: Number(stdDev.toFixed(5)),
      stdError: Number(stdError.toFixed(5)),
      min: sorted[0],
      max: sorted[n - 1],
      p50,
      p95,
      sum: Number(sum.toFixed(5)),
    };
  }

  private performHypothesisTest(
    metricName: string,
    control: MetricSummary,
    candidate: MetricSummary,
    minSample: number,
  ): MetricComparison {
    const nA = control.sampleSize;
    const nB = candidate.sampleSize;
    const hasSufficient = nA >= minSample && nB >= minSample;

    const absDelta = candidate.mean - control.mean;
    const pctDelta = control.mean !== 0 ? (absDelta / control.mean) * 100 : 0;

    // Default inconclusive if sample too small
    if (!hasSufficient || nA === 0 || nB === 0) {
      return {
        metric: metricName,
        controlMean: control.mean,
        candidateMean: candidate.mean,
        absoluteDelta: Number(absDelta.toFixed(5)),
        percentageDelta: Number(pctDelta.toFixed(2)),
        standardErrorDiff: 0,
        confidenceInterval95: null,
        pValue: null,
        tOrZStatistic: null,
        isSignificant: false,
        hasSufficientSample: false,
        minimumSampleRequired: minSample,
        sampleSizeControl: nA,
        sampleSizeCandidate: nB,
        status: "inconclusive",
      };
    }

    // Welch's t-test standard error difference
    const seDiff = Math.sqrt(control.variance / nA + candidate.variance / nB);

    const tStat = seDiff > 0 ? absDelta / seDiff : 0;

    // Normal approximation for p-value (accurate for N >= 30 by Central Limit Theorem)
    const pValue = 2 * (1 - this.normalCdf(Math.abs(tStat)));

    const marginOfError = 1.96 * seDiff;
    const ci95: [number, number] = [
      Number((absDelta - marginOfError).toFixed(5)),
      Number((absDelta + marginOfError).toFixed(5)),
    ];

    const isSignificant = pValue < 0.05;

    // Determine if better or worse based on metric directionality
    // Lower is better: latency_ms, cost_usd, errorRate
    // Higher is better: qualityScore, exactMatchRate
    const lowerIsBetter = ["latencyMs", "costUsd", "errorRate"].includes(
      metricName,
    );

    let status: MetricComparison["status"] = "neutral";
    if (isSignificant) {
      if (lowerIsBetter) {
        status = absDelta < 0 ? "better" : "worse";
      } else {
        status = absDelta > 0 ? "better" : "worse";
      }
    } else {
      status = "inconclusive";
    }

    return {
      metric: metricName,
      controlMean: control.mean,
      candidateMean: candidate.mean,
      absoluteDelta: Number(absDelta.toFixed(5)),
      percentageDelta: Number(pctDelta.toFixed(2)),
      standardErrorDiff: Number(seDiff.toFixed(5)),
      confidenceInterval95: ci95,
      pValue: Number(pValue.toFixed(4)),
      tOrZStatistic: Number(tStat.toFixed(3)),
      isSignificant,
      hasSufficientSample: true,
      minimumSampleRequired: minSample,
      sampleSizeControl: nA,
      sampleSizeCandidate: nB,
      status,
    };
  }

  // Standard Normal Cumulative Distribution Function (error function approximation)
  private normalCdf(z: number): number {
    return 0.5 * (1 + this.erf(z / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Chebyshev fitting approximation
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x);

    const t = 1.0 / (1.0 + p * absX);
    const y =
      1.0 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
        t *
        Math.exp(-absX * absX);

    return sign * y;
  }

  // Internal seed helper
  seedExperiment(exp: Experiment, initialOutcomes: StoredOutcome[] = []) {
    this.experiments.set(exp.id, exp);
    this.outcomes.push(...initialOutcomes);
  }
}
