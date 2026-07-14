// Theme storage/apply logic — kept in one place because index.html's
// FOUC-avoidance inline script (which runs before React/this module loads)
// has to duplicate the storage key and fallback logic; keep them in sync if
// either changes.
export const THEME_STORAGE_KEY = 'borneo-tracker:theme';

// Canvas-rendered charts (ECharts) can't read CSS variables — they need
// resolved color strings baked into their option config. Anything that draws
// to a canvas listens for this to know when to re-read the CSS vars and
// repaint, since a `data-theme` attribute change alone won't trigger that.
export const THEME_CHANGE_EVENT = 'borneo-tracker:theme-change';

/** Reads a CSS custom property's current resolved value (e.g. '--color-ink'). */
export function cssVar(name, fallback = '') {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

export function getSystemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || getStoredTheme() || getSystemTheme();
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private-browsing/quota failures just mean the choice won't persist —
    // the toggle still works for this session.
  }
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } }));
}
