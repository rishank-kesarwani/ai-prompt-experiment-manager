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
import { LifecycleState } from "../../../common/types";

export class PromptVariableDto {
  @ApiProperty({ example: "customer_name" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: "string",
    enum: ["string", "number", "boolean", "json"],
  })
  @IsEnum(["string", "number", "boolean", "json"])
  type: "string" | "number" | "boolean" | "json";

  @ApiProperty({ example: true })
  @IsBoolean()
  required: boolean;

  @ApiPropertyOptional({ example: "Valued Customer" })
  @IsString()
  @IsOptional()
  defaultValue?: string;

  @ApiPropertyOptional({
    example: "Full name of the user requesting assistance",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: "^[A-Za-z ]+$" })
  @IsString()
  @IsOptional()
  validationRegex?: string;
}

export class ModelParametersDto {
  @ApiProperty({ example: "gemini-1.5-pro" })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({ example: "google-vertex" })
  @IsString()
  @IsNotEmpty()
  provider: string;

  @ApiProperty({ example: 0.7, minimum: 0, maximum: 2 })
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature: number;

  @ApiPropertyOptional({ example: 1024 })
  @IsNumber()
  @IsOptional()
  maxTokens?: number;

  @ApiPropertyOptional({ example: 0.95 })
  @IsNumber()
  @IsOptional()
  topP?: number;

  @ApiPropertyOptional({ example: ["\nUser:"] })
  @IsArray()
  @IsOptional()
  stopSequences?: string[];
}

export class CreateVersionDto {
  @ApiProperty({ example: "1.0.0" })
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiProperty({
    example:
      "Hello {{customer_name}}, thank you for reaching out regarding {{issue_summary}}. How can I assist you with {{product_name}} today?",
  })
  @IsString()
  @IsNotEmpty()
  template: string;

  @ApiPropertyOptional({
    example: "You are a warm, professional customer care expert.",
  })
  @IsString()
  @IsOptional()
  systemInstruction?: string;

  @ApiPropertyOptional({ type: [PromptVariableDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromptVariableDto)
  @IsOptional()
  variables?: PromptVariableDto[];

  @ApiProperty({ type: ModelParametersDto })
  @ValidateNested()
  @Type(() => ModelParametersDto)
  parameters: ModelParametersDto;

  @ApiProperty({ example: "Initial production baseline template" })
  @IsString()
  @IsNotEmpty()
  changelog: string;

  @ApiPropertyOptional({ example: "lead_engineer@internal" })
  @IsString()
  @IsOptional()
  author?: string;
}

export class CreatePromptDto {
  @ApiProperty({ example: "customer-support-concierge" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: "customer-support-agent" })
  @IsString()
  @IsNotEmpty()
  applicationId: string;

  @ApiPropertyOptional({
    example:
      "Primary conversational prompt for resolving customer care tickets",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: ["support", "tier1", "customer-care"] })
  @IsArray()
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ type: CreateVersionDto })
  @ValidateNested()
  @Type(() => CreateVersionDto)
  @IsOptional()
  initialVersion?: CreateVersionDto;
}

export class TransitionVersionDto {
  @ApiProperty({
    example: "candidate",
    enum: ["draft", "candidate", "approved", "active", "archived"],
  })
  @IsEnum(["draft", "candidate", "approved", "active", "archived"])
  targetState: LifecycleState;

  @ApiPropertyOptional({
    example: "All regression tests passed with zero regressions.",
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    example: 1,
    description: "Expected revision for optimistic concurrency",
  })
  @IsNumber()
  @IsOptional()
  expectedRevision?: number;
}

export class RenderPromptDto {
  @ApiProperty({
    example: {
      customer_name: "Alice Smith",
      issue_summary: "Billing inquiry",
      product_name: "Cloud Pro",
    },
  })
  variables: Record<string, any>;
}
