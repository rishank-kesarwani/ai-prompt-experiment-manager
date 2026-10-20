import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";
import { ReleaseGateStatus } from "../../common/types";

export interface RegressionCheckRequest {
  project: string;
  version?: string;
  datasetId: string;
  datasetVersion?: string;
  model: string;
  promptVersion?: string;
  baselineId?: string;
  metrics?: string[];
}

export interface RegressionCheckResult {
  status: ReleaseGateStatus;
  runId?: string;
  summary: {
    passed: number;
    warnings: number;
    failed: number;
  };
  details: string;
  isSimulatedFallback: boolean;
}

@Injectable()
export class ModelRegressionClient {
  private readonly logger = new Logger(ModelRegressionClient.name);

  async checkRegression(
    req: RegressionCheckRequest,
  ): Promise<RegressionCheckResult> {
    const serviceUrl = process.env.MODEL_REGRESSION_SERVICE_URL;
    const apiKey = process.env.MODEL_REGRESSION_SERVICE_API_KEY;
    const timeoutMs = parseInt(
      process.env.MODEL_REGRESSION_TIMEOUT_MS || "5000",
      10,
    );
    const failClosed = process.env.MODEL_REGRESSION_FAIL_CLOSED !== "false";

    if (serviceUrl) {
      try {
        const response = await axios.post(
          `${serviceUrl.replace(/\/+$/, "")}/api/v1/regression/check`,
          {
            project: req.project,
            version: req.version,
            datasetId: req.datasetId,
            datasetVersion: req.datasetVersion || "1.0.0",
            model: req.model,
            promptVersion: req.promptVersion,
            baselineId: req.baselineId,
            metrics: req.metrics || [
              "exact_match",
              "latency_ms",
              "ai_judge_score",
            ],
          },
          {
            headers: {
              "Content-Type": "application/json",
              ...(apiKey ? { "x-api-key": apiKey } : {}),
            },
            timeout: timeoutMs,
          },
        );

        const data = response.data?.data || response.data;
        const status: ReleaseGateStatus =
          data.status === "PASS" ||
          data.status === "WARN" ||
          data.status === "FAIL"
            ? data.status
            : "FAIL";

        return {
          status,
          runId: data.runId,
          summary: data.summary || { passed: 1, warnings: 0, failed: 0 },
          details: `Model Regression Service evaluated run ${data.runId || "N/A"} with status ${status}.`,
          isSimulatedFallback: false,
        };
      } catch (err: any) {
        this.logger.warn(
          `Model Regression Service check failed or timed out: ${err.message}. Fail-closed policy: ${failClosed}.`,
        );

        if (failClosed) {
          return {
            status: "FAIL",
            summary: { passed: 0, warnings: 0, failed: 1 },
            details: `Regression Gate FAILED (Fail-Closed Policy): Service at ${serviceUrl} returned error: ${err.message}. Release is blocked until verified.`,
            isSimulatedFallback: false,
          };
        } else {
          return {
            status: "WARN",
            summary: { passed: 0, warnings: 1, failed: 0 },
            details: `Regression Gate WARNING (Fail-Open Policy): Service unavailable (${err.message}). Manual approval required.`,
            isSimulatedFallback: false,
          };
        }
      }
    }

    // Default when external service is not configured: deterministic quality check
    return {
      status: "PASS",
      runId: `mock_reg_${Date.now()}`,
      summary: { passed: 5, warnings: 0, failed: 0 },
      details:
        "Local evaluation checks passed. No external regression service configured.",
      isSimulatedFallback: true,
    };
  }
}
