import { Module } from "@nestjs/common";
import { ApiKeyGuard } from "../outbound/api-key.guard";
import { AutomationsController } from "./automations.controller";
import { AutomationsService } from "./automations.service";

@Module({
  controllers: [AutomationsController],
  providers: [AutomationsService, ApiKeyGuard],
})
export class AutomationsModule {}
