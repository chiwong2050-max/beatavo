/**
 * Beatavo — playlists page.
 * Lists every locally-saved playlist, lets people create/remove/delete, and
 * plays a whole list continuously (the watch page follows ?playlist=<id>).
 */
import {
  loadVideos,
  thumbnailUrl,
  getPlaylists,
  createPlaylist,
  deletePlaylist,
  removeFromPlaylist,
  PLAYLISTS_EVENT,
} from './data.js';
import { initI18n, t } from './i18n.js';
import { initPlaylistUI } from './playlist-dialog.js';
import { enforceKidsMode } from './kids-mode.js';

const wrap = document.getElementById('playlistsWrap');
const createForm = document.getElementById('plCreate');
const createInput = document.getElementById('plCreateName');

let videos = [];
let byId = new Map();

const PLAY_ICON =
  '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="#fff" d="M8 5.14v13.72c0 .8.87 1.3 1.56.9l10.8-6.86a1.06 1.06 0 0 0 0-1.8L9.56 4.24A1.06 1.06 0 0 0 8 5.14Z"/></svg>';

const REMOVE_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function cardMarkup(video, playlistId) {
  return `
    <article class="card" data-id="${escapeHtml(video.id)}">
      <a class="card__link"
         href="../watch/?v=${encodeURIComponent(video.id)}&playlist=${encodeURIComponent(playlistId)}">
        <span class="card__thumb">
          <img src="${thumbnailUrl(video.id)}" alt="" width="480" height="360"
               loading="lazy" decoding="async">
          <span class="card__play">${PLAY_ICON}</span>
        </span>
        <span class="card__title">${escapeHtml(video.title)}</span>
      </a>
      <button class="card__pl card__pl--remove" type="button"
              data-pl-remove="${escapeHtml(playlistId)}" data-id="${escapeHtml(video.id)}"
              aria-label="${escapeHtml(`${t('playlist_remove')}: ${video.title}`)}">
        ${REMOVE_ICON}
      </button>
    </article>`;
}

function blockMarkup(playlist) {
  const items = playlist.ids.map((id) => byId.get(id)).filter(Boolean);
  const count = items.length === 1 ? t('count_one') : t('count_many', { n: items.length });
  const body = items.length
    ? `<div class="video-grid">${items.map((v) => cardMarkup(v, playlist.id)).join('')}</div>`
    : `<div class="state"><p>${escapeHtml(t('playlist_empty_body'))}</p></div>`;

  return `
    <section class="pl-block" data-pl="${escapeHtml(playlist.id)}">
      <div class="pl-block__head">
        <h2>${escapeHtml(playlist.name)} <span class="count">${count}</span></h2>
        <div class="pl-block__actions">
          <button class="btn btn--play" type="button" data-pl-play="${escapeHtml(playlist.id)}"
                  ${items.length ? '' : 'disabled'}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M8 5.14v13.72c0 .8.87 1.3 1.56.9l10.8-6.86a1.06 1.06 0 0 0 0-1.8L9.56 4.24A1.06 1.06 0 0 0 8 5.14Z"/></svg>
            <span>${escapeHtml(t('playlist_play_all'))}</span>
          </button>
          <button class="btn btn--ghost" type="button" data-pl-delete="${escapeHtml(playlist.id)}">
            ${escapeHtml(t('playlist_delete'))}
          </button>
        </div>
      </div>
      ${body}
    </section>`;
}

function render() {
  const playlists = getPlaylists();
  wrap.removeAttribute('aria-busy');

  if (playlists.length === 0) {
    wrap.innerHTML = `
      <div class="state">
        <h2>${escapeHtml(t('playlists_empty_title'))}</h2>
        <p>${escapeHtml(t('playlists_empty_body'))}</p>
      </div>`;
    return;
  }

  wrap.innerHTML = playlists.map(blockMarkup).join('');
}

function showError(message) {
  wrap.removeAttribute('aria-busy');
  wrap.innerHTML = `
    <div class="state">
      <h2>${escapeHtml(t('error_title'))}</h2>
      <p>${escapeHtml(message)}</p>
    </div>`;
}

/* ---- Events ---- */
createForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const created = createPlaylist(createInput.value);
  if (!created) return;
  createInput.value = '';
  render();
});

wrap.addEventListener('click', (e) => {
  const play = e.target.closest('[data-pl-play]');
  if (play) {
    const playlist = getPlaylists().find((p) => p.id === play.dataset.plPlay);
    const first = playlist?.ids.map((id) => byId.get(id)).find(Boolean);
    if (first) {
      location.href =
        `../watch/?v=${encodeURIComponent(first.id)}` +
        `&autoplay=1&playlist=${encodeURIComponent(play.dataset.plPlay)}`;
    }
    return;
  }

  const del = e.target.closest('[data-pl-delete]');
  if (del) {
    if (window.confirm(t('playlist_delete_confirm'))) deletePlaylist(del.dataset.plDelete);
    return;
  }

  const remove = e.target.closest('[data-pl-remove]');
  if (remove) removeFromPlaylist(remove.dataset.plRemove, remove.dataset.id);
});

window.addEventListener(PLAYLISTS_EVENT, render);

async function init() {
  await initI18n();
  try {
    videos = await loadVideos('../data/videos.json');
    byId = new Map(videos.map((v) => [v.id, v]));
    render();
  } catch (err) {
    showError(err.message || '');
  }
}

/* ---- Service worker ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('../sw.js').catch(() => {
      /* offline support is a progressive enhancement */
    });
  });
}

initPlaylistUI();

/* When kids mode is on, the whole app funnels back to /kids/. */
if (!enforceKidsMode('../kids/')) init();
