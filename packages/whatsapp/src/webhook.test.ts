import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { handleVerificationChallenge, verifyWebhookSignature } from "./webhook";

const APP_SECRET = "test-app-secret";

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", APP_SECRET).update(body).digest("hex");
}

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

  it("accepts a correctly signed body", () => {
    assert.equal(verifyWebhookSignature(body, sign(body), APP_SECRET), true);
  });

  it("rejects a tampered body", () => {
    assert.equal(verifyWebhookSignature(body + " ", sign(body), APP_SECRET), false);
  });

  it("rejects a wrong secret", () => {
    const wrong = "sha256=" + createHmac("sha256", "other").update(body).digest("hex");
    assert.equal(verifyWebhookSignature(body, wrong, APP_SECRET), false);
  });

  it("rejects a missing or malformed header", () => {
    assert.equal(verifyWebhookSignature(body, undefined, APP_SECRET), false);
    assert.equal(verifyWebhookSignature(body, "deadbeef", APP_SECRET), false);
  });

  it("works on a Buffer body", () => {
    assert.equal(verifyWebhookSignature(Buffer.from(body), sign(body), APP_SECRET), true);
  });
});

describe("handleVerificationChallenge", () => {
  it("echoes the challenge when mode and token match", () => {
    const result = handleVerificationChallenge(
      { mode: "subscribe", token: "verify-me", challenge: "12345" },
      "verify-me",
    );
    assert.equal(result, "12345");
  });

  it("returns null when the token is wrong", () => {
    const result = handleVerificationChallenge(
      { mode: "subscribe", token: "wrong", challenge: "12345" },
      "verify-me",
    );
    assert.equal(result, null);
  });

  it("returns null when the mode is not subscribe", () => {
    const result = handleVerificationChallenge(
      { mode: "unsubscribe", token: "verify-me", challenge: "12345" },
      "verify-me",
    );
    assert.equal(result, null);
  });
});
