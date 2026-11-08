import { BadRequestException, Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { ApiKeyGuard } from "../outbound/api-key.guard";
import { TagsService, type TagRow } from "./tags.service";

const createSchema = z.object({
  eventId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
});

@Controller("tags")
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list(): Promise<TagRow[]> {
    return this.tags.list();
  }

  @UseGuards(ApiKeyGuard)
  @Post()
  create(@Body() body: unknown): Promise<TagRow> {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      throw new BadRequestException(`Invalid request: ${issues}`);
    }
    return this.tags.create(parsed.data.name, parsed.data.eventId);
  }
}
