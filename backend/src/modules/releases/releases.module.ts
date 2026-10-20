import { Module } from "@nestjs/common";
import { ReleasesService } from "./releases.service";
import { ReleasesController } from "./releases.controller";
import { PromptsModule } from "../prompts/prompts.module";
import { EvaluationModule } from "../evaluation/evaluation.module";

@Module({
  imports: [PromptsModule, EvaluationModule],
  controllers: [ReleasesController],
  providers: [ReleasesService],
  exports: [ReleasesService],
})
export class ReleasesModule {}
