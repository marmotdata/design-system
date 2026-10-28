export type Theme = 'light' | 'dark' | 'system';

/** Sets Light, Peat or follows the system, persisting the choice. Pair with the pre-paint snippet in the guidelines. */
export function setTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    localStorage.setItem('mm-theme', theme);
  } catch {
    /* storage unavailable */
  }
}

export function getTheme(): Theme {
  try {
    return (localStorage.getItem('mm-theme') as Theme | null) ?? 'system';
  } catch {
    return 'system';
  }
}
