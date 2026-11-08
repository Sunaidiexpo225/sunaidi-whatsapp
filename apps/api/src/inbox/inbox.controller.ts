import { Controller, Get, Param, Query } from "@nestjs/common";
import { ConversationStatus } from "@sunaidi/db";
import {
  InboxService,
  type ConversationSummary,
  type EventSummary,
  type MessageView,
} from "./inbox.service";

@Controller()
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get("events")
  listEvents(): Promise<EventSummary[]> {
    return this.inbox.listEvents();
  }

  @Get("conversations")
  listConversations(
    @Query("eventId") eventId?: string,
    @Query("status") status?: string,
  ): Promise<ConversationSummary[]> {
    const normalised =
      status && status in ConversationStatus
        ? (status as ConversationStatus)
        : undefined;
    return this.inbox.listConversations({ eventId, status: normalised });
  }

  @Get("conversations/:id/messages")
  getMessages(@Param("id") id: string): Promise<MessageView[]> {
    return this.inbox.getMessages(id);
  }
}
