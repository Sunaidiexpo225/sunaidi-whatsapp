import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ConversationStatus, type PrismaClient } from "@sunaidi/db";
import { PRISMA } from "../db/prisma.module";

export interface EventSummary {
  id: string;
  name: string;
  phone: { id: string; displayPhone: string; displayName: string | null } | null;
}

export interface VisitorInfo {
  name: string;
  company: string;
  consent: string;
}

export interface AssigneeInfo {
  id: string;
  name: string | null;
  email: string;
}

export interface ConversationSummary {
  id: string;
  status: ConversationStatus;
  lastMessageAt: Date | null;
  assignee: AssigneeInfo | null;
  contact: { id: string; name: string | null; waId: string; visitor: VisitorInfo | null };
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
    // VDMS owns events; we only surface those with a WhatsApp number attached.
    const events = await this.prisma.vdmsEvent.findMany({
      where: { phoneNumber: { isNot: null } },
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
        assignee: { select: { id: true, name: true, email: true } },
        contact: {
          select: {
            id: true,
            name: true,
            waId: true,
            visitor: { select: { name: true, company: true, consent: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { type: true, content: true, direction: true, createdAt: true },
        },
      },
    });

    return conversations.map((c) => {
      const last = c.messages[0];
      const visitor = c.contact.visitor;
      return {
        id: c.id,
        status: c.status,
        lastMessageAt: c.lastMessageAt,
        assignee: c.assignee
          ? { id: c.assignee.id, name: c.assignee.name, email: c.assignee.email }
          : null,
        contact: {
          id: c.contact.id,
          name: c.contact.name,
          waId: c.contact.waId,
          visitor: visitor
            ? { name: visitor.name, company: visitor.company, consent: String(visitor.consent) }
            : null,
        },
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

  /** Assign (or, with null, unassign) a conversation to an agent. */
  async assign(
    conversationId: string,
    assigneeId: string | null,
  ): Promise<{ id: string; assigneeId: string | null }> {
    if (assigneeId) {
      const user = await this.prisma.user.findUnique({
        where: { id: assigneeId },
        select: { id: true },
      });
      if (!user) throw new BadRequestException("Unknown agent");
    }
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { assigneeId },
      select: { id: true, assigneeId: true },
    });
    return updated;
  }

  async setStatus(
    conversationId: string,
    status: ConversationStatus,
  ): Promise<{ id: string; status: ConversationStatus }> {
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status },
      select: { id: true, status: true },
    });
    return updated;
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
