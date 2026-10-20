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
import { PromptsService } from "./prompts.service";
import {
  CreatePromptDto,
  CreateVersionDto,
  TransitionVersionDto,
  RenderPromptDto,
} from "./dto/prompt.dto";
import {
  CurrentTenant,
  CurrentUser,
  PublicReadOnly,
  RequireRoles,
} from "../../common/decorators";
import { TenantAuthGuard } from "../../common/guards/auth.guard";

@ApiTags("Prompt Version Management")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Tenant identifier",
})
@UseGuards(TenantAuthGuard)
@Controller("prompts")
export class PromptsController {
  constructor(private readonly promptsService: PromptsService) {}

  @PublicReadOnly()
  @Get()
  @ApiOperation({ summary: "List prompts for tenant" })
  @ApiQuery({ name: "applicationId", required: false })
  @ApiResponse({ status: 200, description: "Prompts list retrieved" })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query("applicationId") applicationId?: string,
  ) {
    const list = await this.promptsService.findAll(tenantId, applicationId);
    return {
      success: true,
      count: list.length,
      data: list,
    };
  }

  @RequireRoles("editor", "approver", "admin")
  @Post()
  @ApiOperation({ summary: "Create a new prompt catalog entity" })
  @ApiResponse({ status: 201, description: "Prompt created successfully" })
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreatePromptDto,
  ) {
    const prompt = await this.promptsService.create(tenantId, dto, user.userId);
    return {
      success: true,
      data: prompt,
    };
  }

  @PublicReadOnly()
  @Get(":id")
  @ApiOperation({ summary: "Get prompt details and versions history" })
  @ApiParam({ name: "id", description: "Prompt identifier" })
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param("id") promptId: string,
  ) {
    const prompt = await this.promptsService.findOne(tenantId, promptId);
    return {
      success: true,
      data: prompt,
    };
  }

  @PublicReadOnly()
  @Get(":id/versions")
  @ApiOperation({ summary: "Get all versions of a prompt" })
  async getVersions(
    @CurrentTenant() tenantId: string,
    @Param("id") promptId: string,
  ) {
    await this.promptsService.findOne(tenantId, promptId);
    const versions = this.promptsService.getVersionsForPrompt(promptId);
    return {
      success: true,
      count: versions.length,
      data: versions,
    };
  }

  @RequireRoles("editor", "approver", "admin")
  @Post(":id/versions")
  @ApiOperation({ summary: "Commit an immutable new prompt version" })
  async createVersion(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param("id") promptId: string,
    @Body() dto: CreateVersionDto,
  ) {
    const version = await this.promptsService.createVersion(
      tenantId,
      promptId,
      dto,
      user.userId,
    );
    return {
      success: true,
      data: version,
    };
  }

  @PublicReadOnly()
  @Get(":id/versions/:versionId")
  @ApiOperation({ summary: "Get single version details with variables schema" })
  async findVersion(
    @CurrentTenant() tenantId: string,
    @Param("id") promptId: string,
    @Param("versionId") versionId: string,
  ) {
    const version = await this.promptsService.findVersion(
      tenantId,
      promptId,
      versionId,
    );
    return {
      success: true,
      data: version,
    };
  }

  @RequireRoles("editor", "approver", "admin")
  @Patch(":id/versions/:versionId/transition")
  @ApiOperation({
    summary:
      "Transition version lifecycle state (draft -> candidate -> approved -> active)",
  })
  async transitionState(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param("id") promptId: string,
    @Param("versionId") versionId: string,
    @Body() dto: TransitionVersionDto,
  ) {
    const updated = await this.promptsService.transitionState(
      tenantId,
      promptId,
      versionId,
      dto,
      user,
    );
    return {
      success: true,
      data: updated,
    };
  }

  @Post(":id/versions/:versionId/render")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Safely interpolate and render prompt with variables",
  })
  async renderPrompt(
    @CurrentTenant() tenantId: string,
    @Param("id") promptId: string,
    @Param("versionId") versionId: string,
    @Body() dto: RenderPromptDto,
  ) {
    const version = await this.promptsService.findVersion(
      tenantId,
      promptId,
      versionId,
    );
    const rendered = this.promptsService.renderPrompt(version, dto.variables);
    return {
      success: true,
      data: rendered,
    };
  }

  @PublicReadOnly()
  @Get(":id/diff")
  @ApiOperation({
    summary: "Compute line-by-line and parameter diff between two versions",
  })
  @ApiQuery({ name: "v1", required: true, description: "Baseline version ID" })
  @ApiQuery({
    name: "v2",
    required: true,
    description: "Comparison version ID",
  })
  async computeDiff(
    @CurrentTenant() tenantId: string,
    @Param("id") promptId: string,
    @Query("v1") v1: string,
    @Query("v2") v2: string,
  ) {
    const diff = await this.promptsService.computeDiff(
      tenantId,
      promptId,
      v1,
      v2,
    );
    return {
      success: true,
      data: diff,
    };
  }
}
