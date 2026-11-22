/**
 * Beatavo — category (tag) page.
 * Reads ?t=<tag>, shows its own title/meta description, and lists every video
 * carrying that tag. Tags with fewer than 3 videos are treated as "not found".
 */
import {
  loadVideos,
  videosByTag,
  thumbnailUrl,
  formatTag,
  MIN_TAG_VIDEOS,
} from './data.js';
import { initI18n, t } from './i18n.js';

const grid = document.getElementById('tagGrid');
const titleEl = document.getElementById('tagTitle');
const metaTextEl = document.getElementById('tagMeta');
const sectionTitleEl = document.getElementById('tagSectionTitle');
const countEl = document.getElementById('tagCount');
const playAllBtn = document.getElementById('tagPlayAll');

const tag = (new URLSearchParams(location.search).get('t') || '').trim().toLowerCase();
let videos = [];

const PLAY_ICON =
  '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="#fff" d="M8 5.14v13.72c0 .8.87 1.3 1.56.9l10.8-6.86a1.06 1.06 0 0 0 0-1.8L9.56 4.24A1.06 1.06 0 0 0 8 5.14Z"/></svg>';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function canonicalUrl() {
  return `${location.origin}${location.pathname}?t=${encodeURIComponent(tag)}`;
}

/** Point the page title, description and social tags at this category. */
function updateMeta(label) {
  const description = t('tag_page_meta', { tag: label });
  document.title = `${label} · Beatavo`;
  setMeta('name', 'description', description);
  setMeta('property', 'og:title', `${label} · Beatavo`);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', canonicalUrl());
  setMeta('name', 'twitter:title', `${label} · Beatavo`);
  setMeta('name', 'twitter:description', description);

  const canonical = document.head.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', canonicalUrl());
}

function cardMarkup(video) {
  return `
    <article class="card">
      <a class="card__link" href="../watch/?v=${encodeURIComponent(video.id)}&tag=${encodeURIComponent(tag)}">
        <span class="card__thumb">
          <img src="${thumbnailUrl(video.id)}" alt="" width="480" height="360"
               loading="lazy" decoding="async">
          <span class="card__play">${PLAY_ICON}</span>
        </span>
        <span class="card__title">${escapeHtml(video.title)}</span>
      </a>
    </article>`;
}

function renderNotFound() {
  document.title = `${t('tag_not_found_title')} · Beatavo`;
  titleEl.textContent = t('tag_not_found_title');
  metaTextEl.textContent = t('tag_not_found_body');
  sectionTitleEl.textContent = t('tag_not_found_title');
  countEl.textContent = '';
  playAllBtn.hidden = true;
  grid.removeAttribute('aria-busy');
  grid.innerHTML = `
    <div class="state" style="grid-column: 1 / -1;">
      <h2>${escapeHtml(t('tag_not_found_title'))}</h2>
      <p>${escapeHtml(t('tag_not_found_body'))}</p>
      <p><a class="btn btn--primary" href="../">${escapeHtml(t('back_home'))}</a></p>
    </div>`;
}

function render() {
  if (!tag || videos.length < MIN_TAG_VIDEOS) {
    renderNotFound();
    return;
  }

  const label = formatTag(tag);
  const count = videos.length === 1 ? t('count_one') : t('count_many', { n: videos.length });

  updateMeta(label);
  titleEl.textContent = label;
  metaTextEl.textContent = count;
  sectionTitleEl.textContent = label;
  countEl.textContent = count;
  playAllBtn.disabled = false;

  grid.removeAttribute('aria-busy');
  grid.innerHTML = videos.map(cardMarkup).join('');
}

function showError(message) {
  grid.removeAttribute('aria-busy');
  grid.innerHTML = `
    <div class="state" style="grid-column: 1 / -1;">
      <h2>${escapeHtml(t('error_title'))}</h2>
      <p>${escapeHtml(message)}</p>
    </div>`;
}

async function init() {
  await initI18n();
  try {
    const all = await loadVideos('../data/videos.json');
    videos = videosByTag(all, tag);
    render();
  } catch (err) {
    showError(err.message || '');
  }
}

playAllBtn.addEventListener('click', () => {
  if (!videos.length) return;
  location.href = `../watch/?v=${encodeURIComponent(videos[0].id)}&autoplay=1&tag=${encodeURIComponent(tag)}`;
});

/* ---- Service worker ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('../sw.js').catch(() => {
      /* offline support is a progressive enhancement */
    });
  });
}

init();
