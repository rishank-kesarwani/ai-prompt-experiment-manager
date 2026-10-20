import { Module } from "@nestjs/common";
import { SeedService } from "./seed.service";
import { PromptsModule } from "../prompts/prompts.module";
import { ExperimentsModule } from "../experiments/experiments.module";
import { EvaluationModule } from "../evaluation/evaluation.module";
import { ReleasesModule } from "../releases/releases.module";

@Module({
  imports: [PromptsModule, ExperimentsModule, EvaluationModule, ReleasesModule],
  providers: [SeedService],
})
export class SeedModule {}
