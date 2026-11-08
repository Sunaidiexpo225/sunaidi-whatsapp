import { Inject, Injectable } from "@nestjs/common";
import { type PrismaClient } from "@sunaidi/db";
import { PRISMA } from "../db/prisma.module";

export interface DashboardSummary {
  conversations: { total: number; open: number; pending: number; resolved: number };
  messages7d: {
    outbound: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    inbound: number;
  };
  campaigns: {
    total: number;
    sending: number;
    completed: number;
    recipientsSent: number;
    recipientsFailed: number;
    recipientsQueued: number;
  };
  contacts: number;
  events: {
    phoneNumberId: string;
    name: string;
    phone: string;
    displayName: string | null;
    openConversations: number;
    sent7d: number;
  }[];
}

type Grouped<K extends string> = Array<Record<K, string> & { _count: { _all: number } }>;

function sumByKey<K extends string>(rows: Grouped<K>, key: K): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row[key] as string] = row._count._all;
  }
  return out;
}

function total(map: Record<string, number>): number {
  return Object.values(map).reduce((a, b) => a + b, 0);
}

@Injectable()
export class StatsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async getDashboard(): Promise<DashboardSummary> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      convByStatus,
      outByStatus,
      inbound,
      campByStatus,
      recipByStatus,
      contacts,
      phones,
      openConvByPhone,
      sentByPhone,
    ] = await Promise.all([
      this.prisma.conversation.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.message.groupBy({
        by: ["status"],
        where: { direction: "OUTBOUND", createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.message.count({
        where: { direction: "INBOUND", createdAt: { gte: since } },
      }),
      this.prisma.campaign.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.campaignRecipient.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.contact.count(),
      this.prisma.phoneNumber.findMany({
        select: {
          id: true,
          displayPhone: true,
          displayName: true,
          event: { select: { name: true } },
        },
      }),
      this.prisma.conversation.groupBy({
        by: ["phoneNumberId"],
        where: { status: "OPEN" },
        _count: { _all: true },
      }),
      this.prisma.message.groupBy({
        by: ["phoneNumberId"],
        where: { direction: "OUTBOUND", createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);

    const conv = sumByKey(convByStatus, "status");
    const out = sumByKey(outByStatus, "status");
    const camp = sumByKey(campByStatus, "status");
    const recip = sumByKey(recipByStatus, "status");
    const openByPhone = sumByKey(openConvByPhone, "phoneNumberId");
    const sentByPhoneMap = sumByKey(sentByPhone, "phoneNumberId");

    return {
      conversations: {
        total: total(conv),
        open: conv.OPEN ?? 0,
        pending: conv.PENDING ?? 0,
        resolved: conv.RESOLVED ?? 0,
      },
      messages7d: {
        outbound: total(out),
        sent: out.SENT ?? 0,
        delivered: out.DELIVERED ?? 0,
        read: out.READ ?? 0,
        failed: out.FAILED ?? 0,
        inbound,
      },
      campaigns: {
        total: total(camp),
        sending: camp.SENDING ?? 0,
        completed: camp.COMPLETED ?? 0,
        recipientsSent: (recip.SENT ?? 0) + (recip.DELIVERED ?? 0) + (recip.READ ?? 0),
        recipientsFailed: recip.FAILED ?? 0,
        recipientsQueued: recip.QUEUED ?? 0,
      },
      contacts,
      events: phones
        .map((p) => ({
          phoneNumberId: p.id,
          name: p.event?.name ?? "—",
          phone: p.displayPhone,
          displayName: p.displayName,
          openConversations: openByPhone[p.id] ?? 0,
          sent7d: sentByPhoneMap[p.id] ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }
}
