export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'system'];

export const THEME_STORAGE_KEY = 'ape-theme';

/** Reads a stored value safely; anything unexpected means "follow the system". */
export function parseThemeChoice(value: unknown): ThemeChoice {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** The data-theme attribute for a choice. System sets none, so the CSS media query decides. */
export function themeAttribute(choice: ThemeChoice): 'light' | 'dark' | null {
  return choice === 'system' ? null : choice;
}

/**
 * Runs in <head> before first paint so a stored choice never flashes the wrong theme.
 * Kept tiny and dependency-free; storage access is guarded because it can throw.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var v=localStorage.getItem('${THEME_STORAGE_KEY}');if(v==='light'||v==='dark')document.documentElement.setAttribute('data-theme',v);}catch(e){}})();`;
