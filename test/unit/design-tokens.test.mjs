import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import tailwindConfig from '../../tailwind.config.mjs';
import { contrast } from '../helpers/color.mjs';

function parseTheme(tokens, theme) {
  const regex = new RegExp(`html\\[data-theme="${theme}"\\]\\s*{([^}]*)}`, 'm');
  const match = tokens.match(regex);
  if (!match) return {};
  return Object.fromEntries(
    match[1]
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.replace(';', '').split(':').map((s) => s.trim()))
  );
}


const tokens = fs.readFileSync(path.join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

test('defines improved background colors', () => {
  const dark = parseTheme(tokens, 'dark');
  const light = parseTheme(tokens, 'light');
  assert.equal(dark['--color-bg'], '18 18 18');
  assert.equal(light['--color-bg'], '245 245 245');
});

test('text contrast meets WCAG AA', () => {
  const dark = parseTheme(tokens, 'dark');
  const light = parseTheme(tokens, 'light');
  assert.ok(contrast(dark['--color-bg'], dark['--color-text']) >= 4.5);
  assert.ok(contrast(light['--color-bg'], light['--color-text']) >= 4.5);
});

test('tailwind exposes readable fonts', () => {
  assert.equal(tailwindConfig.theme.extend.fontFamily.body[0], "'Inter'");
  assert.equal(tailwindConfig.theme.extend.fontFamily.heading[0], "'Merriweather'");
});

test('includes fluid type scale tokens', () => {
  const required = ['--step--2', '--step--1', '--step-0', '--step-1', '--step-2', '--step-3', '--step-4'];
  for (const token of required) {
    assert.ok(tokens.includes(token), `missing ${token}`);
  }
});
