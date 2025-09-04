import { log } from "./logger.mjs";

function envInt(name, def) {
  const v = process.env[name];
  if (!v) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export function loadConfig() {
  const PROFILE = process.env.PROFILE?.toLowerCase() || "dev";
  // Back-compat: also honor PORT_SSE if provided
  const PORT_HTTP = process.env.PORT_HTTP
    ? envInt("PORT_HTTP", 0)
    : process.env.PORT_SSE
    ? envInt("PORT_SSE", 0)
    : undefined;
  const PORT_RANGE_START = process.env.PORT_RANGE_START
    ? envInt("PORT_RANGE_START", undefined)
    : undefined;
  const PORT_RANGE_END = process.env.PORT_RANGE_END
    ? envInt("PORT_RANGE_END", undefined)
    : undefined;
  const LOG_LEVEL = process.env.LOG_LEVEL || "info";
  const HEALTH_TIMEOUT_MS = envInt("HEALTH_TIMEOUT_MS", 10_000);
  const INTERNAL_HOST = process.env.INTERNAL_HOST || "mcp-gateway";

  const cfg = {
    PROFILE,
    PORT_HTTP,
    PORT_RANGE_START,
    PORT_RANGE_END,
    LOG_LEVEL,
    HEALTH_TIMEOUT_MS,
    INTERNAL_HOST,
    SIDEcars: {
      searxng: process.env.SEARXNG_ENGINE_URL,
      flaresolverr: process.env.FLARESOLVERR_URL,
    },
  };
  log("debug", "config", "loaded", cfg);
  return cfg;
}
