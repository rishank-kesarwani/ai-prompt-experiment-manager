import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { ReleasesService } from "./releases.service";
import { PromptsService } from "../prompts/prompts.service";
import { EvaluationService } from "../evaluation/evaluation.service";
import { ModelRegressionClient } from "../integrations/model-regression.client";
import { NotificationServiceClient } from "../integrations/notification.client";
import { AuditService } from "../audit/audit.service";
import { AiPlatformClient } from "../integrations/ai-platform.client";

describe("ReleasesService", () => {
  let service: ReleasesService;
  let promptsService: PromptsService;
  let regressionClient: ModelRegressionClient;

  const tenantId = "test-tenant";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReleasesService,
        PromptsService,
        EvaluationService,
        ModelRegressionClient,
        NotificationServiceClient,
        AuditService,
        AiPlatformClient,
      ],
    }).compile();

    service = module.get<ReleasesService>(ReleasesService);
    promptsService = module.get<PromptsService>(PromptsService);
    regressionClient = module.get<ModelRegressionClient>(ModelRegressionClient);
  });

  describe("Release Quality Gates & Fail-Closed Enforcement", () => {
    it("should block approval if an automated gate FAILS", async () => {
      const prompt = await promptsService.create(tenantId, {
        name: "Release Test Prompt",
        applicationId: "test-app",
        initialVersion: {
          version: "1.0.0",
          template: "Hello {{user}}",
          changelog: "v1",
          parameters: { model: "gemini", provider: "google", temperature: 0.5 },
        },
      });

      const ver2 = await promptsService.createVersion(tenantId, prompt.id, {
        version: "1.1.0",
        template: "Hi {{user}}",
        changelog: "v1.1",
        parameters: { model: "gemini", provider: "google", temperature: 0.5 },
      });

      const release = await service.create(tenantId, {
        promptId: prompt.id,
        targetVersionId: ver2.id,
        applicationId: "test-app",
      });

      // Force regression check to return FAIL (fail-closed)
      jest.spyOn(regressionClient, "checkRegression").mockResolvedValueOnce({
        status: "FAIL",
        summary: { passed: 0, warnings: 0, failed: 2 },
        details: "Regression detected: Quality dropped significantly.",
        isSimulatedFallback: false,
      });

      const evaluated = await service.evaluateGates(tenantId, release.id, {});
      expect(evaluated.overallGateStatus).toBe("FAIL");

      // Attempting to approve as regular approver should be rejected
      await expect(
        service.approveRelease(
          tenantId,
          release.id,
          { notes: "Trying to bypass gate" },
          { userId: "approver_1", role: "approver", name: "Approver" },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should promote target version to active upon 100% rollout approval", async () => {
      const prompt = await promptsService.create(tenantId, {
        name: "Promotion Test Prompt",
        applicationId: "test-app",
        initialVersion: {
          version: "1.0.0",
          template: "Hello {{user}}",
          changelog: "v1",
          parameters: { model: "gemini", provider: "google", temperature: 0.5 },
        },
      });

      const ver1 = prompt.versions[0];

      // Activate ver1
      await promptsService.transitionState(
        tenantId,
        prompt.id,
        ver1.id,
        { targetState: "candidate" },
        { userId: "admin", role: "admin", name: "Admin" },
      );
      await promptsService.transitionState(
        tenantId,
        prompt.id,
        ver1.id,
        { targetState: "approved" },
        { userId: "admin", role: "admin", name: "Admin" },
      );
      await promptsService.transitionState(
        tenantId,
        prompt.id,
        ver1.id,
        { targetState: "active" },
        { userId: "admin", role: "admin", name: "Admin" },
      );

      const ver2 = await promptsService.createVersion(tenantId, prompt.id, {
        version: "1.1.0",
        template: "Hi {{user}}",
        changelog: "v1.1",
        parameters: { model: "gemini", provider: "google", temperature: 0.5 },
      });

      // Move ver2 to approved
      await promptsService.transitionState(
        tenantId,
        prompt.id,
        ver2.id,
        { targetState: "candidate" },
        { userId: "admin", role: "admin", name: "Admin" },
      );
      await promptsService.transitionState(
        tenantId,
        prompt.id,
        ver2.id,
        { targetState: "approved" },
        { userId: "admin", role: "admin", name: "Admin" },
      );

      const release = await service.create(tenantId, {
        promptId: prompt.id,
        targetVersionId: ver2.id,
        applicationId: "test-app",
      });

      // Mock PASS regression check
      jest.spyOn(regressionClient, "checkRegression").mockResolvedValueOnce({
        status: "PASS",
        summary: { passed: 5, warnings: 0, failed: 0 },
        details: "Clean regression test.",
        isSimulatedFallback: false,
      });

      await service.evaluateGates(tenantId, release.id, {});

      // Approve 100% rollout
      const approved = await service.approveRelease(
        tenantId,
        release.id,
        { notes: "Approved for 100% traffic", rolloutPercentage: 100 },
        { userId: "admin", role: "admin", name: "Admin" },
      );

      expect(approved.status).toBe("active");
      expect(approved.rolloutPercentage).toBe(100);

      // Verify prompt now has ver2 as activeVersionId
      const updatedPrompt = await promptsService.findOne(tenantId, prompt.id);
      expect(updatedPrompt.activeVersionId).toBe(ver2.id);

      // Verify 1-click rollback restores ver1
      const rolledBack = await service.rollback(
        tenantId,
        release.id,
        { reason: "Unexpected edge case in production" },
        { userId: "admin", role: "admin", name: "Admin" },
      );

      expect(rolledBack.status).toBe("rolled_back");
      expect(rolledBack.rolloutPercentage).toBe(0);

      const revertedPrompt = await promptsService.findOne(tenantId, prompt.id);
      expect(revertedPrompt.activeVersionId).toBe(ver1.id);
    });
  });
});
