import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_THEME,
  getNextTheme,
  getThemeShortLabel,
  getThemeToggleLabel,
  resolveStoredTheme,
} from './theme';

test('resolveStoredTheme defaults to dark when storage is empty or invalid', () => {
  assert.equal(resolveStoredTheme(null), DEFAULT_THEME);
  assert.equal(resolveStoredTheme(undefined), 'dark');
  assert.equal(resolveStoredTheme('sepia'), 'dark');
  assert.equal(resolveStoredTheme('light'), 'light');
  assert.equal(resolveStoredTheme('dark'), 'dark');
});

test('getNextTheme toggles between dark and light', () => {
  assert.equal(getNextTheme('dark'), 'light');
  assert.equal(getNextTheme('light'), 'dark');
});

test('theme labels describe the target mode in Portuguese', () => {
  assert.match(getThemeToggleLabel('dark'), /claro|alto contraste/i);
  assert.match(getThemeToggleLabel('light'), /escuro/i);
  assert.equal(getThemeShortLabel('dark'), 'Alto contraste');
  assert.equal(getThemeShortLabel('light'), 'Modo escuro');
});
