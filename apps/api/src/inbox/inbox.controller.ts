import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ConversationStatus } from "@sunaidi/db";
import { z } from "zod";
import { ApiKeyGuard } from "../outbound/api-key.guard";
import {
  InboxService,
  type ConversationSummary,
  type EventSummary,
  type MessageView,
} from "./inbox.service";

const assignSchema = z.object({ assigneeId: z.string().trim().min(1).nullable() });
const statusSchema = z.object({ status: z.nativeEnum(ConversationStatus) });

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new BadRequestException(`Invalid request: ${issues}`);
  }
  return parsed.data;
}

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

  @UseGuards(ApiKeyGuard)
  @Patch("conversations/:id/assign")
  assign(@Param("id") id: string, @Body() body: unknown) {
    return this.inbox.assign(id, parse(assignSchema, body).assigneeId);
  }

  @UseGuards(ApiKeyGuard)
  @Patch("conversations/:id/status")
  setStatus(@Param("id") id: string, @Body() body: unknown) {
    return this.inbox.setStatus(id, parse(statusSchema, body).status);
  }
}
