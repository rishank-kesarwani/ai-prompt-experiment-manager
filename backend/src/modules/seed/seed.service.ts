import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { PromptsService } from "../prompts/prompts.service";
import { ExperimentsService } from "../experiments/experiments.service";
import { EvaluationService } from "../evaluation/evaluation.service";
import { ReleasesService } from "../releases/releases.service";
import { AuditService } from "../audit/audit.service";
import {
  Prompt,
  PromptVersion,
  Experiment,
  StoredOutcome,
  Dataset,
  ReleaseDecision,
} from "../../common/types";

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly promptsService: PromptsService,
    private readonly experimentsService: ExperimentsService,
    private readonly evaluationService: EvaluationService,
    private readonly releasesService: ReleasesService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    this.seedEnterpriseData();
  }

  seedEnterpriseData() {
    const tenantId =
      process.env.DEFAULT_TENANT_ID || "tenant-enterprise-default";
    this.logger.log(
      `Seeding initial enterprise prompt fixtures for tenant: ${tenantId}`,
    );

    // ------------------------------------------------------------------------
    // 1. PROMPT: Customer Support Concierge
    // ------------------------------------------------------------------------
    const prompt1Id = "pmt_support_1";
    const ver10Id = "ver_support_100";
    const ver11Id = "ver_support_110";
    const ver12Id = "ver_support_120_draft";

    const prompt1: Prompt = {
      id: prompt1Id,
      tenantId,
      applicationId: "customer-support-agent",
      name: "Customer Support Concierge",
      description:
        "Primary customer care conversational prompt powering tier-1 automated support tickets.",
      tags: ["support", "tier1", "customer-care", "production"],
      activeVersionId: ver10Id,
      revision: 3,
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-12T14:30:00.000Z",
    };

    const ver10: PromptVersion = {
      id: ver10Id,
      promptId: prompt1Id,
      version: "1.0.0",
      template:
        'Hello {{customer_name}},\n\nThank you for reaching out regarding your issue with {{product_name}}: "{{issue_summary}}".\n\nI am here to investigate and resolve this for you. Please let me know any additional details.',
      systemInstruction:
        "You are an AI customer support assistant. Be polite, concise, and helpful. Always address the customer by name.",
      variables: [
        {
          name: "customer_name",
          type: "string",
          required: true,
          description: "Customer full name",
        },
        {
          name: "product_name",
          type: "string",
          required: true,
          description: "Product or subscription tier",
        },
        {
          name: "issue_summary",
          type: "string",
          required: true,
          description: "Summary of the reported problem",
        },
      ],
      parameters: {
        model: "gemini-1.5-flash",
        provider: "google-vertex",
        temperature: 0.7,
        maxTokens: 512,
        topP: 0.9,
      },
      lifecycleState: "active",
      author: "senior_prompt_eng@internal",
      changelog: "Initial production baseline release.",
      checksum:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      revision: 2,
      createdAt: "2026-10-01T10:05:00.000Z",
      updatedAt: "2026-10-02T11:00:00.000Z",
      approvedBy: "Director of AI Engineering",
      approvedAt: "2026-10-02T11:00:00.000Z",
    };

    const ver11: PromptVersion = {
      id: ver11Id,
      promptId: prompt1Id,
      version: "1.1.0",
      template:
        'Hi {{customer_name}},\n\nI understand you are experiencing "{{issue_summary}}" with your {{product_name}}. I know how frustrating this can be, and I am here to help you get this sorted out right away.\n\nHere are the fastest next steps we can take together:\n1. Verify your active account status.\n2. Review eligible diagnostic steps.\n\nPlease let me know if you would like me to proceed.',
      systemInstruction:
        "You are an empathetic, highly efficient tier-1 customer success concierge. Acknowledge frustration, provide clear numbered steps, and remain calm.",
      variables: [
        {
          name: "customer_name",
          type: "string",
          required: true,
          description: "Customer full name",
        },
        {
          name: "product_name",
          type: "string",
          required: true,
          description: "Product or subscription tier",
        },
        {
          name: "issue_summary",
          type: "string",
          required: true,
          description: "Summary of the reported problem",
        },
      ],
      parameters: {
        model: "gemini-1.5-flash",
        provider: "google-vertex",
        temperature: 0.4,
        maxTokens: 600,
        topP: 0.85,
      },
      lifecycleState: "approved",
      author: "lead_product_designer@internal",
      changelog:
        "Added empathetic framing, reduced temperature to 0.4 for deterministic guidance, and introduced structured resolution steps.",
      checksum:
        "a8729f27618c7bc7001476104eec2496c8c9e54a9d8e5792efc64b6305a41508",
      revision: 3,
      createdAt: "2026-10-08T09:20:00.000Z",
      updatedAt: "2026-10-10T16:45:00.000Z",
      approvedBy: "AI Release Manager",
      approvedAt: "2026-10-10T16:45:00.000Z",
    };

    const ver12: PromptVersion = {
      id: ver12Id,
      promptId: prompt1Id,
      version: "1.2.0-draft",
      template:
        "Hello {{customer_name}}, regarding {{issue_summary}} on {{product_name}} - click here for instant self-service resolution.",
      systemInstruction: "Direct response generator.",
      variables: [
        { name: "customer_name", type: "string", required: true },
        { name: "product_name", type: "string", required: true },
        { name: "issue_summary", type: "string", required: true },
      ],
      parameters: {
        model: "gemini-1.5-pro",
        provider: "google-vertex",
        temperature: 0.2,
      },
      lifecycleState: "draft",
      author: "prompt_intern@internal",
      changelog:
        "WIP draft testing ultra-short one-liner self service responses.",
      checksum:
        "3a18a992bc68b8e0192e21b8c0490b4e20982df4e70e179e95f5ccb483bb93ef",
      revision: 1,
      createdAt: "2026-10-14T08:00:00.000Z",
      updatedAt: "2026-10-14T08:00:00.000Z",
    };

    this.promptsService.seedPrompt(prompt1, [ver10, ver11, ver12]);

    // ------------------------------------------------------------------------
    // 2. PROMPT: Code Review Quality Inspector
    // ------------------------------------------------------------------------
    const prompt2Id = "pmt_codereview_2";
    const ver20Id = "ver_code_100";

    const prompt2: Prompt = {
      id: prompt2Id,
      tenantId,
      applicationId: "ai-pr-review-platform",
      name: "Code Review Quality Inspector",
      description:
        "Automated PR review assistant detecting bugs, anti-patterns, and security regressions.",
      tags: ["ci", "code-review", "security"],
      activeVersionId: ver20Id,
      revision: 1,
      createdAt: "2026-10-04T12:00:00.000Z",
      updatedAt: "2026-10-04T12:00:00.000Z",
    };

    const ver20: PromptVersion = {
      id: ver20Id,
      promptId: prompt2Id,
      version: "1.0.0",
      template:
        "Review the following diff in file `{{filename}}` (language: {{language}}):\n\n```\n{{git_diff}}\n```\n\nIdentify security vulnerabilities, logic bugs, and style issues.",
      systemInstruction:
        "You are a principal staff software engineer performing strict code reviews.",
      variables: [
        { name: "filename", type: "string", required: true },
        { name: "language", type: "string", required: true },
        { name: "git_diff", type: "string", required: true },
      ],
      parameters: {
        model: "gemini-1.5-pro",
        provider: "google-vertex",
        temperature: 0.1,
        maxTokens: 2048,
      },
      lifecycleState: "active",
      author: "appsec_lead@internal",
      changelog: "Initial baseline for automated PR reviewer.",
      checksum:
        "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
      revision: 1,
      createdAt: "2026-10-04T12:05:00.000Z",
      updatedAt: "2026-10-04T12:05:00.000Z",
    };

    this.promptsService.seedPrompt(prompt2, [ver20]);

    // ------------------------------------------------------------------------
    // 3. EXPERIMENT: Concierge v1.1 Empathetic Few-Shot A/B Test
    // ------------------------------------------------------------------------
    const exp1Id = "exp_support_ab_1";
    const experiment1: Experiment = {
      id: exp1Id,
      tenantId,
      applicationId: "customer-support-agent",
      promptId: prompt1Id,
      name: "Support Concierge v1.1 Empathetic Few-Shot A/B Test",
      description:
        "Controlled A/B test measuring customer satisfaction, resolution accuracy, and latency between v1.0 (zero-shot) and v1.1 (empathetic numbered steps).",
      status: "running",
      controlVersionId: ver10Id,
      candidateVersionIds: [ver11Id],
      variants: [
        { versionId: ver10Id, variantName: "control", percentage: 50 },
        { versionId: ver11Id, variantName: "candidate_v11", percentage: 50 },
      ],
      objectives: [
        {
          metric: "quality_score",
          direction: "higher",
          targetDeltaPct: 10,
          description: "Increase perceived resolution helpfulness",
        },
        {
          metric: "latency_ms",
          direction: "lower",
          targetThreshold: 500,
          description: "Maintain sub-500ms p95 latency",
        },
        {
          metric: "cost_usd",
          direction: "lower",
          targetDeltaPct: 0,
          description: "Ensure cost remains neutral",
        },
      ],
      seed: "seed_ab_support_prod_2026",
      totalAssignments: 142,
      startedAt: "2026-10-10T12:00:00.000Z",
      createdAt: "2026-10-10T11:30:00.000Z",
      updatedAt: "2026-10-14T15:00:00.000Z",
    };

    // Prepopulate realistic sample data (N=45 per variant so statistical tests satisfy N >= 30)
    const initialOutcomes: StoredOutcome[] = [];

    // Control cohort outcomes (N=45)
    for (let i = 1; i <= 45; i++) {
      const lat = Math.round(380 + Math.sin(i) * 60 + (i % 5) * 15);
      const cost = Number((0.0021 + (i % 3) * 0.0002).toFixed(5));
      const qual = Number((0.78 + Math.cos(i) * 0.08).toFixed(4));
      const exact = i % 4 !== 0;

      initialOutcomes.push({
        id: `out_ctrl_${i}`,
        experimentId: exp1Id,
        tenantId,
        subjectId: `subject_ctrl_${1000 + i}`,
        versionId: ver10Id,
        variantName: "control",
        metrics: {
          latencyMs: lat,
          costUsd: cost,
          qualityScore: Math.min(0.95, Math.max(0.65, qual)),
          exactMatch: exact,
          error: false,
        },
        source: "online_telemetry",
        timestamp: new Date(Date.now() - (45 - i) * 3600000).toISOString(),
      });
    }

    // Candidate cohort outcomes (N=45): Notice quality improved from ~0.78 to ~0.89, latency slightly reduced
    for (let i = 1; i <= 45; i++) {
      const lat = Math.round(340 + Math.cos(i) * 45 + (i % 4) * 10);
      const cost = Number((0.0022 + (i % 4) * 0.0001).toFixed(5));
      const qual = Number((0.89 + Math.sin(i) * 0.06).toFixed(4));
      const exact = i % 6 !== 0;

      initialOutcomes.push({
        id: `out_cand_${i}`,
        experimentId: exp1Id,
        tenantId,
        subjectId: `subject_cand_${2000 + i}`,
        versionId: ver11Id,
        variantName: "candidate_v11",
        metrics: {
          latencyMs: lat,
          costUsd: cost,
          qualityScore: Math.min(0.99, Math.max(0.78, qual)),
          exactMatch: exact,
          error: false,
        },
        source: "online_telemetry",
        timestamp: new Date(Date.now() - (45 - i) * 3500000).toISOString(),
      });
    }

    this.experimentsService.seedExperiment(experiment1, initialOutcomes);

    // ------------------------------------------------------------------------
    // 4. DATASET: Customer Care Golden Evaluation Benchmark
    // ------------------------------------------------------------------------
    const ds1Id = "ds_support_eval_1";
    const dataset1: Dataset = {
      id: ds1Id,
      tenantId,
      applicationId: "customer-support-agent",
      name: "Customer Support Golden Benchmark",
      description:
        "Gold-standard benchmark with 8 representative customer service scenarios.",
      version: "1.0.0",
      testCases: [
        {
          caseId: "tc_damaged_item",
          inputVariables: {
            customer_name: "David Miller",
            product_name: "Ergonomic Desk Pro",
            issue_summary:
              "Desktop surface arrived chipped and cracked at the corner.",
          },
          referenceOutput:
            "We apologize for the damaged desktop received. We have initiated a replacement.",
          evaluationRubric:
            "Express empathy, confirm desk model, offer replacement without hassle.",
          tags: ["damaged-goods", "shipping"],
        },
        {
          caseId: "tc_billing_double_charge",
          inputVariables: {
            customer_name: "Elena Rostova",
            product_name: "Enterprise Cloud Subscription",
            issue_summary:
              "Billed twice for the month of September invoice #8892.",
          },
          referenceOutput:
            "Thank you for reaching out. We have flagged the duplicate September invoice for immediate refund.",
          evaluationRubric:
            "Acknowledge duplicate charge and explain 3-5 business day refund timeline.",
          tags: ["billing", "high-priority"],
        },
        {
          caseId: "tc_login_mfa_lockout",
          inputVariables: {
            customer_name: "Marcus Brody",
            product_name: "Security Shield VPN",
            issue_summary:
              "Lost authenticator phone and locked out of 2FA login portal.",
          },
          referenceOutput:
            "We can assist you in securely recovering access to your Security Shield account.",
          evaluationRubric:
            "Direct customer to security verification steps and backup codes.",
          tags: ["auth", "security"],
        },
        {
          caseId: "tc_feature_inquiry",
          inputVariables: {
            customer_name: "Chloe Zhao",
            product_name: "AI Document Intelligence",
            issue_summary:
              "Inquiring whether batch PDF OCR exports support multi-page tables.",
          },
          referenceOutput:
            "Yes, our batch PDF OCR supports complex multi-page table extraction.",
          evaluationRubric:
            "Accurate feature confirmation with link to API docs.",
          tags: ["product-inquiry"],
        },
      ],
      createdAt: "2026-10-05T09:00:00.000Z",
      updatedAt: "2026-10-05T09:00:00.000Z",
    };

    this.evaluationService.seedDataset(dataset1);

    // ------------------------------------------------------------------------
    // 5. RELEASE PROPOSAL: Concierge v1.1 Staged Rollout
    // ------------------------------------------------------------------------
    const rel1Id = "rel_support_v11";
    const release1: ReleaseDecision = {
      id: rel1Id,
      tenantId,
      applicationId: "customer-support-agent",
      promptId: prompt1Id,
      targetVersionId: ver11Id,
      currentActiveVersionId: ver10Id,
      status: "partially_rolled_out",
      rolloutPercentage: 50,
      overallGateStatus: "PASS",
      gateChecks: [
        {
          ruleId: "rule_latency",
          ruleName: "Max p95 Latency Threshold (800ms)",
          status: "PASS",
          actualValue: 412,
          thresholdValue: 800,
          details: "p95 Latency (412ms) is 48% below allowable ceiling.",
          evaluatedAt: "2026-10-12T14:00:00.000Z",
        },
        {
          ruleId: "rule_quality",
          ruleName: "Minimum Quality Score (0.85)",
          status: "PASS",
          actualValue: 0.93,
          thresholdValue: 0.85,
          details:
            "Evaluated quality score (0.93) represents a +14% lift over v1.0.",
          evaluatedAt: "2026-10-12T14:00:00.000Z",
        },
        {
          ruleId: "rule_regression_gate",
          ruleName: "Model Regression External Quality Gate",
          status: "PASS",
          actualValue: { passed: 8, warnings: 0, failed: 0 },
          thresholdValue: "Zero regressions",
          details:
            "Model Regression Service verified zero performance regressions.",
          evaluatedAt: "2026-10-12T14:00:00.000Z",
        },
      ],
      requiresManualApproval: true,
      approvedBy: "AI Release Manager (ops_lead)",
      approvedAt: "2026-10-12T14:15:00.000Z",
      approvalNotes:
        "Statistically significant quality improvement observed in A/B test. Approved for 50% staged canary rollout.",
      createdAt: "2026-10-12T13:45:00.000Z",
      updatedAt: "2026-10-12T14:15:00.000Z",
    };

    this.releasesService.seedRelease(release1);

    // Initial audit logs
    this.auditService.record(
      tenantId,
      "system_seeder",
      "SYSTEM_INITIALIZED",
      "prompt",
      prompt1Id,
      {
        message:
          "Initial enterprise workspace fixtures populated successfully.",
      },
    );

    this.logger.log("Initial enterprise prompt fixtures seeded successfully.");
  }
}
