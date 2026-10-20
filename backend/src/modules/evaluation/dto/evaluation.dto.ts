import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsObject,
  IsBoolean,
} from "class-validator";
import { Type } from "class-transformer";

export class TestCaseDto {
  @ApiPropertyOptional({ example: "case_01" })
  @IsString()
  @IsOptional()
  caseId?: string;

  @ApiProperty({
    example: {
      customer_name: "Sarah Connor",
      issue_summary: "Damaged item received on order #9281",
      product_name: "Titanium Watch",
    },
  })
  @IsObject()
  inputVariables: Record<string, any>;

  @ApiPropertyOptional({
    example:
      "We apologize for the damaged item received. We have initiated a replacement.",
  })
  @IsString()
  @IsOptional()
  referenceOutput?: string;

  @ApiPropertyOptional({
    example:
      "Must express empathy, acknowledge damaged item, and offer solution.",
  })
  @IsString()
  @IsOptional()
  evaluationRubric?: string;

  @ApiPropertyOptional({ example: ["billing", "damaged-goods", "critical"] })
  @IsArray()
  @IsOptional()
  tags?: string[];
}

export class CreateDatasetDto {
  @ApiProperty({ example: "customer-support-golden-eval-v1" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: "customer-support-agent" })
  @IsString()
  @IsNotEmpty()
  applicationId: string;

  @ApiProperty({ example: "1.0.0" })
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiPropertyOptional({
    example: "Curated 50 benchmark cases for customer support concierges",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ type: [TestCaseDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  testCases: TestCaseDto[];
}

export class RunEvaluationDto {
  @ApiProperty({ example: "ds_support_eval_1" })
  @IsString()
  @IsNotEmpty()
  datasetId: string;

  @ApiProperty({ example: "pmt_support_1" })
  @IsString()
  @IsNotEmpty()
  promptId: string;

  @ApiProperty({ example: "ver_candidate_2" })
  @IsString()
  @IsNotEmpty()
  promptVersionId: string;

  @ApiPropertyOptional({
    example: false,
    description: "Force simulated run even if live API is connected",
  })
  @IsBoolean()
  @IsOptional()
  forceSimulation?: boolean;
}
