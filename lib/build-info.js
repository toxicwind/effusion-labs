const { execSync } = require('node:child_process');

function getBuildInfo() {
  const hash = execSync('git rev-parse --short HEAD').toString().trim();
  const date = new Date(Number(execSync('git log -1 --format=%ct').toString().trim()) * 1000);
  return { hash, date };
}

module.exports = { getBuildInfo };

