/**
 * Beatavo — Kids page.
 * Shows only the kids section with extra-large controls. The page stays free
 * of external links; the only outside request is the YouTube embed on the
 * watch page a card links to.
 */
import { loadVideos, thumbnailUrl } from './data.js';
import { initI18n, t } from './i18n.js';
import './theme.js';
import { initPlaylistUI, playlistButtonMarkup } from './playlist-dialog.js';
import { isKidsMode, setKidsMode, openGrownUpGate } from './kids-mode.js';
import './install-prompt.js';

const grid = document.getElementById('kidsGrid');
const countEl = document.getElementById('kidsCount');
const playAllBtn = document.getElementById('kidsPlayAll');
const shuffleBtn = document.getElementById('kidsShuffle');
const kidsModeBtn = document.getElementById('kidsModeBtn');
const kidsLock = document.getElementById('kidsLock');

let videos = [];

const PLAY_ICON =
  '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path fill="#fff" d="M8 5.14v13.72c0 .8.87 1.3 1.56.9l10.8-6.86a1.06 1.06 0 0 0 0-1.8L9.56 4.24A1.06 1.06 0 0 0 8 5.14Z"/></svg>';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function cardMarkup(video) {
  return `
    <article class="card card--kids">
      <a class="card__link" href="../watch/?v=${encodeURIComponent(video.id)}">
        <span class="card__thumb">
          <img src="${thumbnailUrl(video.id)}" alt="" width="480" height="360"
               loading="lazy" decoding="async">
          <span class="card__play">${PLAY_ICON}</span>
        </span>
        <span class="card__title">${escapeHtml(video.title)}</span>
      </a>
      ${playlistButtonMarkup(video)}
    </article>`;
}

function render() {
  grid.removeAttribute('aria-busy');
  countEl.textContent =
    videos.length === 1 ? t('count_one') : t('count_many', { n: videos.length });

  if (videos.length === 0) {
    grid.innerHTML = `
      <div class="state" style="grid-column: 1 / -1;">
        <h2>${escapeHtml(t('empty_section_title'))}</h2>
        <p>${escapeHtml(t('empty_section_body', { section: t('tab_kids') }))}</p>
      </div>`;
    playAllBtn.disabled = true;
    shuffleBtn.disabled = true;
    return;
  }

  grid.innerHTML = videos.map(cardMarkup).join('');
}

function showError(message) {
  grid.removeAttribute('aria-busy');
  grid.innerHTML = `
    <div class="state" style="grid-column: 1 / -1;">
      <h2>${escapeHtml(t('error_title'))}</h2>
      <p>${escapeHtml(message)}</p>
    </div>`;
  playAllBtn.disabled = true;
  shuffleBtn.disabled = true;
}

/** Show the lock badge + grown-up exit button only while kids mode is on. */
function refreshModeUi() {
  const on = isKidsMode();
  if (kidsLock) kidsLock.hidden = !on;
  if (kidsModeBtn) kidsModeBtn.hidden = !on;
}

async function init() {
  await initI18n();
  refreshModeUi();
  try {
    const all = await loadVideos('../data/videos.json');
    videos = all.filter((v) => v.section === 'kids');
    render();
  } catch (err) {
    showError(err.message || '');
  }
}

playAllBtn.addEventListener('click', () => {
  if (!videos.length) return;
  location.href = `../watch/?v=${encodeURIComponent(videos[0].id)}&autoplay=1`;
});

shuffleBtn.addEventListener('click', () => {
  if (!videos.length) return;
  const pick = videos[Math.floor(Math.random() * videos.length)];
  location.href = `../watch/?v=${encodeURIComponent(pick.id)}&autoplay=1`;
});

/* ---- Service worker ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('../sw.js').catch(() => {
      /* offline support is a progressive enhancement */
    });
  });
}

/* ---- Kids mode exit (grown-ups only) ---- */
kidsModeBtn?.addEventListener('click', () => {
  openGrownUpGate({
    onUnlock: () => {
      setKidsMode(false);
      location.href = '../';
    },
  });
});

initPlaylistUI();
init();
