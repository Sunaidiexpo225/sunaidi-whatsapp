import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ConsentStatus } from "@sunaidi/db";
import { z } from "zod";
import { ApiKeyGuard } from "../outbound/api-key.guard";
import { ContactsService, type ContactRow } from "./contacts.service";

const CONSENT_VALUES = Object.values(ConsentStatus) as [ConsentStatus, ...ConsentStatus[]];

const addTagSchema = z.object({ tagId: z.string().trim().min(1) });

const importSchema = z.object({
  eventId: z.string().uuid().optional(),
  contacts: z
    .array(z.object({ to: z.string().trim().min(1), name: z.string().trim().optional() }))
    .min(1)
    .max(5000),
});

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

@Controller("contacts")
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  list(
    @Query("search") search?: string,
    @Query("tagId") tagId?: string,
    @Query("consent") consent?: string,
  ): Promise<ContactRow[]> {
    let consentFilter: ConsentStatus | undefined;
    if (consent) {
      if (!CONSENT_VALUES.includes(consent as ConsentStatus)) {
        throw new BadRequestException(`Invalid consent filter: ${consent}`);
      }
      consentFilter = consent as ConsentStatus;
    }
    return this.contacts.list({ search, tagId, consent: consentFilter });
  }

  @UseGuards(ApiKeyGuard)
  @Post("import")
  importContacts(@Body() body: unknown) {
    const data = parse(importSchema, body);
    return this.contacts.import(data.contacts, data.eventId);
  }

  @UseGuards(ApiKeyGuard)
  @Post(":id/tags")
  addTag(@Param("id") id: string, @Body() body: unknown) {
    const data = parse(addTagSchema, body);
    return this.contacts.addTag(id, data.tagId);
  }

  @UseGuards(ApiKeyGuard)
  @Delete(":id/tags/:tagId")
  removeTag(@Param("id") id: string, @Param("tagId") tagId: string) {
    return this.contacts.removeTag(id, tagId);
  }
}
