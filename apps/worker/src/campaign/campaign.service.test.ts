import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractComponents } from "./campaign.service";

describe("extractComponents", () => {
  it("returns the components array when present", () => {
    assert.deepEqual(extractComponents({ components: [{ type: "body" }] }), [{ type: "body" }]);
  });

  it("returns undefined when there are no components", () => {
    assert.equal(extractComponents({}), undefined);
    assert.equal(extractComponents(null), undefined);
    assert.equal(extractComponents({ components: "nope" }), undefined);
  });
});
