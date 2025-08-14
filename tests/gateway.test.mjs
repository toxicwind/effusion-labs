import { execSync } from 'node:child_process';
import assert from 'node:assert';
import path from 'node:path';

const projectDir = path.resolve('apps/markdown-gateway');

// Ensure Python dependencies for the gateway are installed
try {
  execSync(`python -m pip install -r ${projectDir}/requirements.txt`, { stdio: 'ignore' });
} catch (err) {
  // If installation fails, propagate error so the test fails
  throw err;
}

// Run a small Python snippet to verify health endpoint and auth
const cmd = `python -c "import sys; sys.path.insert(0, '${projectDir}'); from app import app; app.testing=True; c=app.test_client(); h=c.get('/health'); print(h.status_code); u=c.post('/convert', json={'url':'https://example.com'}); print(u.status_code)"`;
const out = execSync(cmd, { encoding: 'utf8' });
const [healthStatus, unauthorizedStatus] = out.trim().split('\n').map(Number);

assert.equal(healthStatus, 200);
assert.equal(unauthorizedStatus, 401);
