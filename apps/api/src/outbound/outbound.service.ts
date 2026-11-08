import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { MessageDirection, MessageStatus, Prisma, type PrismaClient } from "@sunaidi/db";
import { Queue } from "bullmq";
import { PRISMA } from "../db/prisma.module";
import { OUTBOUND_MESSAGE_QUEUE, type OutboundMessageJob } from "../queue/queue.constants";

/** Meta's customer-service window: free-form messages are only allowed within
 * 24 hours of the contact's last inbound message. Outside it, only approved
 * templates may be sent (added in a later PR). */
const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface SendReplyResult {
  id: string;
  status: string;
}

export interface SendTemplateInput {
  /** VDMS event uuid; selects which WhatsApp number sends. */
  eventId: string;
  /** Recipient phone in E.164 (no +), e.g. 9665XXXXXXXX. */
  to: string;
  /** Meta-approved template name. */
  name: string;
  /** Template language code, e.g. "en" or "ar". */
  language: string;
  /** Graph API template components (header/body/button parameters). */
  components?: unknown[];
}

@Injectable()
export class OutboundService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(OUTBOUND_MESSAGE_QUEUE) private readonly queue: Queue<OutboundMessageJob>,
  ) {}

  /** Queue a free-form text reply on a conversation. Stored as QUEUED and sent
   * by the worker; the returned status reflects the stored row, not delivery. */
  async sendText(conversationId: string, text: string): Promise<SendReplyResult> {
    const body = text?.trim();
    if (!body) {
      throw new BadRequestException("Message text is required");
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        workspaceId: true,
        contactId: true,
        phoneNumberId: true,
        lastInboundAt: true,
      },
    });
    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    const withinWindow =
      conversation.lastInboundAt != null &&
      Date.now() - conversation.lastInboundAt.getTime() < WINDOW_MS;
    if (!withinWindow) {
      throw new BadRequestException(
        "Outside the 24-hour customer service window; send an approved template instead",
      );
    }

    const message = await this.prisma.message.create({
      data: {
        workspaceId: conversation.workspaceId,
        conversationId: conversation.id,
        contactId: conversation.contactId,
        phoneNumberId: conversation.phoneNumberId,
        direction: MessageDirection.OUTBOUND,
        type: "text",
        content: { text: body } as Prisma.InputJsonValue,
        status: MessageStatus.QUEUED,
      },
      select: { id: true, status: true },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    // jobId = messageId makes the enqueue idempotent against double submits.
    await this.queue.add("send", { messageId: message.id }, { jobId: message.id });

    return { id: message.id, status: message.status };
  }

  /**
   * Send an approved template (e.g. a registration badge) to a recipient on an
   * event's WhatsApp number. Templates are exempt from the 24-hour window, so
   * this is how VDMS delivers badges the moment a visitor registers — the
   * replacement for its WATI badge call.
   */
  async sendTemplate(input: SendTemplateInput): Promise<SendReplyResult> {
    const phone = await this.prisma.phoneNumber.findUnique({
      where: { eventId: input.eventId },
      select: { id: true, workspaceId: true },
    });
    if (!phone) {
      throw new NotFoundException("No WhatsApp number is configured for this event");
    }

    // Record the sender as a contact so the template thread shows in the inbox.
    const contact = await this.prisma.contact.upsert({
      where: { workspaceId_waId: { workspaceId: phone.workspaceId, waId: input.to } },
      create: { workspaceId: phone.workspaceId, waId: input.to },
      update: {},
      select: { id: true },
    });

    const conversation = await this.prisma.conversation.upsert({
      where: { contactId_phoneNumberId: { contactId: contact.id, phoneNumberId: phone.id } },
      create: {
        workspaceId: phone.workspaceId,
        contactId: contact.id,
        phoneNumberId: phone.id,
        status: "OPEN",
        lastMessageAt: new Date(),
      },
      update: { lastMessageAt: new Date() },
      select: { id: true },
    });

    const message = await this.prisma.message.create({
      data: {
        workspaceId: phone.workspaceId,
        conversationId: conversation.id,
        contactId: contact.id,
        phoneNumberId: phone.id,
        direction: MessageDirection.OUTBOUND,
        type: "template",
        content: {
          name: input.name,
          language: input.language,
          components: input.components ?? [],
        } as Prisma.InputJsonValue,
        status: MessageStatus.QUEUED,
      },
      select: { id: true, status: true },
    });

    await this.queue.add("send", { messageId: message.id }, { jobId: message.id });

    return { id: message.id, status: message.status };
  }
}
