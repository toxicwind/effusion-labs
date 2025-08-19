#!/usr/bin/env node
const libnpmsearch = require('libnpmsearch');
const npmFetch = require('npm-registry-fetch');

async function getLatestVersion(pkg) {
  const results = await libnpmsearch(pkg, { size: 1 });
  if (results.length === 0 || results[0].name !== pkg) {
    throw new Error(`Package "${pkg}" not found`);
  }
  const info = await npmFetch.json(pkg);
  return info['dist-tags']?.latest || info.version;
}

async function main() {
  const [, , pkg] = process.argv;
  if (!pkg) {
    console.error('Usage: npm-utils <package>');
    process.exit(1);
  }
  try {
    const version = await getLatestVersion(pkg);
    console.log(version);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

main();
