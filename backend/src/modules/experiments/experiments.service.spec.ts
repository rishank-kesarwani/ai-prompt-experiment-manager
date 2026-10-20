import { Test, TestingModule } from "@nestjs/testing";
import { ExperimentsService } from "./experiments.service";
import { PromptsService } from "../prompts/prompts.service";
import { AuditService } from "../audit/audit.service";
import { Experiment } from "../../common/types";

describe("ExperimentsService", () => {
  let service: ExperimentsService;
  let promptsService: PromptsService;

  const tenantId = "test-tenant";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExperimentsService, PromptsService, AuditService],
    }).compile();

    service = module.get<ExperimentsService>(ExperimentsService);
    promptsService = module.get<PromptsService>(PromptsService);
  });

  describe("Deterministic Bucketing Algorithm", () => {
    const mockExperiment: Experiment = {
      id: "exp_test_1",
      tenantId: "test-tenant",
      applicationId: "test-app",
      promptId: "pmt_1",
      name: "Deterministic A/B Test",
      description: "Testing bucketing consistency",
      status: "running",
      controlVersionId: "ver_control",
      candidateVersionIds: ["ver_candidate"],
      variants: [
        { versionId: "ver_control", variantName: "control", percentage: 50 },
        {
          versionId: "ver_candidate",
          variantName: "candidate",
          percentage: 50,
        },
      ],
      objectives: [{ metric: "quality_score", direction: "higher" }],
      seed: "seed_deterministic_fixed_123",
      totalAssignments: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it("should consistently assign the exact same variant and bucket to the same subjectId", () => {
      const subjectId = "user_stable_98765";

      const assignment1 = service.previewAssignment(mockExperiment, subjectId);
      const assignment2 = service.previewAssignment(mockExperiment, subjectId);
      const assignment3 = service.assign(mockExperiment, subjectId);

      expect(assignment1.bucket).toBe(assignment2.bucket);
      expect(assignment1.assignedVariant).toBe(assignment2.assignedVariant);
      expect(assignment1.assignedVersionId).toBe(assignment2.assignedVersionId);

      expect(assignment3.bucket).toBe(assignment1.bucket);
      expect(assignment3.assignedVariant).toBe(assignment1.assignedVariant);
    });

    it("should assign different buckets across varying subject identifiers", () => {
      const buckets = new Set<number>();
      for (let i = 0; i < 20; i++) {
        const assignment = service.previewAssignment(
          mockExperiment,
          `user_cohort_subject_${i}`,
        );
        buckets.add(assignment.bucket);
      }

      // Bucketing across 20 distinct IDs should hit multiple unique buckets
      expect(buckets.size).toBeGreaterThan(1);
    });
  });

  describe("Statistical Analysis & Sample Size Rigor", () => {
    it("should report INSUFFICIENT sample size when N < 30", async () => {
      const prompt = await promptsService.create(tenantId, {
        name: "Stats Prompt",
        applicationId: "app",
        initialVersion: {
          version: "1.0.0",
          template: "Hello {{user}}",
          changelog: "v1",
          parameters: { model: "gemini", provider: "google", temperature: 0.5 },
        },
      });

      const verControl = prompt.versions[0];
      const verCandidate = await promptsService.createVersion(
        tenantId,
        prompt.id,
        {
          version: "1.1.0",
          template: "Hi {{user}}",
          changelog: "v1.1",
          parameters: { model: "gemini", provider: "google", temperature: 0.5 },
        },
      );

      const exp = await service.create(tenantId, {
        name: "Small Sample Test",
        applicationId: "app",
        promptId: prompt.id,
        controlVersionId: verControl.id,
        candidateVersionIds: [verCandidate.id],
        variants: [
          { versionId: verControl.id, variantName: "control", percentage: 50 },
          {
            versionId: verCandidate.id,
            variantName: "candidate",
            percentage: 50,
          },
        ],
        objectives: [{ metric: "quality_score", direction: "higher" }],
      });

      // Record only 5 outcomes (N < 30)
      for (let i = 0; i < 5; i++) {
        await service.recordOutcome(tenantId, exp.id, {
          subjectId: `user_ctrl_${i}`,
          versionId: verControl.id,
          variantName: "control",
          metrics: { qualityScore: 0.8, latencyMs: 400 },
        });
        await service.recordOutcome(tenantId, exp.id, {
          subjectId: `user_cand_${i}`,
          versionId: verCandidate.id,
          variantName: "candidate",
          metrics: { qualityScore: 0.9, latencyMs: 350 },
        });
      }

      const analysis = await service.analyzeExperiment(tenantId, exp.id);

      expect(analysis.hasSufficientSampleSize).toBe(false);
      expect(analysis.recommendation).toBe("inconclusive");
      expect(analysis.recommendationReason).toContain(
        "Insufficient sample size",
      );

      // Check that individual metric comparison reflects insufficient sample
      const qualityComp = analysis.comparisons["candidate"].find(
        (c) => c.metric === "qualityScore",
      );
      expect(qualityComp?.hasSufficientSample).toBe(false);
      expect(qualityComp?.isSignificant).toBe(false);
      expect(qualityComp?.confidenceInterval95).toBeNull();
    });

    it("should compute Welch t-test and 95% Confidence Interval when N >= 30", async () => {
      const prompt = await promptsService.create(tenantId, {
        name: "Large Sample Prompt",
        applicationId: "app",
        initialVersion: {
          version: "1.0.0",
          template: "Hello {{user}}",
          changelog: "v1",
          parameters: { model: "gemini", provider: "google", temperature: 0.5 },
        },
      });

      const verControl = prompt.versions[0];
      const verCandidate = await promptsService.createVersion(
        tenantId,
        prompt.id,
        {
          version: "1.1.0",
          template: "Hi {{user}}",
          changelog: "v1.1",
          parameters: { model: "gemini", provider: "google", temperature: 0.5 },
        },
      );

      const exp = await service.create(tenantId, {
        name: "Full Statistical Power Test",
        applicationId: "app",
        promptId: prompt.id,
        controlVersionId: verControl.id,
        candidateVersionIds: [verCandidate.id],
        variants: [
          { versionId: verControl.id, variantName: "control", percentage: 50 },
          {
            versionId: verCandidate.id,
            variantName: "candidate",
            percentage: 50,
          },
        ],
        objectives: [{ metric: "quality_score", direction: "higher" }],
      });

      // Record 35 outcomes per cohort (N >= 30)
      for (let i = 0; i < 35; i++) {
        await service.recordOutcome(tenantId, exp.id, {
          subjectId: `u_ctrl_${i}`,
          versionId: verControl.id,
          variantName: "control",
          metrics: {
            qualityScore: 0.75 + (i % 3) * 0.02,
            latencyMs: 400 + (i % 5) * 10,
          },
        });
        await service.recordOutcome(tenantId, exp.id, {
          subjectId: `u_cand_${i}`,
          versionId: verCandidate.id,
          variantName: "candidate",
          metrics: {
            qualityScore: 0.9 + (i % 3) * 0.02,
            latencyMs: 380 + (i % 5) * 10,
          },
        });
      }

      const analysis = await service.analyzeExperiment(tenantId, exp.id);

      expect(analysis.hasSufficientSampleSize).toBe(true);

      const qualityComp = analysis.comparisons["candidate"].find(
        (c) => c.metric === "qualityScore",
      );

      expect(qualityComp?.hasSufficientSample).toBe(true);
      expect(qualityComp?.confidenceInterval95).not.toBeNull();
      expect(qualityComp?.isSignificant).toBe(true);
      expect(qualityComp?.status).toBe("better");
      expect(analysis.recommendation).toBe("ready_for_release");
    });
  });
});
