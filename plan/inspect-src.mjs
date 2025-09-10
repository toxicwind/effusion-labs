#!/usr/bin/env node
/**
 * consolidate-utils.mjs
 *
 * Consolidates the `helpers` and `tools` directories into a single `utils` directory.
 */

import fs from "fs/promises";
import path from "path";

const repoRoot = process.cwd();

// --- Logging ---
function ok(...args) { console.log("\x1b[32m%s\x1b[0m", args.join(" ")); }
function warn(...args) { console.warn("\x1b[33m%s\x1b[0m", args.join(" ")); }
function err(...args) { console.error("\x1b[31m%s\x1b[0m", args.join(" ")); }

// --- The Consolidation Plan ---
const MOVE_MAP = {
    // Helpers -> utils/build
    "helpers/data/archive-nav.js": "utils/build/archive-nav.js",
    "helpers/data/archive-utils.mjs": "utils/build/archive-utils.mjs",
    "helpers/data/concept-map.js": "utils/build/concept-map.js",
    "helpers/data/homepage.js": "utils/build/homepage.js",
    "helpers/data/naming-canon.mjs": "utils/build/naming-canon.mjs",
    "helpers/utils/seeded.js": "utils/build/seeded.js",
    "helpers/utils/utils-node.mjs": "utils/build/utils-node.mjs", // Assuming this is the new name for utils.js
    "helpers/wikilink/scan.mjs": "utils/build/wikilink-scan.mjs",
    // Network helpers -> utils/network
    "tools/net/flareClient.mjs": "utils/network/flareClient.mjs",
    "tools/net/markdownGateway.mjs": "utils/network/markdownGateway.mjs",
    "tools/net/outboundProxy.mjs": "utils/network/outboundProxy.mjs",
    "tools/net/proxyAgent.mjs": "utils/network/proxyAgent.mjs",
    "tools/net/webpageToMarkdown.mjs": "utils/network/webpageToMarkdown.mjs",
    // Tools -> utils/scripts
    "tools/interlinker-operator.sh": "utils/scripts/interlinker-operator.sh",
    "tools/merge-golden.js": "utils/scripts/merge-golden.js",
    "tools/run-server.sh": "utils/scripts/run-server.sh",
    "tools/setup/env-bootstrap.sh": "utils/scripts/setup/env-bootstrap.sh",
    "tools/setup/install.sh": "utils/scripts/setup/install.sh",
    "tools/setup/provision-env.sh": "utils/scripts/setup/provision-env.sh",
    "tools/validation/proxy-health.mjs": "utils/scripts/validation/proxy-health.mjs",
    "tools/validation/validate-frontmatter.mjs": "utils/scripts/validation/validate-frontmatter.mjs",
    "tools/validation/validate-styles.mjs": "utils/scripts/validation/validate-styles.mjs",
    "tools/utils/npm-utils.js": "utils/scripts/npm-utils.js",
};

// --- Helper Functions ---
async function exists(p) {
    try {
        await fs.stat(p);
        return true;
    } catch {
        return false;
    }
}

async function moveFile(from, to) {
    const sourcePath = path.join(repoRoot, from);
    const destPath = path.join(repoRoot, to);

    if (!(await exists(sourcePath))) {
        warn(`Skipping: Source file not found at ${from}`);
        return;
    }

    const destDir = path.dirname(destPath);
    await fs.mkdir(destDir, { recursive: true });
    await fs.rename(sourcePath, destPath);
    ok(`Moved: ${from} -> ${to}`);
}

async function cleanupOldDir(dir) {
    const dirPath = path.join(repoRoot, dir);
    if (!(await exists(dirPath))) return;
    try {
        await fs.rm(dirPath, { recursive: true, force: true });
        ok(`Removed old directory: ${dir}`);
    } catch (e) {
        warn(`Could not remove ${dir}. It might have other files. Error: ${e.message}`);
    }
}


// --- Main Execution ---
async function main() {
    console.log("Consolidating `helpers` and `tools` into `utils`...");

    for (const [from, to] of Object.entries(MOVE_MAP)) {
        await moveFile(from, to);
    }

    await cleanupOldDir("helpers");
    await cleanupOldDir("tools");

    console.log("\n✅ Consolidation complete!");
}

main().catch(e => {
    err("An unexpected error occurred:", e.message);
    process.exit(1);
});