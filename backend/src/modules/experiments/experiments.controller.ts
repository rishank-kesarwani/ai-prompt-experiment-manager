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
import { ExperimentsService } from "./experiments.service";
import {
  CreateExperimentDto,
  PreviewAssignmentDto,
  RecordOutcomeDto,
  UpdateExperimentStatusDto,
} from "./dto/experiment.dto";
import {
  CurrentTenant,
  CurrentUser,
  PublicReadOnly,
  RequireRoles,
} from "../../common/decorators";
import { TenantAuthGuard } from "../../common/guards/auth.guard";

@ApiTags("Controlled Experiments & Bucketing")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Tenant identifier",
})
@UseGuards(TenantAuthGuard)
@Controller("experiments")
export class ExperimentsController {
  constructor(private readonly experimentsService: ExperimentsService) {}

  @PublicReadOnly()
  @Get()
  @ApiOperation({ summary: "List all experiments for tenant" })
  @ApiQuery({ name: "applicationId", required: false })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query("applicationId") applicationId?: string,
  ) {
    const list = await this.experimentsService.findAll(tenantId, applicationId);
    return {
      success: true,
      count: list.length,
      data: list,
    };
  }

  @RequireRoles("editor", "approver", "admin")
  @Post()
  @ApiOperation({ summary: "Create new A/B prompt experiment" })
  @ApiResponse({ status: 201, description: "Experiment created successfully" })
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateExperimentDto,
  ) {
    const exp = await this.experimentsService.create(
      tenantId,
      dto,
      user.userId,
    );
    return {
      success: true,
      data: exp,
    };
  }

  @PublicReadOnly()
  @Get(":id")
  @ApiOperation({ summary: "Get experiment configuration and status" })
  @ApiParam({ name: "id", description: "Experiment identifier" })
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param("id") experimentId: string,
  ) {
    const exp = await this.experimentsService.findOne(tenantId, experimentId);
    return {
      success: true,
      data: exp,
    };
  }

  @RequireRoles("editor", "approver", "admin")
  @Patch(":id/status")
  @ApiOperation({
    summary:
      "Update experiment state (running, paused, completed, rolled_back)",
  })
  async updateStatus(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param("id") experimentId: string,
    @Body() dto: UpdateExperimentStatusDto,
  ) {
    const updated = await this.experimentsService.updateStatus(
      tenantId,
      experimentId,
      dto,
      user.userId,
    );
    return {
      success: true,
      data: updated,
    };
  }

  @Post(":id/preview-assignment")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Preview deterministic variant assignment for a subject without recording outcome",
  })
  async previewAssignment(
    @CurrentTenant() tenantId: string,
    @Param("id") experimentId: string,
    @Body() dto: PreviewAssignmentDto,
  ) {
    const experiment = await this.experimentsService.findOne(
      tenantId,
      experimentId,
    );
    const result = this.experimentsService.previewAssignment(
      experiment,
      dto.subjectId,
    );
    return {
      success: true,
      data: result,
    };
  }

  @Post(":id/assign")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Live deterministic assignment for an incoming production subject",
  })
  async assign(
    @CurrentTenant() tenantId: string,
    @Param("id") experimentId: string,
    @Body() dto: PreviewAssignmentDto,
  ) {
    const experiment = await this.experimentsService.findOne(
      tenantId,
      experimentId,
    );
    const result = this.experimentsService.assign(experiment, dto.subjectId);
    return {
      success: true,
      data: result,
    };
  }

  @Post(":id/outcomes")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Ingest online experiment outcome (authorized telemetry)",
  })
  async recordOutcome(
    @CurrentTenant() tenantId: string,
    @Param("id") experimentId: string,
    @Body() dto: RecordOutcomeDto,
  ) {
    const outcome = await this.experimentsService.recordOutcome(
      tenantId,
      experimentId,
      dto,
    );
    return {
      success: true,
      data: outcome,
    };
  }

  @PublicReadOnly()
  @Get(":id/analysis")
  @ApiOperation({
    summary:
      "Get statistical analysis with sample size, Welch t-test, 95% CI, and release recommendation",
  })
  async getAnalysis(
    @CurrentTenant() tenantId: string,
    @Param("id") experimentId: string,
  ) {
    const analysis = await this.experimentsService.analyzeExperiment(
      tenantId,
      experimentId,
    );
    return {
      success: true,
      data: analysis,
    };
  }
}
