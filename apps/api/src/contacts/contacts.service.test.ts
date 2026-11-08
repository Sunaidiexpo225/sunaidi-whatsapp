import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@sunaidi/db";
import { ContactsService } from "./contacts.service";

describe("ContactsService.import", () => {
  it("normalises phones, de-duplicates, skips junk, and counts created vs updated", async () => {
    const upserts: string[] = [];
    const existing = new Set(["966500000002"]); // this one already exists
    const prisma = {
      phoneNumber: { findUnique: async () => null },
      workspace: { findFirst: async () => ({ id: "ws1" }) },
      contact: {
        findUnique: async ({ where }: { where: { workspaceId_waId: { waId: string } } }) =>
          existing.has(where.workspaceId_waId.waId) ? { id: "c1" } : null,
        upsert: async ({ where }: { where: { workspaceId_waId: { waId: string } } }) => {
          upserts.push(where.workspaceId_waId.waId);
          return { id: "c1" };
        },
      },
    } as unknown as PrismaClient;

    const result = await new ContactsService(prisma).import([
      { to: "+966 50 000 0001", name: "Dana" },
      { to: "966500000001" }, // duplicate of the first after normalising
      { to: "966500000002" }, // already exists -> updated
      { to: "123" }, // too short -> skipped
    ]);

    assert.deepEqual(result, { created: 1, updated: 1, skipped: 2 });
    assert.deepEqual(upserts, ["966500000001", "966500000002"]);
  });
});

describe("ContactsService.addTag", () => {
  it("rejects when the tag and contact are in different workspaces", async () => {
    const prisma = {
      contact: { findUnique: async () => ({ workspaceId: "ws1" }) },
      tag: { findUnique: async () => ({ workspaceId: "ws2" }) },
    } as unknown as PrismaClient;

    await assert.rejects(
      () => new ContactsService(prisma).addTag("c1", "t1"),
      /different workspaces/,
    );
  });
});
