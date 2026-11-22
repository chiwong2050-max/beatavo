/**
 * Beatavo — Kids mode.
 *
 * When the lock is on, the rest of the app redirects to /kids/ so little ones
 * stay in the safe space. Leaving kids mode asks a simple grown-up maths
 * question, which is enough to stop a toddler tapping their way out.
 */
import { t } from './i18n.js';

const KEY = 'beatavo:kids-mode';

/** Fired on window when the lock is switched on or off. */
export const KIDS_MODE_EVENT = 'beatavo:kids-mode-changed';

export function isKidsMode() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setKidsMode(on) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(KIDS_MODE_EVENT, { detail: { on: !!on } }));
}

/**
 * Redirect to `redirectHref` (the kids page, relative to the current page)
 * when the lock is on. Returns true if a redirect was started.
 */
export function enforceKidsMode(redirectHref) {
  if (!isKidsMode()) return false;
  if (location.pathname.replace(/\\/g, '/').includes('/kids/')) return false;
  location.replace(redirectHref);
  return true;
}

/* -------------------------------------------------------------------------- */
let modal = null;
let lastFocus = null;
let answer = 0;

function newQuestion() {
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 2 + Math.floor(Math.random() * 8);
  answer = a + b;
  if (!modal) return;
  modal.querySelector('[data-gate-q]').textContent = t('kids_gate_question', { a, b });
  const input = modal.querySelector('[data-gate-input]');
  if (input) input.value = '';
}

function ensureModal() {
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'grownUpGate';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="modal__backdrop" data-gate-close></div>
    <div class="modal__panel" role="dialog" aria-modal="true" aria-labelledby="gateTitle">
      <div class="modal__head">
        <h2 id="gateTitle"></h2>
        <button class="modal__x" type="button" data-gate-close aria-label="Close">&times;</button>
      </div>
      <p class="modal__sub"></p>
      <form data-gate-form>
        <label class="gate__q" for="gateAnswer" data-gate-q></label>
        <div class="pl-new">
          <input class="pl-new__input" id="gateAnswer" data-gate-input type="number"
                 inputmode="numeric" autocomplete="off" required>
          <button class="btn btn--primary" type="submit" data-gate-submit></button>
        </div>
        <p class="gate__error" data-gate-error hidden role="alert"></p>
      </form>
      <div class="modal__actions">
        <button class="btn btn--ghost" type="button" data-gate-close></button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-gate-close]')) closeGate();
  });
  modal.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = modal.querySelector('[data-gate-input]');
    if (Number(input.value) === answer) {
      const done = unlock;
      closeGate();
      done?.();
    } else {
      const error = modal.querySelector('[data-gate-error]');
      error.textContent = t('kids_gate_wrong');
      error.hidden = false;
      newQuestion();
      modal.querySelector('[data-gate-input]').focus();
    }
  });
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeGate();
    }
  });
  return modal;
}

let unlock = null;

/** Ask the grown-up question; run `onUnlock` only when answered correctly. */
export function openGrownUpGate({ onUnlock } = {}) {
  ensureModal();
  unlock = onUnlock || null;
  lastFocus = document.activeElement;
  modal.querySelector('#gateTitle').textContent = t('kids_gate_title');
  modal.querySelector('.modal__sub').textContent = t('kids_gate_body');
  modal.querySelector('[data-gate-submit]').textContent = t('kids_gate_submit');
  modal.querySelector('[data-gate-close]').textContent = t('done');
  modal.querySelector('[data-gate-error]').hidden = true;
  newQuestion();
  modal.hidden = false;
  document.body.classList.add('modal-open');
  modal.querySelector('[data-gate-input]').focus();
}

export function closeGate() {
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  document.body.classList.remove('modal-open');
  unlock = null;
  lastFocus?.focus?.();
}
