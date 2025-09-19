// eslint.config.js
import globals from 'globals';
import standard from 'eslint-config-standard';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import promisePlugin from 'eslint-plugin-promise';
import nPlugin from 'eslint-plugin-n';

/**
 * An "Awesome" ESLint configuration for a modern Eleventy project using ESM.
 *
 * Features:
 * - Uses modern "flat config" format.
 * - Integrates seamlessly with Prettier.
 * - Intelligently handles Eleventy's structure to avoid false positives.
 * - Includes Vulture-like rules to find unused JavaScript modules.
 */
export default [
    // 1. Global Ignores
    {
        ignores: [
            '_site/',
            '.11ty-vite/',
            'node_modules/',
            'public/vite/',
            'coverage/',
        ],
    },

    // 2. Base Configuration for all JavaScript files
    {
        files: ['**/*.js', '**/*.mjs'],
        plugins: {
            import: importPlugin,
            promise: promisePlugin,
            n: nPlugin,
        },
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
        // Start with the trusted 'standard' ruleset, then disable conflicting Prettier rules.
        rules: {
            ...standard.rules,
            ...prettier.rules,

            // --- "Vulture for JS" ---
            // This rule is the star of the show for finding dead code.
            // It identifies any exported function, class, or variable that isn't
            // imported by another JavaScript module.
            'import/no-unused-modules': ['error', { unusedExports: true }],

            // Other sensible overrides
            'no-console': 'warn', // Warn about console.log instead of erroring
        },
        settings: {
            'import/resolver': {
                node: {
                    extensions: ['.js', '.mjs'],
                },
            },
        },
    },

    // 3. Specific Overrides for Project Structure (The "Awesome" Part)
    {
        // --- For Eleventy Filters & Shortcodes ---
        // These files export functions that are used by Nunjucks templates,
        // not by other JS modules. We must disable the unused-modules rule here
        // to prevent a flood of false positives. This is the key to a happy
        // 11ty linting experience.
        files: ['src/lib/filters/**/*.mjs', 'src/lib/shortcodes/**/*.mjs'],
        rules: {
            'import/no-unused-modules': 'off',
        },
    },
    {
        // --- For Config and Tooling Files ---
        // These are developer-facing scripts, not production code. It's okay
        // to have console logs or dependencies that are only for development.
        files: ['eleventy.config.mjs', 'tools/**/*.mjs', 'mcp-stack/**/*.mjs'],
        rules: {
            'no-console': 'off', // Console logs are useful in build scripts
        },
    },
    {
        // --- For Test Files ---
        files: ['test/**/*.mjs'],
        languageOptions: {
            globals: {
                // Define common testing globals here if you have them
                // e.g., describe: 'readonly', it: 'readonly', ...
            },
        },
        rules: {
            // It's common for test files to have many dev dependencies
            'n/no-unpublished-import': 'off',
        },
    },
];