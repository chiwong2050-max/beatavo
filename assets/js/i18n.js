/**
 * Beatavo — tiny i18n layer.
 * Strings live in /i18n/<code>.json. The browser language is auto-detected,
 * a saved choice wins, and English is always the fallback for missing keys.
 */

export const LOCALES = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'es', label: 'Español', dir: 'ltr' },
  { code: 'pt', label: 'Português', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'zh-Hans', label: '简体中文', dir: 'ltr' },
  { code: 'hi', label: 'हिन्दी', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'id', label: 'Bahasa Indonesia', dir: 'ltr' },
];

const STORAGE_KEY = 'beatavo:lang';
const I18N_BASE = new URL('../../i18n/', import.meta.url);

let dict = {};
let current = 'en';

/** Translate a key, optionally substituting {placeholders}. */
export function t(key, params) {
  let str = key in dict ? dict[key] : key;
  if (params) {
    str = str.replace(/\{(\w+)\}/g, (m, name) => (name in params ? params[name] : m));
  }
  return str;
}

export function currentLocale() {
  return current;
}

function savedLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LOCALES.some((l) => l.code === saved)) return saved;
  } catch {
    /* ignore */
  }
  return '';
}

/** Map a BCP-47 tag such as "pt-BR" onto one of our locales. */
function matchLocale(tag) {
  const lower = String(tag).toLowerCase();
  if (lower.startsWith('zh')) return 'zh-Hans';
  if (lower.startsWith('pt')) return 'pt';
  if (lower.startsWith('es')) return 'es';
  if (lower.startsWith('fr')) return 'fr';
  if (lower.startsWith('hi')) return 'hi';
  if (lower.startsWith('ar')) return 'ar';
  if (lower.startsWith('id') || lower.startsWith('in')) return 'id';
  if (lower.startsWith('en')) return 'en';
  return '';
}

function detectLocale() {
  const saved = savedLocale();
  if (saved) return saved;
  const preferred =
    navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || 'en'];
  for (const tag of preferred) {
    const match = matchLocale(tag);
    if (match) return match;
  }
  return 'en';
}

async function loadDict(code) {
  const res = await fetch(new URL(`${code}.json`, I18N_BASE), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`i18n: ${code} returned HTTP ${res.status}`);
  return res.json();
}

/** Swap locales on demand (used by the picker) and reload to re-render. */
export function setLocale(code) {
  if (!LOCALES.some((l) => l.code === code)) return;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
  location.reload();
}

/** Translate everything marked up in the DOM with data-i18n* attributes. */
export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key in dict) el.textContent = dict[key];
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key in dict) el.setAttribute('placeholder', dict[key]);
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (key in dict) el.setAttribute('aria-label', dict[key]);
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (key in dict) el.setAttribute('title', dict[key]);
  });
}

function buildPicker() {
  document.querySelectorAll('[data-language-picker]').forEach((select) => {
    select.innerHTML = LOCALES.map(
      (l) => `<option value="${l.code}">${l.label}</option>`
    ).join('');
    select.value = current;
    select.addEventListener('change', () => setLocale(select.value));
  });
}

/**
 * Detect the locale, load its strings (English as a fallback) and apply them.
 * Resolves once the DOM is translated, so callers can render dynamic content.
 */
export async function initI18n() {
  current = detectLocale();
  const meta = LOCALES.find((l) => l.code === current) || LOCALES[0];

  const english = await loadDict('en').catch(() => ({}));
  const localised = current === 'en' ? {} : await loadDict(current).catch(() => ({}));
  dict = { ...english, ...localised };

  document.documentElement.lang = current;
  document.documentElement.dir = meta.dir;
  applyTranslations();
  buildPicker();

  return { t, locale: current };
}
