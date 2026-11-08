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
import {
  AutomationsService,
  type AutomationDetail,
  type AutomationRow,
} from "./automations.service";

const createSchema = z.object({
  eventId: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  trigger: z.enum(["welcome", "out_of_office", "keyword", "assignment"]),
  conditions: z.record(z.unknown()).optional(),
  actions: z.array(z.unknown()).optional(),
});

const toggleSchema = z.object({ enabled: z.boolean() });

const configSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    conditions: z.record(z.unknown()).optional(),
    actions: z.array(z.unknown()).optional(),
  })
  .refine((v) => v.name !== undefined || v.conditions !== undefined || v.actions !== undefined, {
    message: "Nothing to update",
  });

@Controller("automations")
export class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  @Get()
  list(): Promise<AutomationRow[]> {
    return this.automations.list();
  }

  @Get(":id")
  get(@Param("id") id: string): Promise<AutomationDetail> {
    return this.automations.get(id);
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

  @UseGuards(ApiKeyGuard)
  @Patch(":id/config")
  updateConfig(@Param("id") id: string, @Body() body: unknown): Promise<{ id: string }> {
    const parsed = configSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      throw new BadRequestException(`Invalid request: ${issues}`);
    }
    return this.automations.update(id, parsed.data);
  }
}
