import { Module } from "@nestjs/common";
import { ApiKeyGuard } from "../outbound/api-key.guard";
import { CampaignController } from "./campaign.controller";
import { CampaignService } from "./campaign.service";

@Module({
  controllers: [CampaignController],
  providers: [CampaignService, ApiKeyGuard],
})
export class CampaignModule {}
