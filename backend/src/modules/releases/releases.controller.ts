import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { ReleasesService } from "./releases.service";
import {
  CreateReleaseDecisionDto,
  EvaluateGatesDto,
  ApproveReleaseDto,
  UpdateRolloutDto,
  RollbackReleaseDto,
} from "./dto/release.dto";
import {
  CurrentTenant,
  CurrentUser,
  PublicReadOnly,
  RequireRoles,
} from "../../common/decorators";
import { TenantAuthGuard } from "../../common/guards/auth.guard";

@ApiTags("Releases & Quality Gates")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Tenant identifier",
})
@UseGuards(TenantAuthGuard)
@Controller("releases")
export class ReleasesController {
  constructor(private readonly releasesService: ReleasesService) {}

  @PublicReadOnly()
  @Get()
  @ApiOperation({ summary: "List all release proposals and active releases" })
  @ApiQuery({ name: "applicationId", required: false })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query("applicationId") applicationId?: string,
  ) {
    const list = await this.releasesService.findAll(tenantId, applicationId);
    return {
      success: true,
      count: list.length,
      data: list,
    };
  }

  @RequireRoles("editor", "approver", "admin")
  @Post()
  @ApiOperation({
    summary: "Propose a new release candidate with quality gates",
  })
  @ApiResponse({ status: 201, description: "Release proposal created" })
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateReleaseDecisionDto,
  ) {
    const release = await this.releasesService.create(
      tenantId,
      dto,
      user.userId,
    );
    return {
      success: true,
      data: release,
    };
  }

  @PublicReadOnly()
  @Get(":id")
  @ApiOperation({
    summary: "Get release proposal, gate checks, and rollout status",
  })
  @ApiParam({ name: "id", description: "Release identifier" })
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param("id") releaseId: string,
  ) {
    const release = await this.releasesService.findOne(tenantId, releaseId);
    return {
      success: true,
      data: release,
    };
  }

  @RequireRoles("editor", "approver", "admin")
  @Post(":id/evaluate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Evaluate automated quality gates against latency, cost, and regression service",
  })
  async evaluateGates(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param("id") releaseId: string,
    @Body() dto: EvaluateGatesDto,
  ) {
    const release = await this.releasesService.evaluateGates(
      tenantId,
      releaseId,
      dto,
      user.userId,
    );
    return {
      success: true,
      data: release,
    };
  }

  @RequireRoles("approver", "admin")
  @Post(":id/approve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Approve release and initiate staged/full rollout" })
  async approveRelease(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param("id") releaseId: string,
    @Body() dto: ApproveReleaseDto,
  ) {
    const release = await this.releasesService.approveRelease(
      tenantId,
      releaseId,
      dto,
      user,
    );
    return {
      success: true,
      data: release,
    };
  }

  @RequireRoles("approver", "admin")
  @Patch(":id/rollout")
  @ApiOperation({
    summary: "Adjust staged rollout percentage (e.g. 10% -> 50% -> 100%)",
  })
  async updateRollout(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param("id") releaseId: string,
    @Body() dto: UpdateRolloutDto,
  ) {
    const release = await this.releasesService.updateRollout(
      tenantId,
      releaseId,
      dto,
      user,
    );
    return {
      success: true,
      data: release,
    };
  }

  @RequireRoles("approver", "admin")
  @Post(":id/rollback")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "1-Click auditable rollback: instantly reverts active traffic to baseline version",
  })
  async rollback(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param("id") releaseId: string,
    @Body() dto: RollbackReleaseDto,
  ) {
    const release = await this.releasesService.rollback(
      tenantId,
      releaseId,
      dto,
      user,
    );
    return {
      success: true,
      data: release,
    };
  }
}
