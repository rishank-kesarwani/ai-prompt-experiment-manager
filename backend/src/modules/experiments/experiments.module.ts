import { Module } from "@nestjs/common";
import { ExperimentsService } from "./experiments.service";
import { ExperimentsController } from "./experiments.controller";
import { PromptsModule } from "../prompts/prompts.module";

@Module({
  imports: [PromptsModule],
  controllers: [ExperimentsController],
  providers: [ExperimentsService],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}
