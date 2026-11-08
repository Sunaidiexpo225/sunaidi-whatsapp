import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@sunaidi/db";
import type { Queue } from "bullmq";
import { CampaignService } from "./campaign.service";

describe("CampaignService.create", () => {
  it("creates a campaign and de-duplicates recipients by phone", async () => {
    const createManyCalls: unknown[] = [];
    const prisma = {
      phoneNumber: { findUnique: async () => ({ id: "p1", workspaceId: "ws1" }) },
      campaign: { create: async () => ({ id: "camp1", status: "DRAFT" }) },
      contact: { upsert: async ({ where }: { where: { workspaceId_waId: { waId: string } } }) => ({ id: `c-${where.workspaceId_waId.waId}` }) },
      campaignRecipient: {
        createMany: async (args: unknown) => {
          createManyCalls.push(args);
          return { count: 0 };
        },
      },
    } as unknown as PrismaClient;
    const queue = { add: async () => {} } as unknown as Queue;

    const result = await new CampaignService(prisma, queue).create({
      eventId: "11111111-1111-1111-1111-111111111111",
      name: "Launch",
      templateName: "promo",
      templateLanguage: "en",
      recipients: [
        { to: "966500000001" },
        { to: "966500000001" }, // duplicate
        { to: "966500000002", components: [{ type: "body" }] },
      ],
    });

    assert.equal(result.id, "camp1");
    assert.equal(result.recipientCount, 2);
    const data = (createManyCalls[0] as { data: unknown[] }).data;
    assert.equal(data.length, 2);
  });

  it("rejects when the event has no WhatsApp number", async () => {
    const prisma = {
      phoneNumber: { findUnique: async () => null },
    } as unknown as PrismaClient;
    const queue = { add: async () => {} } as unknown as Queue;
    await assert.rejects(
      () =>
        new CampaignService(prisma, queue).create({
          eventId: "11111111-1111-1111-1111-111111111111",
          name: "x",
          templateName: "t",
          templateLanguage: "en",
          recipients: [{ to: "966500000001" }],
        }),
      /No WhatsApp number/,
    );
  });
});

describe("CampaignService.list", () => {
  it("merges per-status recipient counts into each campaign", async () => {
    const prisma = {
      campaign: {
        findMany: async () => [
          {
            id: "camp1",
            name: "Launch",
            status: "SENDING",
            templateName: "promo",
            templateLanguage: "en",
            createdAt: new Date(),
            startedAt: null,
            completedAt: null,
            event: { name: "Expo" },
            _count: { recipients: 5 },
          },
        ],
      },
      campaignRecipient: {
        groupBy: async () => [
          { campaignId: "camp1", status: "SENT", _count: { _all: 2 } },
          { campaignId: "camp1", status: "DELIVERED", _count: { _all: 1 } },
          { campaignId: "camp1", status: "FAILED", _count: { _all: 1 } },
          { campaignId: "camp1", status: "QUEUED", _count: { _all: 1 } },
        ],
      },
    } as unknown as PrismaClient;

    const rows = await new CampaignService(prisma, {} as unknown as Queue).list();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.eventName, "Expo");
    assert.deepEqual(rows[0]!.recipients, { total: 5, sent: 3, failed: 1, queued: 1 });
  });
});

describe("CampaignService.start", () => {
  it("moves to SENDING and enqueues one job per queued recipient", async () => {
    const enqueued: unknown[] = [];
    const prisma = {
      campaign: {
        findUnique: async () => ({
          id: "camp1",
          status: "DRAFT",
          scheduledAt: null,
          recipients: [{ id: "r1" }, { id: "r2" }],
        }),
        update: async () => ({}),
      },
    } as unknown as PrismaClient;
    const queue = {
      add: async (_n: string, job: unknown) => {
        enqueued.push(job);
      },
    } as unknown as Queue;

    const result = await new CampaignService(prisma, queue).start("camp1");
    assert.equal(result.status, "SENDING");
    assert.equal(result.queued, 2);
    assert.equal(enqueued.length, 2);
    assert.deepEqual(enqueued[0], { campaignId: "camp1", recipientId: "r1" });
  });

  it("stays SCHEDULED and delays the jobs when scheduledAt is in the future", async () => {
    const opts: Array<Record<string, unknown>> = [];
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const prisma = {
      campaign: {
        findUnique: async () => ({
          id: "camp1",
          status: "DRAFT",
          scheduledAt: future,
          recipients: [{ id: "r1" }],
        }),
        update: async () => ({}),
      },
    } as unknown as PrismaClient;
    const queue = {
      add: async (_n: string, _job: unknown, o: Record<string, unknown>) => {
        opts.push(o);
      },
    } as unknown as Queue;

    const result = await new CampaignService(prisma, queue).start("camp1");
    assert.equal(result.status, "SCHEDULED");
    assert.ok(typeof opts[0]!.delay === "number" && (opts[0]!.delay as number) > 0);
    assert.equal(opts[0]!.jobId, "r1");
  });
});

describe("CampaignService.createFromAudience", () => {
  it("resolves matching contacts into recipient rows", async () => {
    let createManyCount = 0;
    const prisma = {
      phoneNumber: { findUnique: async () => ({ id: "p1", workspaceId: "ws1" }) },
      contact: { findMany: async () => [{ id: "c1" }, { id: "c2" }, { id: "c3" }] },
      campaign: { create: async () => ({ id: "camp1", status: "DRAFT" }) },
      campaignRecipient: {
        createMany: async ({ data }: { data: unknown[] }) => {
          createManyCount = data.length;
          return { count: data.length };
        },
      },
    } as unknown as PrismaClient;

    const result = await new CampaignService(prisma, {} as unknown as Queue).createFromAudience({
      eventId: "11111111-1111-1111-1111-111111111111",
      name: "Opted-in blast",
      templateName: "promo",
      templateLanguage: "en",
      consent: "OPTED_IN" as never,
    });

    assert.equal(result.recipientCount, 3);
    assert.equal(createManyCount, 3);
  });
});
