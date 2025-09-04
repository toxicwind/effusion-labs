export function log(level, comp, msg, extra = {}) {
  const line = { ts: new Date().toISOString(), level, comp, ...extra, msg };
  console.log(JSON.stringify(line));
}
