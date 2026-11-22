/**
 * Beatavo — favourites page.
 * Lists the videos saved on this device and, from the on-device play tally,
 * the most-played dances ("Your top dances"). Everything stays in localStorage.
 */
import {
  loadVideos,
  thumbnailUrl,
  getFavourites,
  toggleFavourite,
  getTopPlayed,
  FAVOURITES_EVENT,
} from './data.js';
import { initI18n, t } from './i18n.js';
import './theme.js';
import { initPlaylistUI, playlistButtonMarkup } from './playlist-dialog.js';
import './install-prompt.js';

const grid = document.getElementById('favGrid');
const countEl = document.getElementById('favCount');
const playAllBtn = document.getElementById('favPlayAll');
const topSection = document.getElementById('topDances');
const topList = document.getElementById('topDancesList');
const topEmpty = document.getElementById('topDancesEmpty');

let videos = [];
let favourites = new Set(getFavourites());

const PLAY_ICON =
  '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="#fff" d="M8 5.14v13.72c0 .8.87 1.3 1.56.9l10.8-6.86a1.06 1.06 0 0 0 0-1.8L9.56 4.24A1.06 1.06 0 0 0 8 5.14Z"/></svg>';

const HEART_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.3 4.7 13a4.8 4.8 0 0 1 6.8-6.8l.5.5.5-.5A4.8 4.8 0 0 1 19.3 13Z"/></svg>';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

/** Link to the watch page from a nested route (/favourites/). */
function watchHref(id) {
  return `../watch/?v=${encodeURIComponent(id)}`;
}

function cardMarkup(video) {
  const fav = favourites.has(video.id);
  const label = `${t(fav ? 'fav_remove' : 'fav_add')}: ${video.title}`;
  return `
    <article class="card" data-id="${escapeHtml(video.id)}">
      <a class="card__link" href="${watchHref(video.id)}">
        <span class="card__thumb">
          <img src="${thumbnailUrl(video.id)}" alt="" width="480" height="360"
               loading="lazy" decoding="async">
          <span class="card__play">${PLAY_ICON}</span>
        </span>
        <span class="card__title">${escapeHtml(video.title)}</span>
      </a>
      <button class="card__fav" type="button" aria-pressed="${fav}"
              data-title="${escapeHtml(video.title)}" aria-label="${escapeHtml(label)}">
        ${HEART_ICON}
      </button>
      ${playlistButtonMarkup(video)}
    </article>`;
}

function renderFavourites() {
  const list = videos.filter((v) => favourites.has(v.id));
  grid.removeAttribute('aria-busy');
  countEl.textContent =
    list.length === 1 ? t('count_one') : t('count_many', { n: list.length });
  playAllBtn.disabled = list.length === 0;

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="state" style="grid-column: 1 / -1;">
        <h2>${escapeHtml(t('empty_fav_title'))}</h2>
        <p>${escapeHtml(t('empty_fav_body'))}</p>
        <p><a class="btn btn--primary" href="../">${escapeHtml(t('nav_videos'))}</a></p>
      </div>`;
    return;
  }
  grid.innerHTML = list.map(cardMarkup).join('');
}

/** "Your top dances" — most-played videos from the private on-device tally. */
function renderTopDances() {
  if (!topSection || !topList) return;
  const top = getTopPlayed(videos, 6);

  if (top.length === 0) {
    topList.innerHTML = '';
    if (topEmpty) topEmpty.hidden = false;
    return;
  }
  if (topEmpty) topEmpty.hidden = true;

  topList.innerHTML = top
    .map(
      ({ video, count }, i) => `
      <li class="top-dance">
        <span class="top-dance__rank" aria-hidden="true">${i + 1}</span>
        <a class="top-dance__link" href="${watchHref(video.id)}">
          <span class="top-dance__thumb">
            <img src="${thumbnailUrl(video.id, 'mqdefault')}" alt="" width="320" height="180"
                 loading="lazy" decoding="async">
          </span>
          <span class="top-dance__title">${escapeHtml(video.title)}</span>
          <span class="top-dance__count">${escapeHtml(t('top_dances_plays', { n: count }))}</span>
        </a>
      </li>`
    )
    .join('');
}

/** Refresh the heart state without re-rendering (keeps focus intact). */
function updateFavButtons() {
  grid.querySelectorAll('.card').forEach((card) => {
    const btn = card.querySelector('.card__fav');
    if (!btn) return;
    const fav = favourites.has(card.dataset.id);
    btn.setAttribute('aria-pressed', String(fav));
    btn.setAttribute('aria-label', `${t(fav ? 'fav_remove' : 'fav_add')}: ${btn.dataset.title || ''}`);
  });
}

async function init() {
  grid.setAttribute('aria-busy', 'true');
  try {
    await initI18n();
    videos = await loadVideos('../data/videos.json');
    renderFavourites();
    renderTopDances();
  } catch (err) {
    grid.removeAttribute('aria-busy');
    grid.innerHTML = `
      <div class="state" style="grid-column: 1 / -1;">
        <h2>${escapeHtml(t('error_title'))}</h2>
        <p>${escapeHtml(err.message || '')}</p>
      </div>`;
  }
}

/* ---- Events ---- */
grid.addEventListener('click', (e) => {
  const btn = e.target.closest('.card__fav');
  if (!btn) return;
  const id = btn.closest('.card')?.dataset.id;
  if (id) toggleFavourite(id);
});

window.addEventListener(FAVOURITES_EVENT, (e) => {
  favourites = new Set(e.detail?.list || getFavourites());
  renderFavourites();
});

playAllBtn?.addEventListener('click', () => {
  const first = videos.find((v) => favourites.has(v.id));
  if (!first) return;
  location.href = `${watchHref(first.id)}&autoplay=1`;
});

/* ---- Service worker ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('../sw.js').catch(() => {});
  });
}

initPlaylistUI();
init();
