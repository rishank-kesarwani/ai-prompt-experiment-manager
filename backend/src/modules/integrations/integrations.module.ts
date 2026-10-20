import { Module, Global } from "@nestjs/common";
import { AiPlatformClient } from "./ai-platform.client";
import { ModelRegressionClient } from "./model-regression.client";
import { NotificationServiceClient } from "./notification.client";

@Global()
@Module({
  providers: [
    AiPlatformClient,
    ModelRegressionClient,
    NotificationServiceClient,
  ],
  exports: [AiPlatformClient, ModelRegressionClient, NotificationServiceClient],
})
export class IntegrationsModule {}
