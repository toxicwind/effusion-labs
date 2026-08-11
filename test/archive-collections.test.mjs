import { test } from "node:test";
import assert from "node:assert";
import registerArchiveCollections from "../lib/eleventy/archive-collections.js";

// helper fake Eleventy config
function createConfig() {
  const calls = {};
  return {
    addCollection(name, fn) {
      calls[name] = fn;
    },
    calls,
  };
}

test("registerArchiveCollections discovers line collections", () => {
  const cfg = createConfig();
  registerArchiveCollections(cfg);
  const names = Object.keys(cfg.calls);
  assert.ok(names.includes("monstersProducts"));
  assert.ok(names.includes("monstersSeries"));
  assert.ok(names.includes("monstersCharacters"));

  const items = cfg.calls.monstersProducts();
  assert.ok(Array.isArray(items));
  assert.ok(items.length > 0);
});
