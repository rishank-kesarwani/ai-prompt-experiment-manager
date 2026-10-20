import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { AuditService } from "./audit.service";
import { CurrentTenant, PublicReadOnly } from "../../common/decorators";
import { TenantAuthGuard } from "../../common/guards/auth.guard";
import { AuditEvent } from "../../common/types";

@ApiTags("Audit Trail")
@ApiHeader({ name: "x-tenant-id", required: false })
@UseGuards(TenantAuthGuard)
@Controller("audit")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @PublicReadOnly()
  @Get()
  @ApiOperation({ summary: "List immutable audit events for tenant" })
  @ApiResponse({ status: 200, description: "Audit events returned" })
  findAll(
    @CurrentTenant() tenantId: string,
    @Query("resourceType") resourceType?: AuditEvent["resourceType"],
    @Query("resourceId") resourceId?: string,
    @Query("limit") limit?: number,
  ) {
    const events = this.auditService.findAll(tenantId, {
      resourceType,
      resourceId,
      limit: limit ? Number(limit) : 50,
    });
    return {
      success: true,
      count: events.length,
      data: events,
    };
  }
}
