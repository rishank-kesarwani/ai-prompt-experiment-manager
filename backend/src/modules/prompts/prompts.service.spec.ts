import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { PromptsService } from "./prompts.service";
import { AuditService } from "../audit/audit.service";

describe("PromptsService", () => {
  let service: PromptsService;

  const tenantId = "test-tenant";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptsService, AuditService],
    }).compile();

    service = module.get<PromptsService>(PromptsService);
  });

  describe("Prompt creation and variable extraction", () => {
    it("should create a prompt and extract template variables", async () => {
      const prompt = await service.create(
        tenantId,
        {
          name: "Test Concierge",
          applicationId: "test-app",
          initialVersion: {
            version: "1.0.0",
            template: "Hello {{user_name}}, welcome to {{service_name}}!",
            changelog: "Initial version",
            parameters: {
              model: "gemini-1.5-flash",
              provider: "google-vertex",
              temperature: 0.7,
            },
          },
        },
        "tester",
      );

      expect(prompt).toBeDefined();
      expect(prompt.versions.length).toBe(1);
      const v = prompt.versions[0];
      expect(v.variables.map((x) => x.name)).toContain("user_name");
      expect(v.variables.map((x) => x.name)).toContain("service_name");
      expect(v.checksum).toBeDefined();
      expect(v.lifecycleState).toBe("draft");
    });

    it("should reject dangerous code execution patterns in templates", async () => {
      await expect(
        service.create(
          tenantId,
          {
            name: "Malicious Prompt",
            applicationId: "test-app",
            initialVersion: {
              version: "1.0.0",
              template: 'Hello {{eval("process.exit(1)")}}',
              changelog: "Exploit attempt",
              parameters: {
                model: "gemini-1.5-flash",
                provider: "google",
                temperature: 0.5,
              },
            },
          },
          "attacker",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw on mismatched template braces", async () => {
      await expect(
        service.create(
          tenantId,
          {
            name: "Broken Braces",
            applicationId: "test-app",
            initialVersion: {
              version: "1.0.0",
              template: "Hello {{unclosed_tag and {{broken",
              changelog: "Syntax error",
              parameters: {
                model: "gemini-1.5-flash",
                provider: "google",
                temperature: 0.5,
              },
            },
          },
          "tester",
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("Rendering and Variable Validation", () => {
    it("should render template when all required variables are supplied", async () => {
      const prompt = await service.create(tenantId, {
        name: "Greeting",
        applicationId: "test-app",
        initialVersion: {
          version: "1.0.0",
          template: "Welcome {{name}}!",
          changelog: "v1",
          parameters: { model: "gemini", provider: "google", temperature: 0.5 },
        },
      });

      const ver = prompt.versions[0];
      const result = service.renderPrompt(ver, { name: "Alice" });
      expect(result.renderedPrompt).toBe("Welcome Alice!");
    });

    it("should throw BadRequestException if required variable is missing without default", async () => {
      const prompt = await service.create(tenantId, {
        name: "Greeting",
        applicationId: "test-app",
        initialVersion: {
          version: "1.0.0",
          template: "Welcome {{name}}!",
          changelog: "v1",
          parameters: { model: "gemini", provider: "google", temperature: 0.5 },
        },
      });

      const ver = prompt.versions[0];
      expect(() => service.renderPrompt(ver, {})).toThrow(BadRequestException);
    });
  });

  describe("Optimistic Concurrency Control", () => {
    it("should throw ConflictException if revision does not match expectedRevision", async () => {
      const prompt = await service.create(tenantId, {
        name: "Concurrency Test",
        applicationId: "test-app",
        initialVersion: {
          version: "1.0.0",
          template: "Hello {{name}}",
          changelog: "v1",
          parameters: { model: "gemini", provider: "google", temperature: 0.5 },
        },
      });

      const verId = prompt.versions[0].id;

      await expect(
        service.transitionState(
          tenantId,
          prompt.id,
          verId,
          {
            targetState: "candidate",
            expectedRevision: 999, // Stale revision
          },
          { userId: "operator_1", role: "editor", name: "Operator" },
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("Lifecycle State Transitions and Roles", () => {
    it("should prevent non-approvers from approving versions", async () => {
      const prompt = await service.create(tenantId, {
        name: "Role Test",
        applicationId: "test-app",
        initialVersion: {
          version: "1.0.0",
          template: "Hello {{name}}",
          changelog: "v1",
          parameters: { model: "gemini", provider: "google", temperature: 0.5 },
        },
      });

      const verId = prompt.versions[0].id;

      // First move to candidate (allowed for editor)
      await service.transitionState(
        tenantId,
        prompt.id,
        verId,
        { targetState: "candidate" },
        { userId: "editor_1", role: "editor", name: "Editor" },
      );

      // Attempting to approve as editor should throw ForbiddenException
      await expect(
        service.transitionState(
          tenantId,
          prompt.id,
          verId,
          { targetState: "approved" },
          { userId: "editor_1", role: "editor", name: "Editor" },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should allow approver to approve and activate version, demoting previous active version", async () => {
      const prompt = await service.create(tenantId, {
        name: "Activation Test",
        applicationId: "test-app",
        initialVersion: {
          version: "1.0.0",
          template: "Version 1 {{name}}",
          changelog: "v1",
          parameters: { model: "gemini", provider: "google", temperature: 0.5 },
        },
      });

      const ver1 = prompt.versions[0];

      // Activate v1
      await service.transitionState(
        tenantId,
        prompt.id,
        ver1.id,
        { targetState: "candidate" },
        { userId: "approver_1", role: "approver", name: "Approver" },
      );
      await service.transitionState(
        tenantId,
        prompt.id,
        ver1.id,
        { targetState: "approved" },
        { userId: "approver_1", role: "approver", name: "Approver" },
      );
      await service.transitionState(
        tenantId,
        prompt.id,
        ver1.id,
        { targetState: "active" },
        { userId: "approver_1", role: "approver", name: "Approver" },
      );

      let p = await service.findOne(tenantId, prompt.id);
      expect(p.activeVersionId).toBe(ver1.id);

      // Create v2
      const ver2 = await service.createVersion(tenantId, prompt.id, {
        version: "2.0.0",
        template: "Version 2 {{name}}",
        changelog: "v2",
        parameters: {
          model: "gemini-1.5-pro",
          provider: "google",
          temperature: 0.3,
        },
      });

      await service.transitionState(
        tenantId,
        prompt.id,
        ver2.id,
        { targetState: "candidate" },
        { userId: "approver_1", role: "approver", name: "Approver" },
      );
      await service.transitionState(
        tenantId,
        prompt.id,
        ver2.id,
        { targetState: "approved" },
        { userId: "approver_1", role: "approver", name: "Approver" },
      );
      await service.transitionState(
        tenantId,
        prompt.id,
        ver2.id,
        { targetState: "active" },
        { userId: "approver_1", role: "approver", name: "Approver" },
      );

      p = await service.findOne(tenantId, prompt.id);
      expect(p.activeVersionId).toBe(ver2.id);

      // Verify ver1 demoted to approved
      const updatedVer1 = await service.findVersion(
        tenantId,
        prompt.id,
        ver1.id,
      );
      expect(updatedVer1.lifecycleState).toBe("approved");
    });
  });

  describe("Diff Engine", () => {
    it("should compute unified diff and parameter changes between versions", async () => {
      const prompt = await service.create(tenantId, {
        name: "Diff Test",
        applicationId: "test-app",
        initialVersion: {
          version: "1.0.0",
          template: "Hello {{user}}, good morning.",
          changelog: "v1",
          parameters: {
            model: "gemini-1.5-flash",
            provider: "google",
            temperature: 0.7,
          },
        },
      });

      const ver1 = prompt.versions[0];
      const ver2 = await service.createVersion(tenantId, prompt.id, {
        version: "1.1.0",
        template: "Hello {{user}}, good afternoon! How may we help?",
        changelog: "v1.1",
        parameters: {
          model: "gemini-1.5-flash",
          provider: "google",
          temperature: 0.3,
        },
      });

      const diff = await service.computeDiff(
        tenantId,
        prompt.id,
        ver1.id,
        ver2.id,
      );
      expect(diff.unifiedDiff).toBeDefined();
      expect(diff.parameterDiffs.temperature.changed).toBe(true);
      expect(diff.parameterDiffs.temperature.v1).toBe(0.7);
      expect(diff.parameterDiffs.temperature.v2).toBe(0.3);
      expect(diff.parameterDiffs.model.changed).toBe(false);
    });
  });
});
