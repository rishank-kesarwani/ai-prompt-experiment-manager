import {
  Prompt,
  PromptVersion,
  Experiment,
  ExperimentAssignmentResult,
  ExperimentAnalysis,
  Dataset,
  EvaluationRun,
  ReleaseDecision,
  AuditEvent,
  UserRole,
} from './types';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  statusCode: number;
  correlationId?: string;
  errors?: any;

  constructor(message: string, statusCode: number, correlationId?: string, errors?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.correlationId = correlationId;
    this.errors = errors;
  }
}

interface RequestOptions extends RequestInit {
  tenantId?: string;
  userRole?: UserRole;
  userId?: string;
}

// Global active tenant and role stored for client sessions
let currentTenantId =
  (typeof window !== 'undefined' && localStorage.getItem('pem_tenant_id')) ||
  process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ||
  'tenant-enterprise-default';

let currentUserRole: UserRole =
  (typeof window !== 'undefined' &&
    (localStorage.getItem('pem_user_role') as UserRole)) ||
  'approver';

export const setSessionTenant = (tenant: string) => {
  currentTenantId = tenant;
  if (typeof window !== 'undefined') {
    localStorage.setItem('pem_tenant_id', tenant);
  }
};

export const setSessionRole = (role: UserRole) => {
  currentUserRole = role;
  if (typeof window !== 'undefined') {
    localStorage.setItem('pem_user_role', role);
  }
};

export const getSessionTenant = () => currentTenantId;
export const getSessionRole = () => currentUserRole;

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  const correlationId = `req_${Math.random().toString(36).substring(2, 10)}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tenant-id': options.tenantId || currentTenantId,
    'x-user-role': options.userRole || currentUserRole,
    'x-user-id': options.userId || 'ops_lead_1',
    'x-correlation-id': correlationId,
    ...(options.headers as Record<string, string>),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = data?.message || `Request failed with status ${res.status}`;
      throw new ApiError(msg, res.status, correlationId, data?.errors);
    }

    return (data?.data !== undefined ? data.data : data) as T;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(
      err.message || 'Unable to connect to Prompt Experiment API.',
      503,
      correlationId,
    );
  }
}

// ----------------------------------------------------------------------------
// PROMPT MANAGEMENT
// ----------------------------------------------------------------------------

export async function fetchPrompts(applicationId?: string): Promise<Prompt[]> {
  const q = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : '';
  return request<Prompt[]>(`prompts${q}`);
}

export async function fetchPrompt(id: string): Promise<Prompt & { versions: PromptVersion[] }> {
  return request<Prompt & { versions: PromptVersion[] }>(`prompts/${id}`);
}

export async function createPrompt(dto: any): Promise<Prompt> {
  return request<Prompt>('prompts', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function createVersion(promptId: string, dto: any): Promise<PromptVersion> {
  return request<PromptVersion>(`prompts/${promptId}/versions`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function transitionVersionState(
  promptId: string,
  versionId: string,
  targetState: string,
  notes?: string,
  expectedRevision?: number,
): Promise<PromptVersion> {
  return request<PromptVersion>(`prompts/${promptId}/versions/${versionId}/transition`, {
    method: 'PATCH',
    body: JSON.stringify({ targetState, notes, expectedRevision }),
  });
}

export async function renderPromptTest(
  promptId: string,
  versionId: string,
  variables: Record<string, any>,
): Promise<{ renderedPrompt: string; renderedSystemInstruction?: string }> {
  return request<{ renderedPrompt: string; renderedSystemInstruction?: string }>(
    `prompts/${promptId}/versions/${versionId}/render`,
    {
      method: 'POST',
      body: JSON.stringify({ variables }),
    },
  );
}

export async function fetchPromptDiff(
  promptId: string,
  v1: string,
  v2: string,
): Promise<any> {
  return request<any>(`prompts/${promptId}/diff?v1=${v1}&v2=${v2}`);
}

// ----------------------------------------------------------------------------
// EXPERIMENTATION
// ----------------------------------------------------------------------------

export async function fetchExperiments(applicationId?: string): Promise<Experiment[]> {
  const q = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : '';
  return request<Experiment[]>(`experiments${q}`);
}

export async function fetchExperiment(id: string): Promise<Experiment> {
  return request<Experiment>(`experiments/${id}`);
}

export async function createExperiment(dto: any): Promise<Experiment> {
  return request<Experiment>('experiments', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function previewExperimentAssignment(
  experimentId: string,
  subjectId: string,
): Promise<ExperimentAssignmentResult> {
  return request<ExperimentAssignmentResult>(
    `experiments/${experimentId}/preview-assignment`,
    {
      method: 'POST',
      body: JSON.stringify({ subjectId }),
    },
  );
}

export async function fetchExperimentAnalysis(
  experimentId: string,
): Promise<ExperimentAnalysis> {
  return request<ExperimentAnalysis>(`experiments/${experimentId}/analysis`);
}

export async function updateExperimentStatus(
  experimentId: string,
  status: string,
  notes?: string,
): Promise<Experiment> {
  return request<Experiment>(`experiments/${experimentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  });
}

export async function recordOnlineOutcome(
  experimentId: string,
  dto: any,
): Promise<any> {
  return request<any>(`experiments/${experimentId}/outcomes`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

// ----------------------------------------------------------------------------
// OFFLINE EVALUATION
// ----------------------------------------------------------------------------

export async function fetchDatasets(applicationId?: string): Promise<Dataset[]> {
  const q = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : '';
  return request<Dataset[]>(`evaluations/datasets${q}`);
}

export async function fetchDataset(id: string): Promise<Dataset> {
  return request<Dataset>(`evaluations/datasets/${id}`);
}

export async function createDataset(dto: any): Promise<Dataset> {
  return request<Dataset>('evaluations/datasets', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function triggerEvaluationRun(dto: any): Promise<EvaluationRun> {
  return request<EvaluationRun>('evaluations/run', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function fetchEvaluationRuns(promptVersionId?: string): Promise<EvaluationRun[]> {
  const q = promptVersionId ? `?promptVersionId=${encodeURIComponent(promptVersionId)}` : '';
  return request<EvaluationRun[]>(`evaluations/runs${q}`);
}

export async function fetchEvaluationRun(id: string): Promise<EvaluationRun> {
  return request<EvaluationRun>(`evaluations/runs/${id}`);
}

// ----------------------------------------------------------------------------
// RELEASES & GATES
// ----------------------------------------------------------------------------

export async function fetchReleases(applicationId?: string): Promise<ReleaseDecision[]> {
  const q = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : '';
  return request<ReleaseDecision[]>(`releases${q}`);
}

export async function fetchRelease(id: string): Promise<ReleaseDecision> {
  return request<ReleaseDecision>(`releases/${id}`);
}

export async function createReleaseProposal(dto: any): Promise<ReleaseDecision> {
  return request<ReleaseDecision>('releases', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function evaluateReleaseGates(
  releaseId: string,
  dto: any = {},
): Promise<ReleaseDecision> {
  return request<ReleaseDecision>(`releases/${releaseId}/evaluate`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function approveReleaseProposal(
  releaseId: string,
  notes: string,
  rolloutPercentage: number = 100,
): Promise<ReleaseDecision> {
  return request<ReleaseDecision>(`releases/${releaseId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ notes, rolloutPercentage }),
  });
}

export async function updateReleaseRollout(
  releaseId: string,
  rolloutPercentage: number,
  notes?: string,
): Promise<ReleaseDecision> {
  return request<ReleaseDecision>(`releases/${releaseId}/rollout`, {
    method: 'PATCH',
    body: JSON.stringify({ rolloutPercentage, notes }),
  });
}

export async function rollbackReleaseProposal(
  releaseId: string,
  reason: string,
  targetVersionId?: string,
): Promise<ReleaseDecision> {
  return request<ReleaseDecision>(`releases/${releaseId}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ reason, targetVersionId }),
  });
}

// ----------------------------------------------------------------------------
// AUDIT
// ----------------------------------------------------------------------------

export async function fetchAuditLogs(
  resourceType?: string,
  resourceId?: string,
): Promise<AuditEvent[]> {
  let q = '';
  const params: string[] = [];
  if (resourceType) params.push(`resourceType=${encodeURIComponent(resourceType)}`);
  if (resourceId) params.push(`resourceId=${encodeURIComponent(resourceId)}`);
  if (params.length) q = `?${params.join('&')}`;
  return request<AuditEvent[]>(`audit${q}`);
}
