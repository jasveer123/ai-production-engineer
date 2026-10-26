import assert from 'node:assert/strict';
import { test } from 'vitest';
import { parseThemeChoice, themeAttribute, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from './theme.ts';

test('parseThemeChoice keeps light and dark', () => {
  assert.equal(parseThemeChoice('light'), 'light');
  assert.equal(parseThemeChoice('dark'), 'dark');
});

test('parseThemeChoice falls back to system for anything else', () => {
  for (const value of ['system', null, undefined, '', 'DARK', 42, {}]) {
    assert.equal(parseThemeChoice(value), 'system');
  }
});

test('themeAttribute leaves the attribute off for system', () => {
  assert.equal(themeAttribute('system'), null);
  assert.equal(themeAttribute('dark'), 'dark');
  assert.equal(themeAttribute('light'), 'light');
});

test('the init script reads the same storage key and guards storage errors', () => {
  assert.ok(THEME_INIT_SCRIPT.includes(`'${THEME_STORAGE_KEY}'`));
  assert.ok(THEME_INIT_SCRIPT.includes('try{'));
});
