import { Module } from "@nestjs/common";
import { ApiKeyGuard } from "./api-key.guard";
import { OutboundController } from "./outbound.controller";
import { OutboundService } from "./outbound.service";
import { TemplateController } from "./template.controller";

@Module({
  controllers: [OutboundController, TemplateController],
  providers: [OutboundService, ApiKeyGuard],
})
export class OutboundModule {}
