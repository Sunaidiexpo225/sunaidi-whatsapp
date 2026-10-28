import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@sunaidi/db";
import { InboundService } from "./inbound.service";

const textPayload = {
  entry: [
    {
      changes: [
        {
          field: "messages",
          value: {
            metadata: { phone_number_id: "PN1" },
            contacts: [{ profile: { name: "Dana" }, wa_id: "966511111111" }],
            messages: [
              {
                from: "966511111111",
                id: "wamid.AAA",
                timestamp: "1700000000",
                type: "text",
                text: { body: "Hello" },
              },
            ],
          },
        },
      ],
    },
  ],
};

interface Calls {
  contactUpsert: number;
  conversationUpsert: number;
  messageUpsert: number;
  statusUpdate: number;
  processed: boolean;
}

function fakePrisma(opts: {
  event: { payload: unknown; processedAt: Date | null } | null;
  phone: { id: string; workspaceId: string } | null;
  calls: Calls;
}): PrismaClient {
  const { calls } = opts;
  return {
    webhookEvent: {
      findUnique: async () => (opts.event ? { id: "evt", ...opts.event } : null),
      update: async () => {
        calls.processed = true;
        return {};
      },
    },
    phoneNumber: {
      findUnique: async () => opts.phone,
    },
    contact: {
      upsert: async () => {
        calls.contactUpsert++;
        return { id: "contact1" };
      },
    },
    conversation: {
      upsert: async () => {
        calls.conversationUpsert++;
        return { id: "conv1" };
      },
    },
    message: {
      upsert: async () => {
        calls.messageUpsert++;
        return { id: "msg1" };
      },
      updateMany: async () => {
        calls.statusUpdate++;
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient;
}

function newCalls(): Calls {
  return {
    contactUpsert: 0,
    conversationUpsert: 0,
    messageUpsert: 0,
    statusUpdate: 0,
    processed: false,
  };
}

describe("InboundService.processWebhookEvent", () => {
  it("stores a message and marks the event processed", async () => {
    const calls = newCalls();
    const prisma = fakePrisma({
      event: { payload: textPayload, processedAt: null },
      phone: { id: "phone1", workspaceId: "ws1" },
      calls,
    });
    await new InboundService(prisma).processWebhookEvent("evt");

    assert.equal(calls.contactUpsert, 1);
    assert.equal(calls.conversationUpsert, 1);
    assert.equal(calls.messageUpsert, 1);
    assert.equal(calls.processed, true);
  });

  it("skips an already-processed event", async () => {
    const calls = newCalls();
    const prisma = fakePrisma({
      event: { payload: textPayload, processedAt: new Date() },
      phone: { id: "phone1", workspaceId: "ws1" },
      calls,
    });
    await new InboundService(prisma).processWebhookEvent("evt");

    assert.equal(calls.messageUpsert, 0);
    assert.equal(calls.processed, false);
  });

  it("marks processed but writes nothing for an unregistered phone number", async () => {
    const calls = newCalls();
    const prisma = fakePrisma({
      event: { payload: textPayload, processedAt: null },
      phone: null,
      calls,
    });
    await new InboundService(prisma).processWebhookEvent("evt");

    assert.equal(calls.messageUpsert, 0);
    assert.equal(calls.processed, true);
  });
});
