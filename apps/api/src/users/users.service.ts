import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Role, type PrismaClient } from "@sunaidi/db";
import { PRISMA } from "../db/prisma.module";

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async list(): Promise<UserRow[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      take: 500,
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    return users;
  }

  /** Pre-provision a dashboard user. Until per-user Supabase auth is wired, the
   * row carries a placeholder authUserId; the real id is linked at first login. */
  async create(input: { email: string; name?: string; role: Role }): Promise<UserRow> {
    const workspaceId = await this.resolveWorkspaceId();
    const email = input.email.toLowerCase();
    try {
      return await this.prisma.user.create({
        data: {
          workspaceId,
          authUserId: `invite:${email}`,
          email,
          name: input.name ?? null,
          role: input.role,
        },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      });
    } catch {
      throw new BadRequestException("A user with that email already exists");
    }
  }

  async update(id: string, input: { name?: string; role?: Role }): Promise<UserRow> {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.role ? { role: input.role } : {}),
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }

  private async resolveWorkspaceId(): Promise<string> {
    const workspace = await this.prisma.workspace.findFirst({ select: { id: true } });
    if (!workspace) throw new BadRequestException("No workspace exists yet");
    return workspace.id;
  }
}
