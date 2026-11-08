import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toOutbound } from "./outbound.service";

describe("toOutbound", () => {
  it("builds a text payload from stored content", () => {
    const out = toOutbound("text", { text: "Hello" }, "966500000000");
    assert.deepEqual(out, {
      type: "text",
      to: "966500000000",
      text: { body: "Hello" },
    });
  });

  it("returns null for empty text", () => {
    assert.equal(toOutbound("text", { text: "" }, "966500000000"), null);
  });

  it("returns null for a type we cannot send yet", () => {
    assert.equal(toOutbound("image", { id: "x" }, "966500000000"), null);
    assert.equal(toOutbound("text", {}, "966500000000"), null);
  });
});
