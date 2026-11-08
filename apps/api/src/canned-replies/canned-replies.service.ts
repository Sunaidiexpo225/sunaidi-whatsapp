import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { type PrismaClient } from "@sunaidi/db";
import { PRISMA } from "../db/prisma.module";

export interface CannedReplyRow {
  id: string;
  title: string;
  body: string;
  shortcut: string | null;
}

@Injectable()
export class CannedRepliesService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async list(): Promise<CannedReplyRow[]> {
    return this.prisma.cannedReply.findMany({
      orderBy: { title: "asc" },
      take: 500,
      select: { id: true, title: true, body: true, shortcut: true },
    });
  }

  async create(input: { title: string; body: string; shortcut?: string }): Promise<CannedReplyRow> {
    const workspaceId = await this.resolveWorkspaceId();
    try {
      return await this.prisma.cannedReply.create({
        data: {
          workspaceId,
          title: input.title,
          body: input.body,
          shortcut: input.shortcut ?? null,
        },
        select: { id: true, title: true, body: true, shortcut: true },
      });
    } catch {
      throw new BadRequestException("A canned reply with that title already exists");
    }
  }

  async remove(id: string): Promise<{ ok: true }> {
    await this.prisma.cannedReply.deleteMany({ where: { id } });
    return { ok: true };
  }

  private async resolveWorkspaceId(): Promise<string> {
    const workspace = await this.prisma.workspace.findFirst({ select: { id: true } });
    if (!workspace) throw new BadRequestException("No workspace exists yet");
    return workspace.id;
  }
}
