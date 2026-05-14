import { create } from 'zustand';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

const THEME_KEY = 'voxa-theme';

const useThemeStore = create((set, get) => ({
  theme: 'dark',

  toggleTheme: () => {
    const current = get().theme;
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
    set({ theme: next });
  },

  setTheme: (theme) => {
    const resolved = theme === 'light' ? 'light' : 'dark';
    applyTheme(resolved);
    localStorage.setItem(THEME_KEY, resolved);
    set({ theme: resolved });
  },

  loadTheme: () => {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved === 'light' || saved === 'dark'
      ? saved
      : (prefersDark ? 'dark' : 'light');
    applyTheme(initial);
    set({ theme: initial });
    return () => {};
  },
}));

export default useThemeStore;
