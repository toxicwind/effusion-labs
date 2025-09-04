import net from 'node:net';

async function probe(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => { resolve(false); });
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '0.0.0.0');
  });
}

async function findInRange(range) {
  const [low, high] = range.split('-').map(Number);
  for (let i = 0; i < 20; i++) {
    const candidate = low + Math.floor(Math.random() * (high - low + 1));
    if (await probe(candidate)) return candidate;
  }
  throw new Error(`no free port in range ${range}`);
}

export async function resolvePort(name) {
  const fixed = process.env[`PORT_${name}`];
  const range = process.env[`PORT_RANGE_${name}`];
  if (fixed) {
    const num = parseInt(fixed, 10);
    if (num === 0) return 0; // ephemeral
    if (await probe(num)) return num;
    if (range) return findInRange(range);
    throw new Error(`port ${num} for ${name} busy`);
  }
  if (range) return findInRange(range);
  return 0; // default ephemeral
}
