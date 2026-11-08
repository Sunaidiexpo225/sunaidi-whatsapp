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

  it("builds a template payload with language and components", () => {
    const out = toOutbound(
      "template",
      { name: "visitor_badge", language: "en", components: [{ type: "header" }] },
      "966500000000",
    );
    assert.deepEqual(out, {
      type: "template",
      to: "966500000000",
      template: {
        name: "visitor_badge",
        language: { code: "en" },
        components: [{ type: "header" }],
      },
    });
  });

  it("omits components when none are given", () => {
    const out = toOutbound("template", { name: "hello_world", language: "en" }, "966500000000");
    assert.deepEqual(out, {
      type: "template",
      to: "966500000000",
      template: { name: "hello_world", language: { code: "en" }, components: undefined },
    });
  });

  it("returns null for a template without a name", () => {
    assert.equal(toOutbound("template", { language: "en" }, "966500000000"), null);
  });
});
