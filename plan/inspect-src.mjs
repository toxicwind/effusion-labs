#!/usr/bin/env node
/**
 * final-cleanup-v2.mjs
 *
 * A comprehensive script to finalize project cleanup. This targets all
 * remaining legacy paths, including prefixed paths, documentation,
 * comments, and typos missed by the first pass.
 */

import fse from 'fs-extra';
import fg from 'fast-glob';
import ora from 'ora';

// --- The Comprehensive Cleanup Plan ---

const REWRITE_RULES = [
    // --------------------------------------------------------------------------
    // Rule Set 1: High-Confidence Fixes (Typos and very specific paths)
    // --------------------------------------------------------------------------

    // Fixes the common `utils/utils/` typo found in package.json
    {
        find: /utils\/utils\/scripts/g,
        replace: 'utils/scripts',
        reason: 'Correcting a duplicated path segment.'
    },
    // Fixes an absolute path to a deleted script found in an old log file.
    {
        find: /\/workspace\/effusion-labs\/scripts\/llm-constants\.sh/g,
        replace: 'utils/scripts/setup/env-bootstrap.sh',
        reason: 'Replacing a deleted constants script with its successor.'
    },
    // Fixes the tailwind.config.js content path glob in README.md
    {
        find: /'\.\.\/scripts\/\*\*\/ \*\.js'/g,
        replace: "'../assets/js/**/*.js'",
        reason: 'Updating CSS content glob to the new JS asset path.'
    },

    // --------------------------------------------------------------------------
    // Rule Set 2: Specific File Renames and Relocations
    // --------------------------------------------------------------------------

    // --- Core Scripts that moved to utils/scripts/ ---
    { find: /\bscripts\/llm-bootstrap\.sh\b/g, replace: 'utils/scripts/setup/env-bootstrap.sh' },
    { find: /\bscripts\/warn-gate\.sh\b/g, replace: 'utils/scripts/validation/warn-gate.sh' },
    { find: /\bscripts\/validate-frontmatter\.mjs\b/g, replace: 'utils/scripts/validation/validate-frontmatter.mjs' },
    { find: /\bscripts\/npm-utils\.js\b/g, replace: 'utils/scripts/npm-utils.js' },
    { find: /\bscripts\/style-canon\.mjs\b/g, replace: 'utils/scripts/validation/validate-styles.mjs' },

    // --- mcp-stack scripts that were namespaced ---
    // These rules now correctly handle unqualified `scripts/` paths.
    { find: /(?<!mcp-stack\/)\bscripts\/engine-detect\.sh\b/g, replace: 'mcp-stack/scripts/engine-detect.sh' },
    { find: /(?<!mcp-stack\/)\bscripts\/run\.sh\b/g, replace: 'mcp-stack/scripts/run.sh' },
    { find: /(?<!mcp-stack\/)\bscripts\/check-health\.sh\b/g, replace: 'mcp-stack/scripts/check-health.sh' },

    // --- Deprecated scripts (mapping to modern equivalents) ---
    {
        find: /\bscripts\/test-with-guardrails\.sh\b/g,
        replace: 'utils/scripts/validation/warn-gate.sh', // Best guess for the successor
        reason: 'Mapping a deleted test script to its likely successor.'
    },
    {
        find: /\bscripts\/site-refactor\.mjs\b/g,
        replace: 'plan/inspect-src-two.mjs', // The script was renamed and moved to plan/
        reason: 'Updating references in comments to the refactor script\'s new name.'
    },

    // --------------------------------------------------------------------------
    // Rule Set 3: Directory-level Rewrites
    // --------------------------------------------------------------------------

    // Catch-all for any remaining JS client scripts moved from `src/scripts`
    {
        find: /src\/scripts\//g,
        replace: 'src/assets/js/',
        reason: 'Broadly migrating the old client script directory.'
    },

    // --------------------------------------------------------------------------
    // Rule Set 4: Prose and Documentation Cleanup (Use with care)
    // --------------------------------------------------------------------------
    // These make docs and descriptions consistent with the new structure.
    { find: /`scripts\/`/g, replace: '`utils/scripts/`' },
    { find: /'scripts\/'/g, replace: "'utils/scripts/'" },
];

// --- Main Execution ---
async function main() {
    console.log('🧹 Starting comprehensive project cleanup (v2)...');

    const rewriteSpinner = ora('Fixing all remaining legacy references...').start();
    const files = await fg('**/*', {
        dot: true,
        ignore: [
            'node_modules/**',
            '.git/**',
            '.conda/**',
            '_site/**',
            '**/__pycache__/**',
            'plan/**', // IMPORTANT: Exclude planning scripts to avoid self-modification
            'inspect-src.mjs', // Exclude this script itself
        ],
        binary: false,
    });

    let rewrittenCount = 0;
    for (const file of files) {
        try {
            let content = await fse.readFile(file, 'utf8');
            const originalContent = content;

            for (const rule of REWRITE_RULES) {
                content = content.replace(rule.find, rule.replace);
            }

            if (content !== originalContent) {
                await fse.writeFile(file, content, 'utf8');
                rewrittenCount++;
            }
        } catch (e) {
            // Ignore errors for binary files etc.
        }
    }
    rewriteSpinner.succeed(`Fixed paths in ${rewrittenCount} files.`);

    console.log('\n✅ Comprehensive cleanup complete!');
}

main().catch(err => {
    console.error(`\n❌ Error during cleanup: ${err.message}`);
    process.exit(1);
});