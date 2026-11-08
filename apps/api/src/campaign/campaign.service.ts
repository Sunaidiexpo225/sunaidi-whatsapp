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

export interface CampaignRow {
  id: string;
  name: string;
  status: string;
  templateName: string;
  templateLanguage: string;
  eventName: string;
  recipients: { total: number; sent: number; failed: number; queued: number };
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

@Injectable()
export class CampaignService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(CAMPAIGN_SEND_QUEUE) private readonly queue: Queue<CampaignSendJob>,
  ) {}

  /** List recent campaigns with per-status recipient counts. */
  async list(): Promise<CampaignRow[]> {
    const [campaigns, stats] = await Promise.all([
      this.prisma.campaign.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          name: true,
          status: true,
          templateName: true,
          templateLanguage: true,
          createdAt: true,
          startedAt: true,
          completedAt: true,
          event: { select: { name: true } },
          _count: { select: { recipients: true } },
        },
      }),
      this.prisma.campaignRecipient.groupBy({
        by: ["campaignId", "status"],
        _count: { _all: true },
      }),
    ]);

    const byCampaign = new Map<string, { sent: number; failed: number; queued: number }>();
    for (const s of stats) {
      const row = byCampaign.get(s.campaignId) ?? { sent: 0, failed: 0, queued: 0 };
      if (s.status === "FAILED") row.failed += s._count._all;
      else if (s.status === "QUEUED") row.queued += s._count._all;
      else row.sent += s._count._all; // SENT / DELIVERED / READ
      byCampaign.set(s.campaignId, row);
    }

    return campaigns.map((c) => {
      const r = byCampaign.get(c.id) ?? { sent: 0, failed: 0, queued: 0 };
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        templateName: c.templateName,
        templateLanguage: c.templateLanguage,
        eventName: c.event?.name ?? "—",
        recipients: { total: c._count.recipients, ...r },
        createdAt: c.createdAt,
        startedAt: c.startedAt,
        completedAt: c.completedAt,
      };
    });
  }

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
