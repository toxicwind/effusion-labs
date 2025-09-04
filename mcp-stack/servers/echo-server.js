import readline from 'readline';

const rl = readline.createInterface({input: process.stdin, output: process.stdout});
rl.on('line', line => {
  try {
    const msg = JSON.parse(line);
    process.stdout.write(JSON.stringify(msg) + '\n');
  } catch (e) {
    // ignore
  }
});
