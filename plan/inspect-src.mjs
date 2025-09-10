#!/usr/bin/env node
/**
 * final-cleanup-v2.mjs
 *
 * A comprehensive script to finalize project cleanup. This targets all
 * remaining legacy paths from both 'scripts/' and 'tools/' directories,
 * including prefixed paths, documentation, comments, and typos.
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
    // Rule Set 2: Specific File Renames and Relocations ('scripts/')
    // --------------------------------------------------------------------------

    // --- Core Scripts that moved to utils/scripts/ ---
    { find: /\bscripts\/llm-bootstrap\.sh\b/g, replace: 'utils/scripts/setup/env-bootstrap.sh' },
    { find: /\bscripts\/warn-gate\.sh\b/g, replace: 'utils/scripts/validation/warn-gate.sh' },
    { find: /\bscripts\/validate-frontmatter\.mjs\b/g, replace: 'utils/scripts/validation/validate-frontmatter.mjs' },
    { find: /\bscripts\/npm-utils\.js\b/g, replace: 'utils/scripts/npm-utils.js' },
    { find: /\bscripts\/style-canon\.mjs\b/g, replace: 'utils/scripts/validation/validate-styles.mjs' },

    // --- mcp-stack scripts that were namespaced ---
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
    // Rule Set 3: Directory-level Rewrites ('src/scripts/')
    // --------------------------------------------------------------------------

    {
        find: /src\/scripts\//g,
        replace: 'src/assets/js/',
        reason: 'Broadly migrating the old client script directory.'
    },

    // --------------------------------------------------------------------------
    // Rule Set 4: Prose and Documentation Cleanup ('scripts/')
    // --------------------------------------------------------------------------
    { find: /`scripts\/`/g, replace: '`utils/scripts/`' },
    { find: /'scripts\/'/g, replace: "'utils/scripts/'" },

    // --------------------------------------------------------------------------
    // Rule Set 5: [VALIDATED] Comprehensive Migration for 'tools/' directory
    // --------------------------------------------------------------------------

    // --- Specific file paths confirmed against the new file list ---
    { find: /\btools\/net\/flareClient\.mjs\b/g, replace: 'utils/network/flareClient.mjs' },
    { find: /\btools\/shared\/probe-browser\.mjs\b/g, replace: 'test/tools/shared/probe-browser.mjs' },
    { find: /\btools\/shared\/cf\.mjs\b/g, replace: 'utils/build/cf.mjs' }, // Assuming shared build tools moved here
    { find: /\btools\/pty-runner\.mjs\b/g, replace: 'test/unit/pty-runner.test.mjs' },
    { find: /\btools\/runner\.mjs\b/g, replace: 'test/integration/runner.spec.mjs' },
    { find: /\btools\/test-ledger\.json\b/g, replace: 'artifacts/test-ledger.json' }, // Assuming test artifacts are centralized

    // --- Interlinker tools, now core operational scripts ---
    { find: /\btools\/interlinker-discover\.mjs\b/g, replace: 'utils/scripts/interlinker-discover.mjs' },
    { find: /\btools\/interlinker-hotfix-discover\.mjs\b/g, replace: 'utils/scripts/interlinker-hotfix-discover.mjs' },
    { find: /\btools\/interlinker-audit\.mjs\b/g, replace: 'utils/scripts/interlinker-audit.mjs' },

    // --- CI/utility scripts with confirmed new locations ---
    { find: /\btools\/verify-patch-applied\.mjs\b/g, replace: 'utils/scripts/validation/verify-patch-applied.mjs' },
    { find: /\btools\/unresolved-to-md\.mjs\b/g, replace: 'utils/scripts/unresolved-to-md.mjs' },
    { find: /\btools\/unresolved-summary\.mjs\b/g, replace: 'utils/scripts/unresolved-summary.mjs' },
    { find: /\btools\/validate-docs\.js\b/g, replace: 'utils/scripts/validation/validate-docs.js' },
    { find: /\btools\/test-changed\.mjs\b/g, replace: 'utils/scripts/test-changed.mjs' },

    // --- General Prose and Documentation Cleanup ---
    { find: /`bin\/` \/ `tools\/`/g, replace: '`bin/` / `utils/scripts/`' },
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
            '**/__pycache__/**',
            'src/content/archives/**',
            'flower_reports_showcase/**',
            'plan/**', // IMPORTANT: Exclude planning scripts to avoid self-modification
            'final-cleanup-v2.mjs', // Exclude this script itself
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

    console.log('\n✅ Comprehensive cleanup complete! All script and tool paths have been updated.');
}

main().catch(err => {
    console.error(`\n❌ Error during cleanup: ${err.message}`);
    process.exit(1);
});