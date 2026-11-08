import { Inject, Injectable } from "@nestjs/common";
import { type ConversationStatus, type PrismaClient } from "@sunaidi/db";
import { PRISMA } from "../db/prisma.module";

export interface EventSummary {
  id: string;
  name: string;
  phone: { id: string; displayPhone: string; displayName: string | null } | null;
}

export interface ConversationSummary {
  id: string;
  status: ConversationStatus;
  lastMessageAt: Date | null;
  contact: { id: string; name: string | null; waId: string };
  lastMessage: { type: string; text: string | null; direction: string; createdAt: Date } | null;
}

export interface MessageView {
  id: string;
  direction: string;
  type: string;
  text: string | null;
  status: string;
  createdAt: Date;
}

@Injectable()
export class InboxService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async listEvents(): Promise<EventSummary[]> {
    const events = await this.prisma.event.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phoneNumber: {
          select: { id: true, displayPhone: true, displayName: true },
        },
      },
    });
    return events.map((e) => ({
      id: e.id,
      name: e.name,
      phone: e.phoneNumber
        ? {
            id: e.phoneNumber.id,
            displayPhone: e.phoneNumber.displayPhone,
            displayName: e.phoneNumber.displayName,
          }
        : null,
    }));
  }

  async listConversations(params: {
    eventId?: string;
    status?: ConversationStatus;
  }): Promise<ConversationSummary[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        ...(params.status ? { status: params.status } : {}),
        ...(params.eventId ? { phoneNumber: { eventId: params.eventId } } : {}),
      },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        lastMessageAt: true,
        contact: { select: { id: true, name: true, waId: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { type: true, content: true, direction: true, createdAt: true },
        },
      },
    });

    return conversations.map((c) => {
      const last = c.messages[0];
      return {
        id: c.id,
        status: c.status,
        lastMessageAt: c.lastMessageAt,
        contact: c.contact,
        lastMessage: last
          ? {
              type: last.type,
              text: extractText(last.content),
              direction: last.direction,
              createdAt: last.createdAt,
            }
          : null,
      };
    });
  }

  async getMessages(conversationId: string): Promise<MessageView[]> {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true,
        direction: true,
        type: true,
        content: true,
        status: true,
        createdAt: true,
      },
    });
    return messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      type: m.type,
      text: extractText(m.content),
      status: m.status,
      createdAt: m.createdAt,
    }));
  }
}

/** Pull the display text out of a stored message's JSON content, if any. */
function extractText(content: unknown): string | null {
  if (content && typeof content === "object" && "text" in content) {
    const text = (content as { text?: unknown }).text;
    return typeof text === "string" ? text : null;
  }
  return null;
}
