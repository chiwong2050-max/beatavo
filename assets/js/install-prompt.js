/**
 * Beatavo — "Add to home screen" banner.
 * Listens for the browser's install prompt, shows a small dismissible banner
 * once, and remembers a dismissal in localStorage. No dependencies.
 */
import { applyTranslations } from './i18n.js';

const DISMISS_KEY = 'beatavo:install-dismissed';
const ICON = new URL('../icons/favicon.svg', import.meta.url).href;

let deferredPrompt = null;
let banner = null;

function isDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* ignore */
  }
}

function removeBanner() {
  if (banner) {
    banner.remove();
    banner = null;
  }
}

function buildBanner() {
  const el = document.createElement('div');
  el.className = 'install-banner';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Install Beatavo');
  el.innerHTML = `
    <img class="install-banner__icon" src="${ICON}" alt="" width="36" height="36">
    <span class="install-banner__text" data-i18n="install_banner">Add Beatavo to your home screen</span>
    <button class="btn btn--play install-banner__add" type="button" data-i18n="install_add">Add</button>
    <button class="install-banner__close" type="button"
            data-i18n-aria-label="install_dismiss" aria-label="Dismiss">&times;</button>
  `;

  el.querySelector('.install-banner__close').addEventListener('click', () => {
    rememberDismissed();
    removeBanner();
  });

  el.querySelector('.install-banner__add').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch {
      /* ignore */
    }
    deferredPrompt = null;
    removeBanner();
  });

  document.body.appendChild(el);
  applyTranslations(el);
  return el;
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  if (isDismissed() || banner) return;
  banner = buildBanner();
});

window.addEventListener('appinstalled', () => {
  rememberDismissed();
  removeBanner();
});

export {};
