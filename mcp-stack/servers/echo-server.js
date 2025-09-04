// minimal stdio server placeholder
process.stdin.on('data', chunk => {
  const msg = chunk.toString();
  if (msg.trim() === 'ping') {
    process.stdout.write('pong\n');
  }
});
setInterval(() => {}, 1000); // keep alive
