import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseInboundPayload } from "./inbound";

describe("parseInboundPayload", () => {
  it("parses an inbound text message with the sender's name", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "PN1", display_phone_number: "966500000000" },
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

    const result = parseInboundPayload(payload);
    assert.equal(result.length, 1);
    const inbound = result[0]!;
    assert.equal(inbound.phoneNumberId, "PN1");
    assert.equal(inbound.messages.length, 1);
    const msg = inbound.messages[0]!;
    assert.equal(msg.waMessageId, "wamid.AAA");
    assert.equal(msg.from, "966511111111");
    assert.equal(msg.type, "text");
    assert.equal(msg.text, "Hello");
    assert.equal(msg.profileName, "Dana");
    assert.deepEqual(msg.timestamp, new Date(1700000000 * 1000));
    // text is lifted out; raw keeps the rest.
    assert.equal((msg.raw as { text?: unknown }).text, undefined);
  });

  it("parses delivery statuses, including a failure with an error", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "PN1" },
                statuses: [
                  { id: "wamid.OUT", status: "read", recipient_id: "966511111111", timestamp: "1700000100" },
                  {
                    id: "wamid.OUT2",
                    status: "failed",
                    recipient_id: "966522222222",
                    timestamp: "1700000200",
                    errors: [{ code: 131026, title: "Message undeliverable" }],
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const result = parseInboundPayload(payload);
    assert.equal(result.length, 1);
    const statuses = result[0]!.statuses;
    assert.equal(statuses.length, 2);
    assert.equal(statuses[0]!.status, "read");
    assert.equal(statuses[1]!.status, "failed");
    assert.equal(statuses[1]!.errorCode, "131026");
    assert.equal(statuses[1]!.errorMessage, "Message undeliverable");
  });

  it("ignores non-message changes and empty payloads", () => {
    assert.deepEqual(parseInboundPayload({}), []);
    assert.deepEqual(
      parseInboundPayload({
        entry: [{ changes: [{ field: "message_template_status_update", value: {} }] }],
      }),
      [],
    );
  });

  it("skips malformed messages and unknown statuses", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "PN1" },
                messages: [{ type: "text", text: { body: "no id or from" } }],
                statuses: [{ id: "wamid.X", status: "weird", recipient_id: "x" }],
              },
            },
          ],
        },
      ],
    };
    // Nothing valid → no ParsedInbound entry at all.
    assert.deepEqual(parseInboundPayload(payload), []);
  });
});
