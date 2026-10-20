import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { EvaluationService } from "./evaluation.service";
import { CreateDatasetDto, RunEvaluationDto } from "./dto/evaluation.dto";
import {
  CurrentTenant,
  CurrentUser,
  PublicReadOnly,
  RequireRoles,
} from "../../common/decorators";
import { TenantAuthGuard } from "../../common/guards/auth.guard";

@ApiTags("Offline Evaluation & Datasets")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Tenant identifier",
})
@UseGuards(TenantAuthGuard)
@Controller("evaluations")
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @PublicReadOnly()
  @Get("datasets")
  @ApiOperation({ summary: "List versioned benchmark datasets" })
  @ApiQuery({ name: "applicationId", required: false })
  async findAllDatasets(
    @CurrentTenant() tenantId: string,
    @Query("applicationId") applicationId?: string,
  ) {
    const list = await this.evaluationService.findAllDatasets(
      tenantId,
      applicationId,
    );
    return {
      success: true,
      count: list.length,
      data: list,
    };
  }

  @RequireRoles("editor", "approver", "admin")
  @Post("datasets")
  @ApiOperation({ summary: "Create versioned evaluation dataset" })
  @ApiResponse({ status: 201, description: "Dataset created" })
  async createDataset(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateDatasetDto,
  ) {
    const ds = await this.evaluationService.createDataset(
      tenantId,
      dto,
      user.userId,
    );
    return {
      success: true,
      data: ds,
    };
  }

  @PublicReadOnly()
  @Get("datasets/:id")
  @ApiOperation({ summary: "Get dataset details and test cases" })
  @ApiParam({ name: "id", description: "Dataset identifier" })
  async findDataset(
    @CurrentTenant() tenantId: string,
    @Param("id") datasetId: string,
  ) {
    const ds = await this.evaluationService.findDataset(tenantId, datasetId);
    return {
      success: true,
      data: ds,
    };
  }

  @RequireRoles("editor", "approver", "admin")
  @Post("run")
  @ApiOperation({
    summary: "Execute offline evaluation runner across dataset test cases",
  })
  async runEvaluation(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: RunEvaluationDto,
  ) {
    const run = await this.evaluationService.runEvaluation(
      tenantId,
      dto,
      user.userId,
    );
    return {
      success: true,
      data: run,
    };
  }

  @PublicReadOnly()
  @Get("runs")
  @ApiOperation({ summary: "List historical evaluation runs" })
  @ApiQuery({ name: "promptVersionId", required: false })
  async findAllRuns(
    @CurrentTenant() tenantId: string,
    @Query("promptVersionId") promptVersionId?: string,
  ) {
    const runs = await this.evaluationService.findAllRuns(
      tenantId,
      promptVersionId,
    );
    return {
      success: true,
      count: runs.length,
      data: runs,
    };
  }

  @PublicReadOnly()
  @Get("runs/:id")
  @ApiOperation({
    summary: "Get evaluation run details and per-case output breakdown",
  })
  async findRun(@CurrentTenant() tenantId: string, @Param("id") runId: string) {
    const run = await this.evaluationService.findRun(tenantId, runId);
    return {
      success: true,
      data: run,
    };
  }
}
