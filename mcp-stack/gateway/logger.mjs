// Minimal JSON logger with {ts, level, comp, server, msg, ...extra}

const levels = new Set(["debug", "info", "warn", "error"]);
const envLevel = process.env.LOG_LEVEL?.toLowerCase() || "info";
const order = { debug: 10, info: 20, warn: 30, error: 40 };

export function log(level, comp, msg, fields = {}) {
  const lvl = levels.has(level) ? level : "info";
  if (order[lvl] < order[envLevel]) return;
  const rec = { ts: new Date().toISOString(), level: lvl, comp, msg, ...fields };
  process.stdout.write(JSON.stringify(rec) + "\n");
}

export const banner = (lines = []) => {
  const bar = "═".repeat(64);
  const body = [
    "\n\x1b[95m" + bar,
    ` HYPEBRUT :: mcp-stack gateway — ${new Date().toISOString()}`,
    ...lines,
    bar + "\x1b[0m\n",
  ];
  console.error(body.join("\n"));
};

