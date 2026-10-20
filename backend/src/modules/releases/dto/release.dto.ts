import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from "class-validator";
import { ReleaseGateStatus } from "../../../common/types";

export class ReleaseRuleDto {
  @ApiProperty({ example: "rule_latency_p95" })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ example: "Max p95 Latency 800ms" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: "latency",
    enum: ["latency", "cost", "quality", "regression_check", "manual_approval"],
  })
  @IsEnum(["latency", "cost", "quality", "regression_check", "manual_approval"])
  type: "latency" | "cost" | "quality" | "regression_check" | "manual_approval";

  @ApiProperty({ example: 800 })
  @IsNumber()
  threshold: number;

  @ApiProperty({ example: "<=", enum: ["<=", ">=", "=="] })
  @IsEnum(["<=", ">=", "=="])
  operator: "<=" | ">=" | "==";

  @ApiProperty({ example: "FAIL", enum: ["PASS", "WARN", "FAIL"] })
  @IsEnum(["PASS", "WARN", "FAIL"])
  behavior: ReleaseGateStatus;

  @ApiPropertyOptional({
    example: "Ensures customer experience remains responsive under SLA",
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateReleaseDecisionDto {
  @ApiProperty({ example: "pmt_support_1" })
  @IsString()
  @IsNotEmpty()
  promptId: string;

  @ApiProperty({ example: "ver_candidate_2" })
  @IsString()
  @IsNotEmpty()
  targetVersionId: string;

  @ApiProperty({ example: "customer-support-agent" })
  @IsString()
  @IsNotEmpty()
  applicationId: string;

  @ApiPropertyOptional({ type: [ReleaseRuleDto] })
  @IsArray()
  @IsOptional()
  rules?: ReleaseRuleDto[];
}

export class EvaluateGatesDto {
  @ApiPropertyOptional({ example: "ds_support_eval_1" })
  @IsString()
  @IsOptional()
  datasetId?: string;

  @ApiPropertyOptional({ example: "exp_ab_test_1" })
  @IsString()
  @IsOptional()
  experimentId?: string;

  @ApiPropertyOptional({ example: "ver_baseline_1" })
  @IsString()
  @IsOptional()
  baselineVersionId?: string;
}

export class ApproveReleaseDto {
  @ApiProperty({
    example:
      "Approved for production rollout after comprehensive offline eval and CI checks.",
  })
  @IsString()
  @IsNotEmpty()
  notes: string;

  @ApiPropertyOptional({
    example: 100,
    minimum: 0,
    maximum: 100,
    description: "Rollout percentage",
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  rolloutPercentage?: number;
}

export class UpdateRolloutDto {
  @ApiProperty({ example: 50, minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  rolloutPercentage: number;

  @ApiPropertyOptional({
    example: "Promoted from 25% canary to 50% traffic cohort",
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class RollbackReleaseDto {
  @ApiProperty({
    example: "Latent customer confusion detected on mobile checkout flows",
  })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({
    example: "ver_baseline_1",
    description: "Explicit version to rollback to",
  })
  @IsString()
  @IsOptional()
  targetVersionId?: string;
}
