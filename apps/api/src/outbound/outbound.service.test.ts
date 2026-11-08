import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@sunaidi/db";
import type { Queue } from "bullmq";
import { OutboundService } from "./outbound.service";

interface Fakes {
  created: unknown[];
  enqueued: unknown[];
}

function serviceWith(lastInboundAt: Date | null): { service: OutboundService; fakes: Fakes } {
  const fakes: Fakes = { created: [], enqueued: [] };
  const prisma = {
    conversation: {
      findUnique: async () => ({
        id: "conv1",
        workspaceId: "ws1",
        contactId: "c1",
        phoneNumberId: "p1",
        lastInboundAt,
      }),
      update: async () => ({}),
    },
    message: {
      create: async ({ data }: { data: unknown }) => {
        fakes.created.push(data);
        return { id: "m1", status: "QUEUED" };
      },
    },
  } as unknown as PrismaClient;

  const queue = {
    add: async (_name: string, job: unknown) => {
      fakes.enqueued.push(job);
    },
  } as unknown as Queue;

  return { service: new OutboundService(prisma, queue), fakes };
}

describe("OutboundService.sendText", () => {
  it("queues a message when inside the 24h window", async () => {
    const { service, fakes } = serviceWith(new Date());
    const result = await service.sendText("conv1", "  hi there  ");
    assert.equal(result.id, "m1");
    assert.equal(fakes.created.length, 1);
    assert.equal(fakes.enqueued.length, 1);
    assert.deepEqual(fakes.enqueued[0], { messageId: "m1" });
    // Text is trimmed before storing.
    assert.deepEqual((fakes.created[0] as { content: unknown }).content, { text: "hi there" });
  });

  it("rejects when outside the 24h window", async () => {
    const { service, fakes } = serviceWith(new Date(Date.now() - 25 * 60 * 60 * 1000));
    await assert.rejects(() => service.sendText("conv1", "hi"), /24-hour/);
    assert.equal(fakes.created.length, 0);
    assert.equal(fakes.enqueued.length, 0);
  });

  it("rejects when there is no inbound message yet", async () => {
    const { service } = serviceWith(null);
    await assert.rejects(() => service.sendText("conv1", "hi"), /24-hour/);
  });

  it("rejects empty text", async () => {
    const { service } = serviceWith(new Date());
    await assert.rejects(() => service.sendText("conv1", "   "), /required/);
  });
});

function templateServiceWith(phone: unknown): { service: OutboundService; fakes: Fakes } {
  const fakes: Fakes = { created: [], enqueued: [] };
  const prisma = {
    phoneNumber: { findUnique: async () => phone },
    contact: { upsert: async () => ({ id: "c1" }) },
    conversation: { upsert: async () => ({ id: "conv1" }) },
    message: {
      create: async ({ data }: { data: unknown }) => {
        fakes.created.push(data);
        return { id: "m2", status: "QUEUED" };
      },
    },
  } as unknown as PrismaClient;

  const queue = {
    add: async (_name: string, job: unknown) => {
      fakes.enqueued.push(job);
    },
  } as unknown as Queue;

  return { service: new OutboundService(prisma, queue), fakes };
}

describe("OutboundService.sendTemplate", () => {
  it("queues a template send for a configured event (no window check)", async () => {
    const { service, fakes } = templateServiceWith({ id: "p1", workspaceId: "ws1" });
    const result = await service.sendTemplate({
      eventId: "11111111-1111-1111-1111-111111111111",
      to: "966500000000",
      name: "visitor_badge",
      language: "en",
      components: [{ type: "header" }],
    });
    assert.equal(result.id, "m2");
    assert.equal(fakes.enqueued.length, 1);
    const data = fakes.created[0] as { type: string; content: unknown };
    assert.equal(data.type, "template");
    assert.deepEqual(data.content, {
      name: "visitor_badge",
      language: "en",
      components: [{ type: "header" }],
    });
  });

  it("rejects when the event has no WhatsApp number", async () => {
    const { service, fakes } = templateServiceWith(null);
    await assert.rejects(
      () =>
        service.sendTemplate({
          eventId: "11111111-1111-1111-1111-111111111111",
          to: "966500000000",
          name: "visitor_badge",
          language: "en",
        }),
      /No WhatsApp number/,
    );
    assert.equal(fakes.enqueued.length, 0);
  });
});
