// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import n from 'eslint-plugin-n';
import promise from 'eslint-plugin-promise';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';

export default [
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

    js.configs.recommended,
    unicorn.configs['flat/recommended'],

    {
        files: ['src/**/*.{js,mjs,ts,tsx}', 'tools/**/*.mjs', 'mcp-stack/**/*.mjs', 'eleventy.config.mjs'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: { ...globals.node, ...globals.browser }
        },
        settings: {
            'import/resolver': {
                typescript: { project: true, alwaysTryTypes: true },
                node: { extensions: ['.js', '.mjs', '.ts', '.tsx'] }
            }
        },
        plugins: { import: importPlugin, n, promise },
        rules: {
            'import/no-unresolved': 'error',
            'import/named': 'error',
            'import/no-unused-modules': ['error', { unusedExports: true }],
            'n/no-missing-import': 'off',
            'n/no-unsupported-features/es-syntax': 'off',
            'promise/catch-or-return': 'warn',
            'no-console': 'warn'
        }
    },

    ...tseslint.configs.recommendedTypeChecked.map(cfg => ({
        ...cfg,
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            ...cfg.languageOptions,
            parserOptions: { ...cfg.languageOptions?.parserOptions, project: true, tsconfigRootDir: process.cwd() }
        }
    })),

    { files: ['src/lib/filters/**/*.{js,mjs,ts}', 'src/lib/shortcodes/**/*.{js,mjs,ts}'], rules: { 'import/no-unused-modules': 'off' } },
    { files: ['eleventy.config.mjs', 'tools/**/*.mjs', 'mcp-stack/**/*.mjs'], rules: { 'no-console': 'off' } },
    { files: ['test/**/*.mjs'], rules: { 'n/no-unpublished-import': 'off' } }
];
