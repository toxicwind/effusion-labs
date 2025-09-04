import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Registry of known servers. Each entry may be disabled until configured.
// shape: { name, cmd, args, cwd, env, enabled }

const DEMO = {
  name: "demo",
  cmd: process.execPath,
  args: [resolve(__dirname, "templates/stdio-demo.mjs")],
  cwd: resolve(__dirname, "templates"),
  env: {},
  enabled: true,
};

export function registry({ sidecars }) {
  return [
    DEMO,
    {
      name: "filesystem",
      enabled: false,
      cmd: process.execPath,
      args: [resolve(__dirname, "templates/stdio-demo.mjs"), "filesystem"],
      cwd: resolve(__dirname, "templates"),
      env: {},
    },
    {
      name: "readweb",
      enabled: false,
      cmd: process.execPath,
      args: [resolve(__dirname, "templates/stdio-demo.mjs"), "readweb"],
      cwd: resolve(__dirname, "templates"),
      env: {},
    },
    {
      name: "screenshot",
      enabled: false,
      cmd: process.execPath,
      args: [resolve(__dirname, "templates/stdio-demo.mjs"), "screenshot"],
      cwd: resolve(__dirname, "templates"),
      env: {},
    },
    {
      name: "playwright",
      enabled: false,
      cmd: process.execPath,
      args: [resolve(__dirname, "templates/stdio-demo.mjs"), "playwright"],
      cwd: resolve(__dirname, "templates"),
      env: {},
    },
    {
      name: "curl",
      enabled: false,
      cmd: process.execPath,
      args: [resolve(__dirname, "templates/stdio-demo.mjs"), "curl"],
      cwd: resolve(__dirname, "templates"),
      env: { FLARESOLVERR_URL: sidecars?.flaresolverr?.url },
    },
    {
      name: "searxng",
      enabled: Boolean(sidecars?.searxng?.url),
      cmd: process.execPath,
      args: [resolve(__dirname, "templates/stdio-demo.mjs"), "searxng"],
      cwd: resolve(__dirname, "templates"),
      env: { SEARXNG_ENGINE_URL: sidecars?.searxng?.url },
    },
  ];
}

export function findServer(specs, name) {
  return specs.find((s) => s.name === name);
}

