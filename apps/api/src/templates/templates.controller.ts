import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { TemplateCategory } from "@sunaidi/db";
import { z } from "zod";
import { ApiKeyGuard } from "../outbound/api-key.guard";
import { TemplatesService, type TemplateRow } from "./templates.service";

const createSchema = z.object({
  eventId: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  language: z.string().trim().min(1),
  category: z.nativeEnum(TemplateCategory),
  components: z.array(z.unknown()).default([]),
});

@Controller("templates")
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list(): Promise<TemplateRow[]> {
    return this.templates.list();
  }

  @UseGuards(ApiKeyGuard)
  @Post()
  create(@Body() body: unknown): Promise<{ id: string; status: string }> {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      throw new BadRequestException(`Invalid request: ${issues}`);
    }
    return this.templates.create(parsed.data);
  }

  @UseGuards(ApiKeyGuard)
  @Post(":id/submit")
  submit(@Param("id") id: string): Promise<{ id: string; status: string; metaId: string | null }> {
    return this.templates.submit(id);
  }
}
