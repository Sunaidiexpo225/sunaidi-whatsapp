import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { ApiKeyGuard } from "../outbound/api-key.guard";
import {
  CampaignService,
  type CreateCampaignResult,
  type StartCampaignResult,
} from "./campaign.service";

const createSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(1),
  templateName: z.string().trim().min(1),
  templateLanguage: z.string().trim().min(1),
  recipients: z
    .array(
      z.object({
        to: z.string().trim().min(1),
        components: z.array(z.unknown()).optional(),
      }),
    )
    .min(1),
});

/** Internal campaign API (dashboard/VDMS). Guarded by the shared API key. */
@UseGuards(ApiKeyGuard)
@Controller("campaigns")
export class CampaignController {
  constructor(private readonly campaigns: CampaignService) {}

  @Post()
  create(@Body() body: unknown): Promise<CreateCampaignResult> {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      throw new BadRequestException(`Invalid request: ${issues}`);
    }
    return this.campaigns.create(parsed.data);
  }

  @Post(":id/start")
  start(@Param("id") id: string): Promise<StartCampaignResult> {
    return this.campaigns.start(id);
  }
}
