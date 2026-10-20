import { Module } from "@nestjs/common";
import { EvaluationService } from "./evaluation.service";
import { EvaluationController } from "./evaluation.controller";
import { PromptsModule } from "../prompts/prompts.module";

@Module({
  imports: [PromptsModule],
  controllers: [EvaluationController],
  providers: [EvaluationService],
  exports: [EvaluationService],
})
export class EvaluationModule {}
