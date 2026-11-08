import { BadRequestException, Body, Controller, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { ApiKeyGuard } from "./api-key.guard";
import { OutboundService, type SendReplyResult } from "./outbound.service";

const templateSchema = z.object({
  eventId: z.string().uuid(),
  to: z.string().trim().min(1),
  name: z.string().trim().min(1),
  language: z.string().trim().min(1),
  components: z.array(z.unknown()).optional(),
});

/**
 * Internal send API for VDMS and other machine callers. Guarded by a shared
 * API key. `POST /outbound/templates` is the badge-send contract that replaces
 * VDMS's WATI call.
 */
@UseGuards(ApiKeyGuard)
@Controller("outbound")
export class TemplateController {
  constructor(private readonly outbound: OutboundService) {}

  @Post("templates")
  sendTemplate(@Body() body: unknown): Promise<SendReplyResult> {
    const parsed = templateSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      throw new BadRequestException(`Invalid request: ${issues}`);
    }
    return this.outbound.sendTemplate(parsed.data);
  }
}
