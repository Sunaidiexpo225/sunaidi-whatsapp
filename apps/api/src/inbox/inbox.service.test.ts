import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@sunaidi/db";
import { InboxService } from "./inbox.service";

function prismaWith(conversationRows: unknown[]): PrismaClient {
  return {
    conversation: {
      findMany: async () => conversationRows,
    },
  } as unknown as PrismaClient;
}

describe("InboxService.listConversations", () => {
  it("extracts the last message text and shapes the summary", async () => {
    const prisma = prismaWith([
      {
        id: "conv1",
        status: "OPEN",
        lastMessageAt: new Date("2026-11-08T06:00:00Z"),
        contact: { id: "c1", name: "Dana", waId: "966511111111" },
        messages: [
          {
            type: "text",
            content: { text: "Hello there" },
            direction: "INBOUND",
            createdAt: new Date("2026-11-08T06:00:00Z"),
          },
        ],
      },
    ]);

    const result = await new InboxService(prisma).listConversations({});
    assert.equal(result.length, 1);
    assert.equal(result[0]!.contact.name, "Dana");
    assert.equal(result[0]!.lastMessage?.text, "Hello there");
  });

  it("returns null text for a non-text message and no messages", async () => {
    const prisma = prismaWith([
      {
        id: "conv2",
        status: "OPEN",
        lastMessageAt: null,
        contact: { id: "c2", name: null, waId: "966522222222" },
        messages: [{ type: "image", content: {}, direction: "INBOUND", createdAt: new Date() }],
      },
    ]);

    const result = await new InboxService(prisma).listConversations({});
    assert.equal(result[0]!.lastMessage?.text, null);
    assert.equal(result[0]!.lastMessage?.type, "image");
  });
});
