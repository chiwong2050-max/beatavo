/**
 * Beatavo — shared "Add to playlist" dialog plus the small list buttons shown
 * on cards and on the watch page.
 *
 * One dialog is created lazily per page and the buttons are wired with event
 * delegation, so they keep working after a grid re-renders. No dependencies.
 */
import {
  getPlaylists,
  getPlaylist,
  createPlaylist,
  addToPlaylist,
  removeFromPlaylist,
  playlistsContaining,
  PLAYLISTS_EVENT,
} from './data.js';
import { t } from './i18n.js';

/** List-with-plus icon; filled when the video is already in a playlist. */
const LIST_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h11M4 12h9M4 18h7"/><path d="M17 15v6M14 18h6"/></svg>';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

/**
 * Markup for a playlist toggle button.
 * @param {{id:string,title:string}} video
 * @param {{className?:string}} [options]
 */
export function playlistButtonMarkup(video, { className = 'card__pl' } = {}) {
  const inPlaylist = playlistsContaining(video.id).length > 0;
  const label = `${t(inPlaylist ? 'playlist_in' : 'playlist_add')}: ${video.title}`;
  return (
    `<button class="${className}" type="button" data-playlist-btn` +
    ` data-id="${escapeHtml(video.id)}" data-title="${escapeHtml(video.title)}"` +
    ` aria-pressed="${inPlaylist}" aria-label="${escapeHtml(label)}">${LIST_ICON}</button>`
  );
}

/* -------------------------------------------------------------------------- */
let modal = null;
let current = null;
let lastFocus = null;

function ensureModal() {
  if (modal) return modal;

  modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'playlistModal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="modal__backdrop" data-pl-close></div>
    <div class="modal__panel" role="dialog" aria-modal="true" aria-labelledby="plModalTitle">
      <div class="modal__head">
        <h2 id="plModalTitle">${escapeHtml(t('playlist_add'))}</h2>
        <button class="modal__x" type="button" data-pl-close
                aria-label="${escapeHtml(t('close'))}">&times;</button>
      </div>
      <p class="modal__sub" data-pl-sub></p>
      <ul class="pl-list" data-pl-list></ul>
      <form class="pl-new" data-pl-form>
        <label class="visually-hidden" for="plNewName">${escapeHtml(t('playlist_new_placeholder'))}</label>
        <input class="pl-new__input" id="plNewName" type="text" maxlength="60"
               autocomplete="off" placeholder="${escapeHtml(t('playlist_new_placeholder'))}">
        <button class="btn btn--primary" type="submit">${escapeHtml(t('playlist_create'))}</button>
      </form>
      <div class="modal__actions">
        <button class="btn btn--ghost" type="button" data-pl-close>${escapeHtml(t('done'))}</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-pl-close]')) closeDialog();
  });
  modal.addEventListener('change', onToggle);
  modal.addEventListener('submit', onSubmit);
  modal.addEventListener('keydown', onKeydown);
  return modal;
}

function onToggle(e) {
  const box = e.target.closest('input[data-pl-id]');
  if (!box || !current) return;
  const playlistId = box.getAttribute('data-pl-id');
  if (box.checked) addToPlaylist(playlistId, current.id);
  else removeFromPlaylist(playlistId, current.id);

  const count = box.closest('.pl-item')?.querySelector('.pl-item__count');
  if (count) count.textContent = String(getPlaylist(playlistId)?.ids.length ?? 0);
  syncButtons();
}

function onSubmit(e) {
  e.preventDefault();
  if (!current) return;
  const input = modal.querySelector('#plNewName');
  const playlist = createPlaylist(input.value);
  if (!playlist) return;
  addToPlaylist(playlist.id, current.id);
  input.value = '';
  renderList();
  syncButtons();
  modal.querySelector(`input[data-pl-id="${playlist.id}"]`)?.focus();
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeDialog();
    return;
  }
  if (e.key !== 'Tab') return;
  const focusables = modal.querySelectorAll(
    'button, input, a[href], select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function renderList() {
  const list = modal.querySelector('[data-pl-list]');
  const playlists = getPlaylists();
  if (playlists.length === 0) {
    list.innerHTML = `<li class="pl-empty">${escapeHtml(t('playlist_empty_hint'))}</li>`;
    return;
  }
  list.innerHTML = playlists
    .map((p) => {
      const checked = p.ids.includes(current.id);
      return `<li>
        <label class="pl-item">
          <input type="checkbox" data-pl-id="${escapeHtml(p.id)}"${checked ? ' checked' : ''}>
          <span class="pl-item__name">${escapeHtml(p.name)}</span>
          <span class="pl-item__count">${p.ids.length}</span>
        </label>
      </li>`;
    })
    .join('');
}

/** Update every playlist button on the page to reflect current membership. */
export function syncButtons() {
  document.querySelectorAll('[data-playlist-btn]').forEach((btn) => {
    const inPlaylist = playlistsContaining(btn.dataset.id).length > 0;
    btn.setAttribute('aria-pressed', String(inPlaylist));
    const title = btn.dataset.title || '';
    const label = `${t(inPlaylist ? 'playlist_in' : 'playlist_add')}: ${title}`;
    btn.setAttribute('aria-label', label);
  });
}

export function openPlaylistDialog(video) {
  ensureModal();
  current = { id: video.id, title: video.title };
  lastFocus = document.activeElement;
  modal.querySelector('[data-pl-sub]').textContent = video.title;
  renderList();
  modal.hidden = false;
  document.body.classList.add('modal-open');
  const target =
    modal.querySelector('input[data-pl-id]') ||
    modal.querySelector('#plNewName') ||
    modal.querySelector('[data-pl-close]');
  target?.focus();
}

export function closeDialog() {
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  document.body.classList.remove('modal-open');
  current = null;
  lastFocus?.focus?.();
}

/** Wire the delegated click handler (safe to call more than once). */
let uiStarted = false;

export function initPlaylistUI() {
  if (!uiStarted) {
    uiStarted = true;
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-playlist-btn]');
      if (!btn) return;
      openPlaylistDialog({ id: btn.dataset.id, title: btn.dataset.title || '' });
    });
    window.addEventListener(PLAYLISTS_EVENT, syncButtons);
  }
  syncButtons();
}
