import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@sunaidi/db";
import { TemplatesService } from "./templates.service";

function serviceWith(template: unknown, phone: unknown = null): TemplatesService {
  const prisma = {
    messageTemplate: {
      findUnique: async () => template,
      update: async ({ data }: { data: { status: string; metaId: string } }) => ({
        id: "t1",
        status: data.status,
        metaId: data.metaId,
      }),
    },
    phoneNumber: { findUnique: async () => phone },
  } as unknown as PrismaClient;
  return new TemplatesService(prisma);
}

describe("TemplatesService.submit", () => {
  it("rejects a template that is not DRAFT/REJECTED", async () => {
    const svc = serviceWith({ id: "t1", status: "PENDING", eventId: "e1", components: [] });
    await assert.rejects(() => svc.submit("t1"), /already PENDING/);
  });

  it("rejects a template with no owning event", async () => {
    const svc = serviceWith({
      id: "t1",
      status: "DRAFT",
      eventId: null,
      components: [],
      name: "x",
      language: "en",
      category: "UTILITY",
    });
    await assert.rejects(() => svc.submit("t1"), /Assign the template to an event/);
  });

  it("rejects when the event has no connected number", async () => {
    const svc = serviceWith(
      {
        id: "t1",
        status: "DRAFT",
        eventId: "e1",
        components: [],
        name: "x",
        language: "en",
        category: "UTILITY",
      },
      null,
    );
    await assert.rejects(() => svc.submit("t1"), /no connected WhatsApp number/);
  });

  it("rejects an unknown template", async () => {
    const svc = serviceWith(null);
    await assert.rejects(() => svc.submit("missing"), /Template not found/);
  });
});
