export type LifecycleState = 'draft' | 'candidate' | 'approved' | 'active' | 'archived';

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'rolled_back';

export type ReleaseGateStatus = 'PASS' | 'WARN' | 'FAIL';

export type ReleaseStatus =
  | 'draft'
  | 'evaluating'
  | 'ready_for_approval'
  | 'approved'
  | 'partially_rolled_out'
  | 'active'
  | 'rolled_back';

export type UserRole = 'viewer' | 'editor' | 'approver' | 'admin';

export interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  required: boolean;
  defaultValue?: string;
  description?: string;
  validationRegex?: string;
}

export interface ModelParameters {
  model: string;
  provider: string;
  temperature: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
}

export interface PromptVersion {
  id: string;
  promptId: string;
  version: string;
  template: string;
  systemInstruction?: string;
  variables: PromptVariable[];
  parameters: ModelParameters;
  lifecycleState: LifecycleState;
  author: string;
  changelog: string;
  checksum: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface Prompt {
  id: string;
  tenantId: string;
  applicationId: string;
  name: string;
  description: string;
  tags: string[];
  activeVersionId?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  versions?: PromptVersion[];
}

export interface TrafficSplitVariant {
  versionId: string;
  variantName: string;
  percentage: number;
}

export interface ExperimentObjective {
  metric: 'latency_ms' | 'cost_usd' | 'quality_score' | 'exact_match_rate' | 'error_rate';
  direction: 'lower' | 'higher';
  targetDeltaPct?: number;
  targetThreshold?: number;
  description?: string;
}

export interface Experiment {
  id: string;
  tenantId: string;
  applicationId: string;
  promptId: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  controlVersionId: string;
  candidateVersionIds: string[];
  variants: TrafficSplitVariant[];
  objectives: ExperimentObjective[];
  seed: string;
  totalAssignments: number;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentAssignmentResult {
  experimentId: string;
  tenantId: string;
  applicationId: string;
  subjectId: string;
  hash: string;
  bucket: number;
  assignedVariant: string;
  assignedVersionId: string;
  assignedAt: string;
}

export interface MetricSummary {
  sampleSize: number;
  mean: number;
  variance: number;
  stdDev: number;
  stdError: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  sum: number;
}

export interface MetricComparison {
  metric: string;
  controlMean: number;
  candidateMean: number;
  absoluteDelta: number;
  percentageDelta: number;
  standardErrorDiff: number;
  confidenceInterval95: [number, number] | null;
  pValue: number | null;
  tOrZStatistic: number | null;
  isSignificant: boolean;
  hasSufficientSample: boolean;
  minimumSampleRequired: number;
  sampleSizeControl: number;
  sampleSizeCandidate: number;
  status: 'better' | 'worse' | 'neutral' | 'inconclusive';
}

export interface VariantAnalyticsSummary {
  variantName: string;
  versionId: string;
  sampleSize: number;
  metrics: {
    latencyMs: MetricSummary;
    costUsd: MetricSummary;
    qualityScore: MetricSummary;
    exactMatchRate: MetricSummary;
    errorRate: MetricSummary;
  };
}

export interface ExperimentAnalysis {
  experimentId: string;
  tenantId: string;
  status: ExperimentStatus;
  totalOutcomes: number;
  isOnlineTelemetry: boolean;
  hasSufficientSampleSize: boolean;
  minimumSampleSizeRequired: number;
  variants: Record<string, VariantAnalyticsSummary>;
  comparisons: Record<string, MetricComparison[]>;
  recommendation: 'promising' | 'inconclusive' | 'regressive' | 'ready_for_release';
  recommendationReason: string;
}

export interface TestCase {
  caseId: string;
  inputVariables: Record<string, any>;
  referenceOutput?: string;
  evaluationRubric?: string;
  tags?: string[];
}

export interface Dataset {
  id: string;
  tenantId: string;
  applicationId: string;
  name: string;
  description: string;
  version: string;
  testCases: TestCase[];
  createdAt: string;
  updatedAt: string;
}

export interface TestCaseResult {
  caseId: string;
  inputVariables: Record<string, any>;
  renderedPrompt: string;
  outputAnswer: string;
  latencyMs: number;
  tokensUsed: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  costUsd: number;
  exactMatch: boolean;
  qualityScore: number;
  referenceOutput?: string;
  passed: boolean;
  error?: string;
}

export interface EvaluationRun {
  id: string;
  tenantId: string;
  applicationId: string;
  datasetId: string;
  datasetVersion: string;
  promptId: string;
  promptVersionId: string;
  status: 'running' | 'completed' | 'failed';
  totalCases: number;
  passedCases: number;
  results: TestCaseResult[];
  summary: {
    avgLatencyMs: number;
    p95LatencyMs: number;
    totalCostUsd: number;
    avgQualityScore: number;
    exactMatchRate: number;
    errorRate: number;
  };
  modelMetadata: {
    model: string;
    provider: string;
    temperature: number;
  };
  isSimulated: boolean;
  executedAt: string;
}

export interface ReleaseGateCheckResult {
  ruleId: string;
  ruleName: string;
  status: ReleaseGateStatus;
  actualValue: any;
  thresholdValue: any;
  details: string;
  evaluatedAt: string;
}

export interface ReleaseDecision {
  id: string;
  tenantId: string;
  applicationId: string;
  promptId: string;
  targetVersionId: string;
  currentActiveVersionId?: string;
  status: ReleaseStatus;
  rolloutPercentage: number;
  overallGateStatus: ReleaseGateStatus;
  gateChecks: ReleaseGateCheckResult[];
  requiresManualApproval: boolean;
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
  rollbackReason?: string;
  rolledBackAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  actor: string;
  action: string;
  resourceType: 'prompt' | 'version' | 'experiment' | 'release' | 'dataset' | 'evaluation';
  resourceId: string;
  details: Record<string, any>;
  timestamp: string;
}
