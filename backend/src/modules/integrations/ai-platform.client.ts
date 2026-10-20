import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";

export interface PromptExecutionParams {
  applicationId: string;
  tenantId: string;
  userId?: string;
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  model?: string;
  metadata?: Record<string, any>;
}

export interface ExecutionResult {
  answer: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  costUsd: number;
  latencyMs: number;
  isSimulated: boolean;
  provider: string;
}

@Injectable()
export class AiPlatformClient {
  private readonly logger = new Logger(AiPlatformClient.name);

  async executePrompt(params: PromptExecutionParams): Promise<ExecutionResult> {
    const aiPlatformUrl = process.env.AI_PLATFORM_URL;
    const apiKey = process.env.AI_PLATFORM_API_KEY;
    const timeoutMs = parseInt(
      process.env.AI_PLATFORM_TIMEOUT_MS || "5000",
      10,
    );

    const startTime = Date.now();

    if (aiPlatformUrl) {
      try {
        const response = await axios.post(
          `${aiPlatformUrl.replace(/\/+$/, "")}/api/v1/ai/chat`,
          {
            applicationId: params.applicationId,
            tenantId: params.tenantId,
            userId: params.userId || "eval-user",
            message: params.prompt,
            systemInstruction: params.systemInstruction,
            temperature: params.temperature ?? 0.7,
            useRag: false,
            useMemory: false,
            cacheable: false,
            metadata: params.metadata,
          },
          {
            headers: {
              "Content-Type": "application/json",
              ...(apiKey ? { "x-api-key": apiKey } : {}),
            },
            timeout: timeoutMs,
          },
        );

        const latencyMs = Date.now() - startTime;
        const data = response.data;

        // Pricing estimate: $0.0015 / 1k prompt, $0.002 / 1k completion
        const pTokens =
          data.usage?.promptTokens || Math.ceil(params.prompt.length / 4);
        const cTokens =
          data.usage?.completionTokens ||
          Math.ceil((data.answer?.length || 100) / 4);
        const costUsd = (pTokens * 0.0015 + cTokens * 0.002) / 1000;

        return {
          answer: data.answer || "",
          model: data.model || params.model || "gemini-1.5-pro",
          usage: {
            promptTokens: pTokens,
            completionTokens: cTokens,
            totalTokens: pTokens + cTokens,
          },
          costUsd: Number(costUsd.toFixed(6)),
          latencyMs: data.latencyMs || latencyMs,
          isSimulated: false,
          provider: "ai-platform",
        };
      } catch (err: any) {
        this.logger.warn(
          `AI Platform live call failed or timed out (${err.message}). Falling back to local offline evaluator.`,
        );
      }
    }

    // Deterministic High-Quality Fallback Simulation for offline evaluation / when AI Platform is offline
    const latencyMs = Math.floor(180 + Math.random() * 220);
    const promptLen = params.prompt.length;
    const pTokens = Math.max(12, Math.ceil(promptLen / 4));
    const cTokens = Math.max(25, Math.ceil(pTokens * 1.4));
    const costUsd = (pTokens * 0.0015 + cTokens * 0.002) / 1000;

    // Generate context-aware simulated answer based on prompt keywords
    const lowerPrompt = params.prompt.toLowerCase();
    let simulatedAnswer = `[Evaluated Output] Processed request for tenant ${params.tenantId}.`;

    if (lowerPrompt.includes("refund") || lowerPrompt.includes("support")) {
      simulatedAnswer = `Thank you for contacting customer support. We have verified your request. We are pleased to assist with your eligible refund inquiry under our terms. Please reply if you need further help.`;
    } else if (lowerPrompt.includes("code") || lowerPrompt.includes("review")) {
      simulatedAnswer = `Code Review Findings:\n1. All inputs are properly validated against sanitization rules.\n2. Exception boundaries are respected.\n3. Complexity score is within acceptable limits. Approved.`;
    } else if (
      lowerPrompt.includes("summarize") ||
      lowerPrompt.includes("extract")
    ) {
      simulatedAnswer = `Summary: The key obligations include mutual confidentiality, standard indemnification clauses, and SLA adherence with 99.9% uptime requirement.`;
    } else {
      simulatedAnswer = `Successfully processed instruction: "${params.prompt.slice(0, 60)}..." with calibrated system guidance.`;
    }

    return {
      answer: simulatedAnswer,
      model: params.model || "gemini-1.5-flash-simulated",
      usage: {
        promptTokens: pTokens,
        completionTokens: cTokens,
        totalTokens: pTokens + cTokens,
      },
      costUsd: Number(costUsd.toFixed(6)),
      latencyMs,
      isSimulated: true,
      provider: "local-evaluation-engine",
    };
  }
}
