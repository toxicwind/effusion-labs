import { test } from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

test("runs explicit test file", () => {
  const tmp = path.join(os.tmpdir(), "llm-sample.test.mjs");
  writeFileSync(tmp, "import test from 'node:test'; test('ok', ()=>{});");
  const env = { ...process.env };
  delete env.CI;
  const proc = spawnSync("node", ["tools/test-changed.mjs", tmp], {
    env,
    stdio: "inherit",
  });
  unlinkSync(tmp);
  assert.equal(proc.status, 0);
});
