import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AuditModule } from "./modules/audit/audit.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";
import { PromptsModule } from "./modules/prompts/prompts.module";
import { ExperimentsModule } from "./modules/experiments/experiments.module";
import { EvaluationModule } from "./modules/evaluation/evaluation.module";
import { ReleasesModule } from "./modules/releases/releases.module";
import { SeedModule } from "./modules/seed/seed.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../.env"],
    }),
    AuditModule,
    IntegrationsModule,
    PromptsModule,
    ExperimentsModule,
    EvaluationModule,
    ReleasesModule,
    SeedModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
