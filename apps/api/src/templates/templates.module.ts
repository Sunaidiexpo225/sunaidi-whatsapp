import { Module } from "@nestjs/common";
import { ApiKeyGuard } from "../outbound/api-key.guard";
import { TemplatesController } from "./templates.controller";
import { TemplatesService } from "./templates.service";

@Module({
  controllers: [TemplatesController],
  providers: [TemplatesService, ApiKeyGuard],
})
export class TemplatesModule {}
