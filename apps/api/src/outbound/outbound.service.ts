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
}
