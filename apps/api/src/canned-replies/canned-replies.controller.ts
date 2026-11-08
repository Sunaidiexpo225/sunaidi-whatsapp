import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { ApiKeyGuard } from "../outbound/api-key.guard";
import { CannedRepliesService, type CannedReplyRow } from "./canned-replies.service";

const createSchema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(4096),
  shortcut: z.string().trim().max(40).optional(),
});

@Controller("canned-replies")
export class CannedRepliesController {
  constructor(private readonly canned: CannedRepliesService) {}

  @Get()
  list(): Promise<CannedReplyRow[]> {
    return this.canned.list();
  }

  @UseGuards(ApiKeyGuard)
  @Post()
  create(@Body() body: unknown): Promise<CannedReplyRow> {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      throw new BadRequestException(`Invalid request: ${issues}`);
    }
    return this.canned.create(parsed.data);
  }

  @UseGuards(ApiKeyGuard)
  @Delete(":id")
  remove(@Param("id") id: string): Promise<{ ok: true }> {
    return this.canned.remove(id);
  }
}
