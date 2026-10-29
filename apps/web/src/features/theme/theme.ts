export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'system'];

export const THEME_STORAGE_KEY = 'ape-theme';

export function parseThemeChoice(value: unknown): ThemeChoice {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function themeAttribute(choice: ThemeChoice): 'light' | 'dark' | null {
  return choice === 'system' ? null : choice;
}

export const THEME_INIT_SCRIPT = `(function(){try{var v=localStorage.getItem('${THEME_STORAGE_KEY}');if(v==='light'||v==='dark')document.documentElement.setAttribute('data-theme',v);}catch(e){}})();`;
