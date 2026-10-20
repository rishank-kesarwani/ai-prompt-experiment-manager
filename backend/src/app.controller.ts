import { Controller, Get, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { PublicReadOnly } from "./common/decorators";

@ApiTags("Health & Service Discovery")
@Controller()
export class AppController {
  @PublicReadOnly()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Service discovery root endpoint" })
  @ApiResponse({ status: 200, description: "Service metadata returned" })
  getRoot() {
    return {
      service: "ai-prompt-experiment-manager-backend",
      description: "AI Prompt Experiment & Release Manager Backend API",
      status: "UP",
      version: "1.0.0",
      apiPrefix: "/api/v1",
      docs: "/api/docs",
      timestamp: new Date().toISOString(),
    };
  }

  @PublicReadOnly()
  @Get("health")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Liveness & readiness health check" })
  getHealth() {
    return {
      status: "UP",
      timestamp: new Date().toISOString(),
      services: {
        api: "UP",
        memoryStore: "UP",
        aiPlatformIntegration: process.env.AI_PLATFORM_URL
          ? "CONFIGURED"
          : "OPTIONAL_OFFLINE_FALLBACK",
        modelRegressionIntegration: process.env.MODEL_REGRESSION_SERVICE_URL
          ? "CONFIGURED"
          : "OPTIONAL_OFFLINE_FALLBACK",
        notificationIntegration: process.env.NOTIFICATION_SERVICE_URL
          ? "CONFIGURED"
          : "OPTIONAL_OFFLINE_FALLBACK",
      },
    };
  }

  @PublicReadOnly()
  @Get("health/ready")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Kubernetes readiness probe" })
  getReady() {
    return {
      status: "READY",
      ready: true,
      timestamp: new Date().toISOString(),
    };
  }

  @PublicReadOnly()
  @Get("health/live")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Kubernetes liveness probe" })
  getLive() {
    return {
      status: "ALIVE",
      alive: true,
      timestamp: new Date().toISOString(),
    };
  }
}
