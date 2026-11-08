import { Body, Controller, Param, Post } from "@nestjs/common";
import { OutboundService, type SendReplyResult } from "./outbound.service";

interface SendBody {
  text?: string;
}

@Controller()
export class OutboundController {
  constructor(private readonly outbound: OutboundService) {}

  /** Agent reply from the inbox. Text only for now. */
  @Post("conversations/:id/messages")
  send(@Param("id") id: string, @Body() body: SendBody): Promise<SendReplyResult> {
    return this.outbound.sendText(id, body?.text ?? "");
  }
}
