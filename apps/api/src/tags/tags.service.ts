import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { type PrismaClient } from "@sunaidi/db";
import { PRISMA } from "../db/prisma.module";

export interface TagRow {
  id: string;
  name: string;
  contactCount: number;
}

@Injectable()
export class TagsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async list(): Promise<TagRow[]> {
    const tags = await this.prisma.tag.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { contacts: true } } },
    });
    return tags.map((t) => ({ id: t.id, name: t.name, contactCount: t._count.contacts }));
  }

  async create(name: string, eventId?: string): Promise<TagRow> {
    const workspaceId = await this.resolveWorkspaceId(eventId);
    const tag = await this.prisma.tag.upsert({
      where: { workspaceId_name: { workspaceId, name } },
      create: { workspaceId, name },
      update: {},
      select: { id: true, name: true, _count: { select: { contacts: true } } },
    });
    return { id: tag.id, name: tag.name, contactCount: tag._count.contacts };
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
