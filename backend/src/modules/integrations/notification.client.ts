import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";

export interface AlertNotificationPayload {
  tenantId: string;
  eventType:
    | "RELEASE_GATE_FAILED"
    | "RELEASE_APPROVED"
    | "ROLLBACK_TRIGGERED"
    | "EXPERIMENT_COMPLETED";
  title: string;
  message: string;
  recipientEmail?: string;
  recipientUserId?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationServiceClient {
  private readonly logger = new Logger(NotificationServiceClient.name);

  async sendReleaseAlert(payload: AlertNotificationPayload): Promise<boolean> {
    const serviceUrl = process.env.NOTIFICATION_SERVICE_URL;
    const apiKey = process.env.NOTIFICATION_SERVICE_API_KEY;
    const timeoutMs = parseInt(
      process.env.NOTIFICATION_TIMEOUT_MS || "3000",
      10,
    );

    if (!serviceUrl) {
      this.logger.debug(
        `Notification Service URL not configured. Skipped sending alert: [${payload.eventType}] ${payload.title}`,
      );
      return false;
    }

    try {
      await axios.post(
        `${serviceUrl.replace(/\/+$/, "")}/v1/notifications`,
        {
          priority: "CRITICAL",
          channels: ["EMAIL"],
          recipient: {
            userId: payload.recipientUserId || "lead-operator",
            email: payload.recipientEmail || "operator@enterprise.internal",
          },
          email: {
            subject: `[AI Prompt Release] ${payload.title}`,
            text: `${payload.message}\n\nTenant: ${payload.tenantId}\nEvent: ${payload.eventType}\nTimestamp: ${new Date().toISOString()}`,
          },
          metadata: {
            tenantId: payload.tenantId,
            eventType: payload.eventType,
            ...payload.metadata,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { "x-api-key": apiKey } : {}),
          },
          timeout: timeoutMs,
        },
      );
      this.logger.log(
        `Notification sent successfully for ${payload.eventType}`,
      );
      return true;
    } catch (err: any) {
      this.logger.warn(
        `Failed to send alert via Notification Service: ${err.message}. Release workflow continues unblocked.`,
      );
      return false;
    }
  }
}
