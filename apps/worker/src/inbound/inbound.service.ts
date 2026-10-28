import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  type DeliveryStatus,
  type ParsedInbound,
  parseInboundPayload,
} from "@sunaidi/whatsapp";
import { MessageDirection, MessageStatus, Prisma, type PrismaClient } from "@sunaidi/db";
import { PRISMA } from "../db/prisma.module";

const STATUS_MAP: Record<DeliveryStatus, MessageStatus> = {
  sent: MessageStatus.SENT,
  delivered: MessageStatus.DELIVERED,
  read: MessageStatus.READ,
  failed: MessageStatus.FAILED,
};

@Injectable()
export class InboundService {
  private readonly logger = new Logger(InboundService.name);

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /**
   * Process one stored webhook event: turn its messages into contacts,
   * conversations and messages, and apply delivery statuses. Idempotent — safe
   * to run again for the same event (message writes key on Meta's wamid).
   */
  async processWebhookEvent(webhookEventId: string): Promise<void> {
    const event = await this.prisma.webhookEvent.findUnique({
      where: { id: webhookEventId },
      select: { id: true, payload: true, processedAt: true },
    });
    if (!event) {
      this.logger.warn(`Webhook event ${webhookEventId} not found`);
      return;
    }
    if (event.processedAt) {
      return; // already handled
    }

    for (const inbound of parseInboundPayload(event.payload as object)) {
      await this.applyInbound(inbound);
    }

    await this.prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { processedAt: new Date() },
    });
  }

  private async applyInbound(inbound: ParsedInbound): Promise<void> {
    const phone = await this.prisma.phoneNumber.findUnique({
      where: { phoneNumberId: inbound.phoneNumberId },
      select: { id: true, workspaceId: true },
    });
    if (!phone) {
      // A number we don't manage yet; nothing to attribute it to.
      this.logger.warn(`No phone number registered for ${inbound.phoneNumberId}`);
      return;
    }

    for (const message of inbound.messages) {
      const contact = await this.prisma.contact.upsert({
        where: { workspaceId_waId: { workspaceId: phone.workspaceId, waId: message.from } },
        create: {
          workspaceId: phone.workspaceId,
          waId: message.from,
          name: message.profileName ?? null,
        },
        update: message.profileName ? { name: message.profileName } : {},
        select: { id: true },
      });

      const conversation = await this.prisma.conversation.upsert({
        where: { contactId_phoneNumberId: { contactId: contact.id, phoneNumberId: phone.id } },
        create: {
          workspaceId: phone.workspaceId,
          contactId: contact.id,
          phoneNumberId: phone.id,
          status: "OPEN",
          lastInboundAt: message.timestamp,
          lastMessageAt: message.timestamp,
        },
        // A new inbound message reopens a resolved conversation.
        update: {
          status: "OPEN",
          lastInboundAt: message.timestamp,
          lastMessageAt: message.timestamp,
        },
        select: { id: true },
      });

      await this.prisma.message.upsert({
        where: { waMessageId: message.waMessageId },
        create: {
          workspaceId: phone.workspaceId,
          conversationId: conversation.id,
          contactId: contact.id,
          phoneNumberId: phone.id,
          direction: MessageDirection.INBOUND,
          type: message.type,
          content: (message.text
            ? { text: message.text, ...message.raw }
            : message.raw) as Prisma.InputJsonValue,
          status: MessageStatus.DELIVERED,
          waMessageId: message.waMessageId,
          createdAt: message.timestamp,
        },
        update: {}, // already stored; keep as is
      });
    }

    for (const status of inbound.statuses) {
      // Status updates are for outbound messages we sent earlier. updateMany so a
      // status for a message we don't have yet is a no-op rather than an error.
      await this.prisma.message.updateMany({
        where: { waMessageId: status.waMessageId },
        data: {
          status: STATUS_MAP[status.status],
          errorCode: status.errorCode ?? null,
          errorMessage: status.errorMessage ?? null,
        },
      });
    }
  }
}
