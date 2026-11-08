import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CampaignStatus, Prisma, type PrismaClient } from "@sunaidi/db";
import { Queue } from "bullmq";
import { PRISMA } from "../db/prisma.module";
import { CAMPAIGN_SEND_QUEUE, type CampaignSendJob } from "../queue/queue.constants";

export interface CampaignRecipientInput {
  /** Recipient phone in E.164 (no +), e.g. 9665XXXXXXXX. */
  to: string;
  /** Graph API template components for this recipient (per-recipient variables). */
  components?: unknown[];
}

export interface CreateCampaignInput {
  eventId: string;
  name: string;
  templateName: string;
  templateLanguage: string;
  recipients: CampaignRecipientInput[];
}

export interface CreateCampaignResult {
  id: string;
  status: string;
  recipientCount: number;
}

export interface StartCampaignResult {
  id: string;
  status: string;
  queued: number;
}

@Injectable()
export class CampaignService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(CAMPAIGN_SEND_QUEUE) private readonly queue: Queue<CampaignSendJob>,
  ) {}

  /** Create a draft campaign and its recipient list. Does not send until
   * started. Recipients are de-duplicated by phone. */
  async create(input: CreateCampaignInput): Promise<CreateCampaignResult> {
    const phone = await this.prisma.phoneNumber.findUnique({
      where: { eventId: input.eventId },
      select: { id: true, workspaceId: true },
    });
    if (!phone) {
      throw new NotFoundException("No WhatsApp number is configured for this event");
    }

    const campaign = await this.prisma.campaign.create({
      data: {
        workspaceId: phone.workspaceId,
        eventId: input.eventId,
        phoneNumberId: phone.id,
        name: input.name,
        templateName: input.templateName,
        templateLanguage: input.templateLanguage,
        status: CampaignStatus.DRAFT,
      },
      select: { id: true, status: true },
    });

    // De-dupe by phone; one recipient row per contact.
    const seen = new Set<string>();
    const rows: Prisma.CampaignRecipientCreateManyInput[] = [];
    for (const r of input.recipients) {
      const to = r.to.trim();
      if (!to || seen.has(to)) continue;
      seen.add(to);
      const contact = await this.prisma.contact.upsert({
        where: { workspaceId_waId: { workspaceId: phone.workspaceId, waId: to } },
        create: { workspaceId: phone.workspaceId, waId: to },
        update: {},
        select: { id: true },
      });
      rows.push({
        campaignId: campaign.id,
        contactId: contact.id,
        variables: (r.components ? { components: r.components } : {}) as Prisma.InputJsonValue,
      });
    }

    if (rows.length > 0) {
      await this.prisma.campaignRecipient.createMany({ data: rows, skipDuplicates: true });
    }

    return { id: campaign.id, status: campaign.status, recipientCount: rows.length };
  }

  /** Move a campaign to SENDING and enqueue one send job per queued recipient. */
  async start(campaignId: string): Promise<StartCampaignResult> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        status: true,
        recipients: {
          where: { status: "QUEUED" },
          select: { id: true },
        },
      },
    });
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.SENDING, startedAt: new Date() },
    });

    for (const recipient of campaign.recipients) {
      // jobId = recipientId keeps a re-start from double-sending a recipient.
      await this.queue.add(
        "send",
        { campaignId, recipientId: recipient.id },
        { jobId: recipient.id },
      );
    }

    return { id: campaignId, status: CampaignStatus.SENDING, queued: campaign.recipients.length };
  }
}
