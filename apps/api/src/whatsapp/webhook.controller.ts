import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  type RawBodyRequest,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import {
  handleVerificationChallenge,
  verifyWebhookSignature,
} from "@sunaidi/whatsapp";
import type { Env } from "../config/env";
import { WebhookService } from "./webhook.service";

@Controller("webhooks/whatsapp")
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly webhookService: WebhookService,
  ) {}

  /** Meta's subscription handshake: echo the challenge when the verify token matches. */
  @Get()
  verify(
    @Query("hub.mode") mode?: string,
    @Query("hub.verify_token") token?: string,
    @Query("hub.challenge") challenge?: string,
  ): string {
    const result = handleVerificationChallenge(
      { mode, token, challenge },
      this.config.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN", { infer: true }),
    );
    if (result === null) {
      throw new BadRequestException("Verification failed");
    }
    return result;
  }

  /** Inbound events: validate Meta's signature over the raw body, then accept. */
  @Post()
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<Request>): Promise<{ status: string }> {
    const raw = req.rawBody;
    if (!raw) {
      throw new BadRequestException("Missing raw body");
    }

    const signature = req.header("x-hub-signature-256");
    const valid = verifyWebhookSignature(
      raw,
      signature,
      this.config.get("WHATSAPP_APP_SECRET", { infer: true }),
    );
    if (!valid) {
      // Meta expects 200 only when the signature is valid; reject otherwise.
      throw new BadRequestException("Invalid signature");
    }

    await this.webhookService.acceptInboundEvent(req.body);
    return { status: "accepted" };
  }
}
