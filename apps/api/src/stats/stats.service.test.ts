import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@sunaidi/db";
import { StatsService } from "./stats.service";

function countRow<T extends Record<string, string>>(fields: T, n: number) {
  return { ...fields, _count: { _all: n } };
}

describe("StatsService.getDashboard", () => {
  it("aggregates counts and builds the per-event rows", async () => {
    const prisma = {
      conversation: {
        groupBy: async ({ by }: { by: string[] }) =>
          by.includes("status")
            ? [countRow({ status: "OPEN" }, 3), countRow({ status: "RESOLVED" }, 2)]
            : [countRow({ phoneNumberId: "p1" }, 3)],
      },
      message: {
        groupBy: async ({ by }: { by: string[] }) =>
          by.includes("status")
            ? [countRow({ status: "SENT" }, 4), countRow({ status: "DELIVERED" }, 5), countRow({ status: "READ" }, 1)]
            : [countRow({ phoneNumberId: "p1" }, 9)],
        count: async () => 7,
      },
      campaign: {
        groupBy: async () => [countRow({ status: "SENDING" }, 1), countRow({ status: "COMPLETED" }, 2)],
      },
      campaignRecipient: {
        groupBy: async () => [countRow({ status: "SENT" }, 10), countRow({ status: "FAILED" }, 2)],
      },
      contact: { count: async () => 42 },
      phoneNumber: {
        findMany: async () => [
          { id: "p1", displayPhone: "+966500000000", displayName: "Expo", event: { name: "Franchise Expo" } },
        ],
      },
    } as unknown as PrismaClient;

    const result = await new StatsService(prisma).getDashboard();

    assert.equal(result.conversations.total, 5);
    assert.equal(result.conversations.open, 3);
    assert.equal(result.messages7d.outbound, 10);
    assert.equal(result.messages7d.read, 1);
    assert.equal(result.messages7d.inbound, 7);
    assert.equal(result.campaigns.recipientsSent, 10);
    assert.equal(result.campaigns.recipientsFailed, 2);
    assert.equal(result.contacts, 42);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0]!.name, "Franchise Expo");
    assert.equal(result.events[0]!.openConversations, 3);
    assert.equal(result.events[0]!.sent7d, 9);
  });
});
