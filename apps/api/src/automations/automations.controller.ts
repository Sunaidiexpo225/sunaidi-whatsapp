import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { ApiKeyGuard } from "../outbound/api-key.guard";
import { AutomationsService, type AutomationRow } from "./automations.service";

const createSchema = z.object({
  eventId: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  trigger: z.enum(["welcome", "out_of_office", "keyword", "assignment"]),
  conditions: z.record(z.unknown()).optional(),
  actions: z.array(z.unknown()).optional(),
});

const toggleSchema = z.object({ enabled: z.boolean() });

@Controller("automations")
export class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  @Get()
  list(): Promise<AutomationRow[]> {
    return this.automations.list();
  }

  @UseGuards(ApiKeyGuard)
  @Post()
  create(@Body() body: unknown): Promise<{ id: string; enabled: boolean }> {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      throw new BadRequestException(`Invalid request: ${issues}`);
    }
    return this.automations.create(parsed.data);
  }

  @UseGuards(ApiKeyGuard)
  @Patch(":id")
  toggle(
    @Param("id") id: string,
    @Body() body: unknown,
  ): Promise<{ id: string; enabled: boolean }> {
    const parsed = toggleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("enabled (boolean) is required");
    }
    return this.automations.setEnabled(id, parsed.data.enabled);
  }
}
