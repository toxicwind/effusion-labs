// eslint.config.js — fixed for unicorn-magic dependency issue
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import n from 'eslint-plugin-n';
import promise from 'eslint-plugin-promise';
import unicorn from 'eslint-plugin-unicorn';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';

export default [
    // Ignores
    {
        ignores: [
            'node_modules/**',
            '_site/**',
            'dist/**',
            '.11ty-vite/**',
            'artifacts/**',
            'coverage/**',
            'public/vite/**',
            '.conda/**',
            'src/content/docs/**'
        ]
    },

    // Base
    js.configs.recommended,

    // Core project settings
    {
        files: ['**/*.{js,mjs,ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: { ...globals.node, ...globals.browser },
            parserOptions: { ecmaVersion: 'latest', sourceType: 'module' }
        },
        plugins: {
            import: importPlugin,
            n,
            promise,
            unicorn,
            'unused-imports': unusedImports
        },
        settings: {
            'import/parsers': { espree: ['.js', '.cjs', '.mjs', '.jsx'] },
            'import/resolver': {
                // Use Node resolver only - avoid problematic alias resolvers
                node: {
                    extensions: ['.js', '.mjs', '.ts', '.tsx', '.json'],
                    paths: ['src', 'node_modules']
                }
            },
            'import/core-modules': ['@tailwindcss/vite'],
            'import/ignore': ['^https?://', '\\.(css|sass|scss)$', '^@/']  // Ignore @ imports for now
        },
        rules: {
            // Imports - relaxed to avoid resolver conflicts
            'import/no-unresolved': ['error', {
                ignore: ['^https?://', '^@/'] // Ignore @ imports until resolver is stable
            }],
            'import/named': 'error',
            'import/default': 'error',
            'import/namespace': 'error',
            'import/no-absolute-path': 'error',
            'import/no-self-import': 'error',
            'import/no-cycle': 'off', // Disable the problematic rule temporarily
            'import/no-useless-path-segments': 'error',
            'import/no-relative-parent-imports': 'off',
            'import/no-unused-modules': 'off',

            // Unused (imports + vars)
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'unused-imports/no-unused-imports': 'error',
            'unused-imports/no-unused-vars': [
                'error',
                { vars: 'all', args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
            ],

            // Promises — quiet for CI
            'promise/catch-or-return': 'off',
            'promise/no-return-wrap': 'off',
            'promise/param-names': 'off',
            'promise/always-return': 'off',
            'promise/no-native': 'off',

            // Ergonomics
            'no-console': 'off',
            'no-empty': 'off',

            // Unicorn — keep only two correctness checks
            'unicorn/better-regex': 'error',
            'unicorn/no-new-array': 'error',

            // Everything else off
            'unicorn/prevent-abbreviations': 'off',
            'unicorn/no-null': 'off',
            'unicorn/prefer-string-replace-all': 'off',
            'unicorn/import-style': 'off',
            'unicorn/prefer-top-level-await': 'off',
            'unicorn/no-anonymous-default-export': 'off',
            'unicorn/filename-case': 'off',
            'unicorn/prefer-module': 'off',
            'unicorn/no-array-sort': 'off',
            'unicorn/prefer-math-min-max': 'off',
            'unicorn/prefer-number-properties': 'off',
            'unicorn/prefer-optional-catch-binding': 'off',
            'unicorn/prefer-single-call': 'off',
            'unicorn/explicit-length-check': 'off',
            'unicorn/no-array-for-each': 'off',
            'unicorn/no-array-callback-reference': 'off',
            'unicorn/no-negated-condition': 'off',
            'unicorn/no-nested-ternary': 'off',
            'unicorn/no-zero-fractions': 'off',
            'unicorn/number-literal-case': 'off',
            'unicorn/numeric-separators-style': 'off',
            'unicorn/prefer-at': 'off',
            'unicorn/prefer-string-starts-ends-with': 'off',
            'unicorn/prefer-query-selector': 'off',
            'unicorn/prefer-modern-dom-apis': 'off',
            'unicorn/prefer-dom-node-append': 'off',
            'unicorn/prefer-dom-node-dataset': 'off',
            'unicorn/prefer-string-raw': 'off',
            'unicorn/escape-case': 'off',
            'unicorn/no-hex-escape': 'off',
            'unicorn/consistent-function-scoping': 'off',
            'unicorn/catch-error-name': 'off',
            'unicorn/prefer-spread': 'off',
            'unicorn/prefer-switch': 'off',
            'unicorn/prefer-set-has': 'off'
        }
    },

    // TS (syntax-level only)
    ...tseslint.configs.recommended.map(cfg => ({
        ...cfg,
        files: ['src/**/*.{ts,tsx}']
    })),

    // Eleventy conventions
    {
        files: [
            'src/_data/**/*.{js,mjs,ts}',
            'src/**/*.11ty.{js,ts}',
            'src/**/*.11tydata.{js,ts}',
            'eleventy.config.mjs'
        ],
        rules: {
            'import/no-unused-modules': 'off',
            'no-unused-vars': 'off',
            'unused-imports/no-unused-imports': 'off'
        }
    },

    // DOM-heavy assets
    {
        files: ['src/assets/js/**/*.{js,mjs}'],
        languageOptions: { globals: { __mschfCull: 'readonly' } },
        rules: {
            'no-console': 'off',
            'no-empty': 'off',
            'no-undef': 'off',
            'no-unused-vars': 'off',
            'no-useless-escape': 'off',
            'unicorn/no-new-array': 'off' // Disable for DOM files
        }
    },

    // Net helpers (WIP)
    {
        files: ['src/lib/net/**/*.{js,mjs,ts}'],
        rules: { 'import/no-unresolved': 'off' }
    },

    // MCP stack + tools
    {
        files: ['mcp-stack/**/*.mjs', 'tools/**/*.mjs'],
        rules: {
            'no-console': 'off',
            'no-empty': 'off',
            'no-unused-vars': 'off',
            'no-async-promise-executor': 'off'
        }
    },

    // Tests
    {
        files: ['test/**/*.mjs', '**/tests/**/*.mjs', 'mcp-stack/tests/**/*.mjs'],
        rules: {
            'no-empty': 'off',
            'no-unused-vars': 'off',
            'unicorn/no-await-expression-member': 'off',
            'unicorn/prefer-optional-catch-binding': 'off'
        }
    }
];
