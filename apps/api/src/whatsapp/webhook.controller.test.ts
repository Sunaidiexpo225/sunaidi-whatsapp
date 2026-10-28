import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import { WebhookController } from "./webhook.controller";

const VERIFY_TOKEN = "verify-me";
const APP_SECRET = "app-secret";

// Minimal stand-ins so the controller can be built without Nest's DI container
// (esbuild/tsx does not emit the decorator metadata Nest's DI relies on).
const config = {
  get(key: "WHATSAPP_WEBHOOK_VERIFY_TOKEN" | "WHATSAPP_APP_SECRET") {
    return key === "WHATSAPP_WEBHOOK_VERIFY_TOKEN" ? VERIFY_TOKEN : APP_SECRET;
  },
} as unknown as ConstructorParameters<typeof WebhookController>[0];

function makeController(onAccept: (payload: unknown) => void) {
  const service = {
    async acceptInboundEvent(payload: unknown) {
      onAccept(payload);
    },
  } as unknown as ConstructorParameters<typeof WebhookController>[1];
  return new WebhookController(config, service);
}

function signedRequest(body: object) {
  const raw = Buffer.from(JSON.stringify(body));
  const signature =
    "sha256=" + createHmac("sha256", APP_SECRET).update(raw).digest("hex");
  return {
    rawBody: raw,
    body,
    header(name: string) {
      return name.toLowerCase() === "x-hub-signature-256" ? signature : undefined;
    },
  } as never;
}

describe("WebhookController.verify", () => {
  it("echoes the challenge on a valid handshake", () => {
    const controller = makeController(() => {});
    assert.equal(controller.verify("subscribe", VERIFY_TOKEN, "42"), "42");
  });

  it("rejects a wrong verify token", () => {
    const controller = makeController(() => {});
    assert.throws(() => controller.verify("subscribe", "nope", "42"), BadRequestException);
  });
});

describe("WebhookController.receive", () => {
  it("accepts a correctly signed payload", async () => {
    let accepted: unknown;
    const controller = makeController((p) => {
      accepted = p;
    });
    const payload = { object: "whatsapp_business_account", entry: [] };
    const result = await controller.receive(signedRequest(payload));
    assert.deepEqual(result, { status: "accepted" });
    assert.deepEqual(accepted, payload);
  });

  it("rejects an invalid signature", async () => {
    const controller = makeController(() => {
      throw new Error("should not be called");
    });
    const req = {
      rawBody: Buffer.from("{}"),
      body: {},
      header: () => "sha256=deadbeef",
    } as never;
    await assert.rejects(() => controller.receive(req), BadRequestException);
  });

  it("rejects a missing raw body", async () => {
    const controller = makeController(() => {});
    const req = { body: {}, header: () => undefined } as never;
    await assert.rejects(() => controller.receive(req), BadRequestException);
  });
});
