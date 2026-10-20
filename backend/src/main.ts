import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import compression from "compression";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);

  // Security & Compression
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );
  app.use(compression());

  // CORS configuration
  app.enableCors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-api-key",
      "x-tenant-id",
      "x-user-id",
      "x-user-role",
      "x-user-name",
      "x-correlation-id",
      "x-request-id",
    ],
  });

  // Global Input Validation & Transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Filters & Interceptors
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Global API Prefix (excludes health & service discovery root)
  const apiPrefix = process.env.API_PREFIX || "api/v1";
  app.setGlobalPrefix(apiPrefix, {
    exclude: ["health", "health/ready", "health/live", "/"],
  });

  // Swagger OpenAPI Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle("AI Prompt Experiment & Release Manager API")
    .setDescription(
      "Full-stack platform API for prompt version management, deterministic A/B testing, offline evaluation runners, quality gates, and staged AI releases.",
    )
    .setVersion("1.0.0")
    .addApiKey({ type: "apiKey", name: "x-api-key", in: "header" }, "x-api-key")
    .addApiKey(
      { type: "apiKey", name: "x-tenant-id", in: "header" },
      "x-tenant-id",
    )
    .addTag(
      "Prompt Version Management",
      "Immutable prompt templates, variables, checksums, and lifecycle states",
    )
    .addTag(
      "Controlled Experiments & Bucketing",
      "Deterministic bucketing, Welch t-test analysis, and online outcome tracking",
    )
    .addTag(
      "Offline Evaluation & Datasets",
      "Benchmark datasets, test execution runner, and quality scoring",
    )
    .addTag(
      "Releases & Quality Gates",
      "Release policies, fail-closed external gates, staged rollouts, and 1-click rollback",
    )
    .addTag(
      "Audit Trail",
      "Immutable audit history of all lifecycle transitions and approvals",
    )
    .addTag(
      "Health & Service Discovery",
      "Kubernetes probes and service status",
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
  await app.listen(port, "0.0.0.0");

  logger.log(
    `🚀 AI Prompt Experiment Manager API running on: http://0.0.0.0:${port}/${apiPrefix}`,
  );
  logger.log(
    `📚 OpenAPI Documentation available at: http://0.0.0.0:${port}/api/docs`,
  );
  logger.log(`🩺 Health check accessible at: http://0.0.0.0:${port}/health`);
}

bootstrap();
