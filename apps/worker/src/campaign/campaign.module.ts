import { Module } from "@nestjs/common";
import { CampaignProcessor } from "./campaign.processor";
import { CampaignService } from "./campaign.service";

@Module({
  providers: [CampaignService, CampaignProcessor],
})
export class CampaignModule {}
