import { Test, TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = module.get<AppController>(AppController);
  });

  describe("root route (/)", () => {
    it("should return service metadata without global prefix dependency", () => {
      const res = appController.getRoot();
      expect(res).toBeDefined();
      expect(res.status).toBe("UP");
      expect(res.service).toBe("ai-prompt-experiment-manager-backend");
      expect(res.apiPrefix).toBe("/api/v1");
    });
  });

  describe("health check (/health)", () => {
    it("should return UP status with memory store health", () => {
      const res = appController.getHealth();
      expect(res.status).toBe("UP");
      expect(res.services.api).toBe("UP");
      expect(res.services.memoryStore).toBe("UP");
      expect(res.timestamp).toBeDefined();
    });
  });

  describe("readiness probe (/health/ready)", () => {
    it("should return READY", () => {
      const res = appController.getReady();
      expect(res.status).toBe("READY");
      expect(res.ready).toBe(true);
    });
  });

  describe("liveness probe (/health/live)", () => {
    it("should return ALIVE", () => {
      const res = appController.getLive();
      expect(res.status).toBe("ALIVE");
      expect(res.alive).toBe(true);
    });
  });
});
