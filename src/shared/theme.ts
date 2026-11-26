export type ThemeMode = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'pf_theme';
export const DEFAULT_THEME: ThemeMode = 'dark';

export function resolveStoredTheme(raw: string | null | undefined): ThemeMode {
  if (raw === 'light') return 'light';
  if (raw === 'dark') return 'dark';
  return DEFAULT_THEME;
}

export function getNextTheme(current: ThemeMode): ThemeMode {
  return current === 'dark' ? 'light' : 'dark';
}

export function getThemeToggleLabel(current: ThemeMode): string {
  return current === 'dark'
    ? 'Ativar tema claro de alto contraste'
    : 'Voltar para o tema escuro';
}

export function getThemeShortLabel(current: ThemeMode): string {
  return current === 'dark' ? 'Alto contraste' : 'Modo escuro';
}
