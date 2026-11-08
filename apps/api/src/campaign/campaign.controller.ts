import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ConsentStatus } from "@sunaidi/db";
import { z } from "zod";
import { ApiKeyGuard } from "../outbound/api-key.guard";
import {
  CampaignService,
  type CampaignRow,
  type CreateCampaignResult,
  type StartCampaignResult,
} from "./campaign.service";

const createSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(1),
  templateName: z.string().trim().min(1),
  templateLanguage: z.string().trim().min(1),
  scheduledAt: z.string().datetime().optional(),
  recipients: z
    .array(
      z.object({
        to: z.string().trim().min(1),
        components: z.array(z.unknown()).optional(),
      }),
    )
    .min(1),
});

const audienceSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(1),
  templateName: z.string().trim().min(1),
  templateLanguage: z.string().trim().min(1),
  consent: z.nativeEnum(ConsentStatus).optional(),
  tagId: z.string().trim().min(1).optional(),
  scheduledAt: z.string().datetime().optional(),
});

const CONSENT_VALUES = Object.values(ConsentStatus) as string[];

@Controller("campaigns")
export class CampaignController {
  constructor(private readonly campaigns: CampaignService) {}

  @Get()
  list(): Promise<CampaignRow[]> {
    return this.campaigns.list();
  }

  @Get("audience/preview")
  previewAudience(
    @Query("eventId") eventId: string,
    @Query("consent") consent?: string,
    @Query("tagId") tagId?: string,
  ): Promise<{ count: number }> {
    if (!eventId) throw new BadRequestException("eventId is required");
    let consentFilter: ConsentStatus | undefined;
    if (consent) {
      if (!CONSENT_VALUES.includes(consent)) {
        throw new BadRequestException(`Invalid consent filter: ${consent}`);
      }
      consentFilter = consent as ConsentStatus;
    }
    return this.campaigns.previewAudience(eventId, { consent: consentFilter, tagId });
  }

  @UseGuards(ApiKeyGuard)
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

  @UseGuards(ApiKeyGuard)
  @Post("audience")
  createFromAudience(@Body() body: unknown): Promise<CreateCampaignResult> {
    const parsed = audienceSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      throw new BadRequestException(`Invalid request: ${issues}`);
    }
    return this.campaigns.createFromAudience(parsed.data);
  }

  @UseGuards(ApiKeyGuard)
  @Post(":id/start")
  start(@Param("id") id: string): Promise<StartCampaignResult> {
    return this.campaigns.start(id);
  }
}
