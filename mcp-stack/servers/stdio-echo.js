process.stdin.on('data', (chunk) => {
  const line = chunk.toString().trim();
  if (line === 'ping') {
    process.stdout.write('pong\n');
  } else {
    process.stdout.write(`echo:${line}\n`);
  }
});
