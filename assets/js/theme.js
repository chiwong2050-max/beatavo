/**
 * Beatavo — light/dark theme.
 *
 * By default the theme follows the operating system (prefers-color-scheme).
 * Picking a theme in the header pins it in localStorage so the choice sticks.
 * The attribute is also set as early as possible (a tiny inline script in each
 * page's <head>) to avoid a flash of the wrong theme.
 */

const KEY = 'beatavo:theme';

const SUN_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>';

const MOON_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';

function stored() {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : '';
  } catch {
    return '';
  }
}

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/** The theme actually in effect: the saved choice, or the system's. */
function effective() {
  return stored() || (systemPrefersDark() ? 'dark' : 'light');
}

function apply() {
  const theme = effective();
  document.documentElement.dataset.theme = theme;
  updateButton(theme);
}

function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* private mode — the choice simply won't persist */
  }
  apply();
}

function toggleTheme() {
  setTheme(effective() === 'dark' ? 'light' : 'dark');
}

let button = null;

function updateButton(theme = effective()) {
  if (!button) return;
  const isDark = theme === 'dark';
  button.setAttribute('aria-pressed', String(isDark));
  button.innerHTML = isDark ? SUN_ICON : MOON_ICON;
}

/** Insert a compact toggle into the header, once per page. */
function buildToggle() {
  const header = document.querySelector('.site-header__inner');
  if (!header || document.querySelector('#themeToggle')) return;

  button = document.createElement('button');
  button.className = 'theme-toggle';
  button.id = 'themeToggle';
  button.type = 'button';
  button.setAttribute('data-i18n-aria-label', 'theme_toggle');
  button.setAttribute('data-i18n-title', 'theme_toggle');
  button.setAttribute('aria-label', 'Toggle dark mode');
  button.setAttribute('title', 'Toggle dark mode');
  button.addEventListener('click', toggleTheme);

  const lang = header.querySelector('.lang');
  header.insertBefore(button, lang || null);
  updateButton();
}

apply();
buildToggle();

// Follow the system while the visitor hasn't pinned a preference.
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
  if (!stored()) apply();
});

export { toggleTheme };
