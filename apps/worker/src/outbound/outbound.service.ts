import { Inject, Injectable, Logger } from "@nestjs/common";
import { MessageStatus, type PrismaClient } from "@sunaidi/db";
import { type OutboundMessage, WhatsAppApiError, WhatsAppClient } from "@sunaidi/whatsapp";
import { PRISMA } from "../db/prisma.module";

@Injectable()
export class OutboundService {
  private readonly logger = new Logger(OutboundService.name);

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /**
   * Send one queued outbound message through the Graph API and record the
   * result. Idempotent — a message that already has a wamid is skipped. Graph
   * errors mark the message FAILED (no retry); unknown errors rethrow so BullMQ
   * can retry.
   */
  async send(messageId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        type: true,
        content: true,
        waMessageId: true,
        contact: { select: { waId: true } },
        phoneNumber: {
          select: { phoneNumberId: true, accessToken: true, graphApiVersion: true },
        },
      },
    });
    if (!message) {
      this.logger.warn(`Outbound message ${messageId} not found`);
      return;
    }
    if (message.waMessageId) {
      return; // already sent
    }

    const outbound = toOutbound(message.type, message.content, message.contact.waId);
    if (!outbound) {
      await this.fail(messageId, "unsupported", `Cannot send message type "${message.type}"`);
      return;
    }

    const client = new WhatsAppClient({
      accessToken: message.phoneNumber.accessToken,
      phoneNumberId: message.phoneNumber.phoneNumberId,
      graphApiVersion: message.phoneNumber.graphApiVersion,
    });

    try {
      const result = await client.send(outbound);
      await this.prisma.message.update({
        where: { id: messageId },
        data: {
          status: MessageStatus.SENT,
          waMessageId: result.messageId,
          errorCode: null,
          errorMessage: null,
        },
      });
    } catch (err) {
      if (err instanceof WhatsAppApiError) {
        const code = err.code != null ? String(err.code) : String(err.status);
        await this.fail(messageId, code, err.message);
        return;
      }
      throw err; // transient/unknown — let BullMQ retry
    }
  }

  private async fail(id: string, code: string, msg: string): Promise<void> {
    await this.prisma.message.update({
      where: { id },
      data: { status: MessageStatus.FAILED, errorCode: code, errorMessage: msg },
    });
  }
}

/** Build the Graph API payload for a stored message. Returns null for a type
 * we can't send yet. */
export function toOutbound(
  type: string,
  content: unknown,
  to: string,
): OutboundMessage | null {
  if (type === "text" && content && typeof content === "object" && "text" in content) {
    const text = (content as { text?: unknown }).text;
    if (typeof text === "string" && text.length > 0) {
      return { type: "text", to, text: { body: text } };
    }
  }
  return null;
}
