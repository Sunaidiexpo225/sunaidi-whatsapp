import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, TemplateStatus, type PrismaClient, type TemplateCategory } from "@sunaidi/db";
import { WhatsAppApiError, WhatsAppClient } from "@sunaidi/whatsapp";
import { PRISMA } from "../db/prisma.module";

export interface TemplateRow {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  eventName: string | null;
  updatedAt: Date;
}

export interface CreateTemplateInput {
  eventId?: string;
  name: string;
  language: string;
  category: TemplateCategory;
  components: unknown[];
}

@Injectable()
export class TemplatesService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async list(): Promise<TemplateRow[]> {
    const templates = await this.prisma.messageTemplate.findMany({
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        language: true,
        category: true,
        status: true,
        updatedAt: true,
        event: { select: { name: true } },
      },
    });
    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      language: t.language,
      category: t.category,
      status: t.status,
      eventName: t.event?.name ?? null,
      updatedAt: t.updatedAt,
    }));
  }

  /** Create a local draft template record. (Submitting it to Meta for approval
   * is a later step; this stores the definition and marks it DRAFT.) */
  async create(input: CreateTemplateInput): Promise<{ id: string; status: string }> {
    const workspaceId = await this.resolveWorkspaceId(input.eventId);
    const template = await this.prisma.messageTemplate.create({
      data: {
        workspaceId,
        eventId: input.eventId ?? null,
        name: input.name,
        language: input.language,
        category: input.category,
        components: input.components as Prisma.InputJsonValue,
      },
      select: { id: true, status: true },
    });
    return template;
  }

  /**
   * Submit a draft template to Meta for approval. Uses the owning event's
   * WhatsApp number (WABA + token) to call the Graph API; on success the
   * template moves to PENDING and stores Meta's template id.
   */
  async submit(templateId: string): Promise<{ id: string; status: string; metaId: string | null }> {
    const template = await this.prisma.messageTemplate.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        name: true,
        language: true,
        category: true,
        components: true,
        status: true,
        eventId: true,
      },
    });
    if (!template) throw new NotFoundException("Template not found");
    if (template.status !== TemplateStatus.DRAFT && template.status !== TemplateStatus.REJECTED) {
      throw new BadRequestException(`Template is already ${template.status}`);
    }
    if (!template.eventId) {
      throw new BadRequestException(
        "Assign the template to an event before submitting, so it can use that number's WhatsApp account.",
      );
    }
    const phone = await this.prisma.phoneNumber.findUnique({
      where: { eventId: template.eventId },
      select: { wabaId: true, accessToken: true, graphApiVersion: true },
    });
    if (!phone) {
      throw new BadRequestException("That event has no connected WhatsApp number yet");
    }

    const components = Array.isArray(template.components) ? (template.components as unknown[]) : [];
    const client = new WhatsAppClient({
      accessToken: phone.accessToken,
      graphApiVersion: phone.graphApiVersion,
    });

    let metaId: string;
    try {
      const created = await client.createMessageTemplate(phone.wabaId, {
        name: template.name,
        language: template.language,
        category: template.category,
        components,
      });
      metaId = created.id;
    } catch (err) {
      if (err instanceof WhatsAppApiError) {
        throw new BadRequestException(`Meta rejected the template: ${err.message}`);
      }
      throw err;
    }

    const updated = await this.prisma.messageTemplate.update({
      where: { id: templateId },
      data: { status: TemplateStatus.PENDING, metaId },
      select: { id: true, status: true, metaId: true },
    });
    return updated;
  }

  private async resolveWorkspaceId(eventId?: string): Promise<string> {
    if (eventId) {
      const phone = await this.prisma.phoneNumber.findUnique({
        where: { eventId },
        select: { workspaceId: true },
      });
      if (phone) return phone.workspaceId;
    }
    const workspace = await this.prisma.workspace.findFirst({ select: { id: true } });
    if (!workspace) {
      throw new BadRequestException("No workspace exists yet");
    }
    return workspace.id;
  }
}
