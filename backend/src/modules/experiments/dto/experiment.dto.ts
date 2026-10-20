import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEnum,
  IsNumber,
  IsBoolean,
  ValidateNested,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import { ExperimentStatus } from "../../../common/types";

export class TrafficVariantDto {
  @ApiProperty({ example: "ver_12345" })
  @IsString()
  @IsNotEmpty()
  versionId: string;

  @ApiProperty({ example: "control" })
  @IsString()
  @IsNotEmpty()
  variantName: string;

  @ApiProperty({ example: 50, minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage: number;
}

export class ExperimentObjectiveDto {
  @ApiProperty({
    example: "quality_score",
    enum: [
      "latency_ms",
      "cost_usd",
      "quality_score",
      "exact_match_rate",
      "error_rate",
    ],
  })
  @IsEnum([
    "latency_ms",
    "cost_usd",
    "quality_score",
    "exact_match_rate",
    "error_rate",
  ])
  metric:
    | "latency_ms"
    | "cost_usd"
    | "quality_score"
    | "exact_match_rate"
    | "error_rate";

  @ApiProperty({ example: "higher", enum: ["lower", "higher"] })
  @IsEnum(["lower", "higher"])
  direction: "lower" | "higher";

  @ApiPropertyOptional({ example: 10, description: "Target percentage change" })
  @IsNumber()
  @IsOptional()
  targetDeltaPct?: number;

  @ApiPropertyOptional({ example: 0.9 })
  @IsNumber()
  @IsOptional()
  targetThreshold?: number;

  @ApiPropertyOptional({
    example:
      "Improve customer care response helpfulness without increasing p95 latency",
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateExperimentDto {
  @ApiProperty({ example: "Support Concierge v1.1 Few-Shot A/B Test" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: "customer-support-agent" })
  @IsString()
  @IsNotEmpty()
  applicationId: string;

  @ApiProperty({ example: "pmt_support_1" })
  @IsString()
  @IsNotEmpty()
  promptId: string;

  @ApiPropertyOptional({
    example: "Evaluating v1.1 few-shot prompt against v1.0 zero-shot baseline",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: "ver_baseline_1" })
  @IsString()
  @IsNotEmpty()
  controlVersionId: string;

  @ApiProperty({ example: ["ver_candidate_2"] })
  @IsArray()
  @IsNotEmpty()
  candidateVersionIds: string[];

  @ApiProperty({ type: [TrafficVariantDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrafficVariantDto)
  variants: TrafficVariantDto[];

  @ApiProperty({ type: [ExperimentObjectiveDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperimentObjectiveDto)
  objectives: ExperimentObjectiveDto[];
}

export class PreviewAssignmentDto {
  @ApiProperty({
    example: "user_48291",
    description: "Subject or session identifier to bucket",
  })
  @IsString()
  @IsNotEmpty()
  subjectId: string;
}

export class RecordOutcomeMetricsDto {
  @ApiPropertyOptional({ example: 345 })
  @IsNumber()
  @IsOptional()
  latencyMs?: number;

  @ApiPropertyOptional({ example: 0.0024 })
  @IsNumber()
  @IsOptional()
  costUsd?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  exactMatch?: boolean;

  @ApiPropertyOptional({ example: 0.94, minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  qualityScore?: number;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  error?: boolean;
}

export class RecordOutcomeDto {
  @ApiProperty({ example: "user_48291" })
  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @ApiProperty({ example: "ver_candidate_2" })
  @IsString()
  @IsNotEmpty()
  versionId: string;

  @ApiProperty({ example: "candidate_v2" })
  @IsString()
  @IsNotEmpty()
  variantName: string;

  @ApiProperty({ type: RecordOutcomeMetricsDto })
  @ValidateNested()
  @Type(() => RecordOutcomeMetricsDto)
  metrics: RecordOutcomeMetricsDto;

  @ApiPropertyOptional({ example: { browser: "Chrome", country: "US" } })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    example: "online_telemetry",
    enum: ["online_telemetry", "offline_eval"],
  })
  @IsEnum(["online_telemetry", "offline_eval"])
  @IsOptional()
  source?: "online_telemetry" | "offline_eval";
}

export class UpdateExperimentStatusDto {
  @ApiProperty({
    example: "running",
    enum: ["draft", "running", "paused", "completed", "rolled_back"],
  })
  @IsEnum(["draft", "running", "paused", "completed", "rolled_back"])
  status: ExperimentStatus;

  @ApiPropertyOptional({
    example: "Started A/B test run for 50/50 split cohort",
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
