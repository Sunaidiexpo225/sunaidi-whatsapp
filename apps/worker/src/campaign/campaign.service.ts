import { Inject, Injectable, Logger } from "@nestjs/common";
import { CampaignStatus, MessageStatus, type PrismaClient } from "@sunaidi/db";
import { WhatsAppApiError, WhatsAppClient } from "@sunaidi/whatsapp";
import { PRISMA } from "../db/prisma.module";
import { toOutbound } from "../outbound/outbound.service";

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /**
   * Send one campaign recipient's templated message and record the result on
   * the CampaignRecipient row. Idempotent (skips a recipient already sent).
   * When the last queued recipient is handled, the campaign is marked
   * COMPLETED.
   */
  async sendRecipient(campaignId: string, recipientId: string): Promise<void> {
    const recipient = await this.prisma.campaignRecipient.findUnique({
      where: { id: recipientId },
      select: {
        id: true,
        status: true,
        waMessageId: true,
        variables: true,
        contactId: true,
        campaign: {
          select: {
            templateName: true,
            templateLanguage: true,
            phoneNumber: {
              select: { phoneNumberId: true, accessToken: true, graphApiVersion: true },
            },
          },
        },
      },
    });
    if (!recipient) {
      this.logger.warn(`Campaign recipient ${recipientId} not found`);
      return;
    }
    if (recipient.waMessageId || recipient.status !== MessageStatus.QUEUED) {
      return; // already handled
    }

    const contact = await this.prisma.contact.findUnique({
      where: { id: recipient.contactId },
      select: { waId: true },
    });
    if (!contact) {
      await this.fail(recipientId, "no_contact");
      await this.completeIfDone(campaignId);
      return;
    }

    const payload = toOutbound(
      "template",
      {
        name: recipient.campaign.templateName,
        language: recipient.campaign.templateLanguage,
        components: extractComponents(recipient.variables),
      },
      contact.waId,
    );
    if (!payload) {
      await this.fail(recipientId, "bad_template");
      await this.completeIfDone(campaignId);
      return;
    }

    const client = new WhatsAppClient({
      accessToken: recipient.campaign.phoneNumber.accessToken,
      phoneNumberId: recipient.campaign.phoneNumber.phoneNumberId,
      graphApiVersion: recipient.campaign.phoneNumber.graphApiVersion,
    });

    try {
      const result = await client.send(payload);
      await this.prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: {
          status: MessageStatus.SENT,
          waMessageId: result.messageId,
          errorCode: null,
          sentAt: new Date(),
        },
      });
    } catch (err) {
      if (err instanceof WhatsAppApiError) {
        await this.fail(recipientId, err.code != null ? String(err.code) : String(err.status));
      } else {
        throw err; // transient/unknown — let BullMQ retry
      }
    }

    await this.completeIfDone(campaignId);
  }

  private async fail(recipientId: string, code: string): Promise<void> {
    await this.prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: { status: MessageStatus.FAILED, errorCode: code, sentAt: new Date() },
    });
  }

  private async completeIfDone(campaignId: string): Promise<void> {
    const remaining = await this.prisma.campaignRecipient.count({
      where: { campaignId, status: MessageStatus.QUEUED },
    });
    if (remaining === 0) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.COMPLETED, completedAt: new Date() },
      });
    }
  }
}

/** Pull Graph API components out of a recipient's stored variables, if any. */
export function extractComponents(variables: unknown): unknown[] | undefined {
  if (variables && typeof variables === "object" && "components" in variables) {
    const c = (variables as { components?: unknown }).components;
    if (Array.isArray(c)) return c;
  }
  return undefined;
}
