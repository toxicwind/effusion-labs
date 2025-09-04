import { createServer } from "node:net";

export async function findPort({ fixed, start, end }) {
  if (Number.isFinite(fixed)) {
    await assertFree(fixed);
    return fixed;
  }
  if (Number.isFinite(start) && Number.isFinite(end)) {
    for (let p = start; p <= end; p++) {
      if (await isFree(p)) return p;
    }
    throw new Error(`No free port in range ${start}-${end}`);
  }
  // Ephemeral
  return 0;
}

async function assertFree(port) {
  if (!(await isFree(port))) throw new Error(`Port ${port} is in use`);
}

function isFree(port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => resolve(false));
    srv.listen(port, "0.0.0.0", () => {
      srv.close(() => resolve(true));
    });
  });
}

