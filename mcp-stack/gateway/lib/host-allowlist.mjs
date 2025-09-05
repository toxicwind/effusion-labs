function list() {
  return (process.env.HOST_ALLOWLIST || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function assertAllowed(url) {
  const host = new URL(url).hostname;
  const allow = list();
  if (allow.length && !allow.includes(host)) {
    throw new Error(`host_not_allowed:${host}`);
  }
  return true;
}

export function isAllowed(url) {
  try {
    assertAllowed(url);
    return true;
  } catch {
    return false;
  }
}
