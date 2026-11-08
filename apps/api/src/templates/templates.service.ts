import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Prisma, type PrismaClient, type TemplateCategory } from "@sunaidi/db";
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
