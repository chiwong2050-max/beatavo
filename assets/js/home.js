/**
 * Beatavo — home page.
 * Loads the catalogue, renders section tabs + video grid, wires "Play all".
 */
import { SECTIONS, loadVideos, thumbnailUrl, watchHref } from './data.js';

const grid = document.getElementById('videoGrid');
const sectionHeadTitle = document.getElementById('sectionTitle');
const sectionCount = document.getElementById('sectionCount');
const tabs = Array.from(document.querySelectorAll('.tab'));
const playAllBtn = document.getElementById('playAll');

let videos = [];
let activeSection = 'main';

const PLAY_ICON =
  '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="#fff" d="M8 5.14v13.72c0 .8.87 1.3 1.56.9l10.8-6.86a1.06 1.06 0 0 0 0-1.8L9.56 4.24A1.06 1.06 0 0 0 8 5.14Z"/></svg>';

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function sectionVideos(section) {
  return videos.filter((v) => v.section === section);
}

function cardMarkup(video) {
  return `
    <a class="card" href="${watchHref(video.id)}">
      <span class="card__thumb">
        <img src="${thumbnailUrl(video.id)}" alt="" width="480" height="360"
             loading="lazy" decoding="async">
        <span class="card__play">${PLAY_ICON}</span>
      </span>
      <span class="card__title">${escapeHtml(video.title)}</span>
    </a>`;
}

function render() {
  const list = sectionVideos(activeSection);
  const meta = SECTIONS[activeSection];

  sectionHeadTitle.textContent = meta.title;
  sectionCount.textContent = list.length === 1 ? '1 video' : `${list.length} videos`;
  grid.setAttribute('aria-labelledby', `tab-${activeSection}`);

  tabs.forEach((tab) => {
    const selected = tab.dataset.section === activeSection;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });

  playAllBtn.disabled = list.length === 0;

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="state" style="grid-column: 1 / -1;">
        <h2>Nothing here yet</h2>
        <p>${escapeHtml(meta.label)} has no videos at the moment. Check back soon!</p>
      </div>`;
    return;
  }

  grid.innerHTML = list.map(cardMarkup).join('');
}

function setSection(section, { focusTab = false } = {}) {
  if (!SECTIONS[section]) section = 'main';
  activeSection = section;
  if (history.replaceState) {
    history.replaceState(null, '', `#${section}`);
  }
  render();
  if (focusTab) {
    tabs.find((t) => t.dataset.section === section)?.focus();
  }
}

function showSkeleton() {
  grid.setAttribute('aria-busy', 'true');
  grid.innerHTML = '<div class="skeleton-grid" style="grid-column: 1 / -1;"></div>';
  const wrap = grid.firstElementChild;
  for (let i = 0; i < 6; i++) {
    const card = document.createElement('div');
    card.className = 'skeleton-card';
    card.innerHTML =
      '<div class="skeleton skeleton--thumb"></div><div class="skeleton skeleton--line"></div>';
    wrap.appendChild(card);
  }
}

function showError(message) {
  grid.removeAttribute('aria-busy');
  grid.innerHTML = `
    <div class="state" style="grid-column: 1 / -1;">
      <h2>We couldn't load the videos</h2>
      <p>${escapeHtml(message)}</p>
      <p><button class="btn btn--ghost" type="button" id="retryBtn">Try again</button></p>
    </div>`;
  document.getElementById('retryBtn')?.addEventListener('click', init);
}

async function init() {
  showSkeleton();
  playAllBtn.disabled = true;
  try {
    videos = await loadVideos('./data/videos.json');
    grid.removeAttribute('aria-busy');
    setSection(location.hash.replace('#', '') || 'main');
  } catch (err) {
    showError(err.message || 'Unknown error.');
  }
}

/* ---- Events ---- */
tabs.forEach((tab) => {
  tab.addEventListener('click', () => setSection(tab.dataset.section));
});

// Arrow-key navigation between tabs (WAI-ARIA tabs pattern).
document.querySelector('.tabs')?.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const idx = tabs.findIndex((t) => t.dataset.section === activeSection);
  const next = e.key === 'ArrowRight' ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
  setSection(tabs[next].dataset.section, { focusTab: true });
});

playAllBtn?.addEventListener('click', () => {
  const first = sectionVideos(activeSection)[0];
  if (!first) return;
  location.href = `./watch/?v=${encodeURIComponent(first.id)}&autoplay=1`;
});

window.addEventListener('hashchange', () => {
  const section = location.hash.replace('#', '');
  if (SECTIONS[section] && section !== activeSection) setSection(section);
});

/* ---- Service worker ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is a progressive enhancement */
    });
  });
}

init();
