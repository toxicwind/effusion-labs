import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const appPath = path.join(process.cwd(), 'markdown_gateway', 'app.py');
const appSource = fs.readFileSync(appPath, 'utf8');

// Acceptance example: app.py reads solver URL from environment variable
await test('gateway reads SOLVER_URL from environment', () => {
  assert.match(appSource, /os\.environ\.get\(\"SOLVER_URL\"/);
});

// Property: default solver URL remains the internal service address
await test('gateway retains default solver URL', () => {
  assert.match(appSource, /"http:\/\/solver:8191\/v1"/);
});
