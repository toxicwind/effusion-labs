import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function build() {
  // Show Eleventy logs in the test output
  execSync("npx @11ty/eleventy", { stdio: "inherit" });
}

function exists(p) {
  return fs.existsSync(path.normalize(p));
}

test("Eleventy build generates expected assets and pages", { timeout: 5 * 60_000 }, () => {
  build();

  const expected = [
    "_site/assets/css/app.css",
    "_site/archives/index.html",
    "_site/archives/collectables/designer-toys/pop-mart/the-monsters/products/pop-mart--the-monsters--labubu--time-to-chill--plush--std--20221031/index.html",
  ];

  for (const file of expected) {
    assert.ok(exists(file), `missing build artifact: ${file}`);
  }
});
