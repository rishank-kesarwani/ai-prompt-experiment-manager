import { Injectable, Logger } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { AuditEvent } from "../../common/types";

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly events: AuditEvent[] = [];

  record(
    tenantId: string,
    actor: string,
    action: string,
    resourceType: AuditEvent["resourceType"],
    resourceId: string,
    details: Record<string, any> = {},
  ): AuditEvent {
    // Sanitize any potential secret or token in audit log
    const sanitizedDetails = this.sanitizeDetails(details);

    const event: AuditEvent = {
      id: `evt_${uuidv4().replace(/-/g, "").slice(0, 12)}`,
      tenantId,
      actor,
      action,
      resourceType,
      resourceId,
      details: sanitizedDetails,
      timestamp: new Date().toISOString(),
    };

    this.events.unshift(event); // Most recent first
    this.logger.log(
      `[AUDIT] tenant=${tenantId} actor=${actor} action=${action} resource=${resourceType}:${resourceId}`,
    );

    return event;
  }

  findAll(
    tenantId: string,
    options?: {
      resourceType?: AuditEvent["resourceType"];
      resourceId?: string;
      limit?: number;
    },
  ): AuditEvent[] {
    let list = this.events.filter((e) => e.tenantId === tenantId);

    if (options?.resourceType) {
      list = list.filter((e) => e.resourceType === options.resourceType);
    }
    if (options?.resourceId) {
      list = list.filter((e) => e.resourceId === options.resourceId);
    }

    const limit = options?.limit || 100;
    return list.slice(0, limit);
  }

  private sanitizeDetails(obj: any): any {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map((i) => this.sanitizeDetails(i));

    const sanitized: Record<string, any> = {};
    const sensitiveKeys = [
      "secret",
      "token",
      "key",
      "password",
      "authorization",
    ];

    for (const [k, v] of Object.entries(obj)) {
      if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
        sanitized[k] = "[REDACTED]";
      } else if (typeof v === "object" && v !== null) {
        sanitized[k] = this.sanitizeDetails(v);
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }
}
