import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type PrismaClient } from "@sunaidi/db";
import { PRISMA } from "../db/prisma.module";

export interface AutomationRow {
  id: string;
  name: string;
  trigger: string;
  enabled: boolean;
  eventName: string | null;
  updatedAt: Date;
}

export interface CreateAutomationInput {
  eventId?: string;
  name: string;
  trigger: string;
  conditions?: Record<string, unknown>;
  actions?: unknown[];
}

export interface AutomationDetail {
  id: string;
  name: string;
  trigger: string;
  enabled: boolean;
  eventId: string | null;
  conditions: Record<string, unknown>;
  actions: unknown[];
}

export interface UpdateAutomationInput {
  name?: string;
  conditions?: Record<string, unknown>;
  actions?: unknown[];
}

@Injectable()
export class AutomationsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async list(): Promise<AutomationRow[]> {
    const rows = await this.prisma.automation.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        trigger: true,
        enabled: true,
        updatedAt: true,
        // Automation.eventId references a VDMS event but has no relation, so
        // resolve the name separately below.
        eventId: true,
      },
    });

    const eventIds = [...new Set(rows.map((r) => r.eventId).filter((x): x is string => !!x))];
    const events = eventIds.length
      ? await this.prisma.vdmsEvent.findMany({
          where: { id: { in: eventIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(events.map((e) => [e.id, e.name]));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      trigger: r.trigger,
      enabled: r.enabled,
      eventName: r.eventId ? (nameById.get(r.eventId) ?? null) : null,
      updatedAt: r.updatedAt,
    }));
  }

  async create(input: CreateAutomationInput): Promise<{ id: string; enabled: boolean }> {
    const workspaceId = await this.resolveWorkspaceId(input.eventId);
    const automation = await this.prisma.automation.create({
      data: {
        workspaceId,
        eventId: input.eventId ?? null,
        name: input.name,
        trigger: input.trigger,
        conditions: (input.conditions ?? {}) as Prisma.InputJsonValue,
        actions: (input.actions ?? []) as Prisma.InputJsonValue,
      },
      select: { id: true, enabled: true },
    });
    return automation;
  }

  async get(id: string): Promise<AutomationDetail> {
    const a = await this.prisma.automation.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        trigger: true,
        enabled: true,
        eventId: true,
        conditions: true,
        actions: true,
      },
    });
    if (!a) throw new NotFoundException("Automation not found");
    return {
      id: a.id,
      name: a.name,
      trigger: a.trigger,
      enabled: a.enabled,
      eventId: a.eventId,
      conditions: (a.conditions as Record<string, unknown>) ?? {},
      actions: Array.isArray(a.actions) ? (a.actions as unknown[]) : [],
    };
  }

  async update(id: string, input: UpdateAutomationInput): Promise<{ id: string }> {
    const existing = await this.prisma.automation.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Automation not found");
    return this.prisma.automation.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.conditions !== undefined
          ? { conditions: input.conditions as Prisma.InputJsonValue }
          : {}),
        ...(input.actions !== undefined
          ? { actions: input.actions as Prisma.InputJsonValue }
          : {}),
      },
      select: { id: true },
    });
  }

  async setEnabled(id: string, enabled: boolean): Promise<{ id: string; enabled: boolean }> {
    const existing = await this.prisma.automation.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      throw new NotFoundException("Automation not found");
    }
    return this.prisma.automation.update({
      where: { id },
      data: { enabled },
      select: { id: true, enabled: true },
    });
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
