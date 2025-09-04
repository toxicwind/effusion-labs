import net from 'net';

function parseRange(value) {
  if (!value) return null;
  const [low, high] = value.split('-').map(n => parseInt(n, 10));
  if (Number.isNaN(low) || Number.isNaN(high) || low > high) return null;
  const ports = [];
  for (let p = low; p <= high; p++) ports.push(p);
  // jitter
  for (let i = ports.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ports[i], ports[j]] = [ports[j], ports[i]];
  }
  return ports;
}

export async function claimPort(envVar, rangeVar) {
  const envPort = process.env[envVar];
  const range = process.env[rangeVar];
  if (envPort && envPort !== '0') {
    const port = Number(envPort);
    await tryPort(port);
    return port;
  }
  const rangePorts = parseRange(range);
  if (rangePorts) {
    for (const p of rangePorts) {
      try {
        await tryPort(p);
        return p;
      } catch {
        continue;
      }
    }
    throw new Error(`No available port in range ${range}`);
  }
  return 0; // ephemeral
}

function tryPort(port) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(port, () => {
      const assigned = srv.address().port;
      srv.close(() => resolve(assigned));
    });
  });
}
