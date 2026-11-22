/**
 * Beatavo — home page.
 * Loads the catalogue, renders section tabs + video grid, search, favourites,
 * and wires "Play all" / "Shuffle play".
 */
import {
  loadVideos,
  thumbnailUrl,
  watchHref,
  getFavourites,
  toggleFavourite,
  danceOfTheDay,
  FAVOURITES_EVENT,
} from './data.js';
import { initI18n, t } from './i18n.js';

const grid = document.getElementById('videoGrid');
const sectionHeadTitle = document.getElementById('sectionTitle');
const sectionCount = document.getElementById('sectionCount');
const tabs = Array.from(document.querySelectorAll('.tab'));
const playAllBtn = document.getElementById('playAll');
const shuffleBtn = document.getElementById('shufflePlay');
const searchInput = document.getElementById('search');
const dotdSection = document.getElementById('danceOfTheDay');
const dotdLink = document.getElementById('dotdLink');
const dotdThumb = document.getElementById('dotdThumb');
const dotdTitle = document.getElementById('dotdVideoTitle');

/* Views the grid can show: the two sections, plus the saved favourites.
   Values are i18n keys resolved at render time. */
const VIEWS = {
  main: { label: 'tab_main' },
  kids: { label: 'tab_kids' },
  favourites: { label: 'tab_favourites' },
};

let videos = [];
let activeSection = 'main';
let query = '';
let favourites = new Set(getFavourites());
let i18nReady = false;

const PLAY_ICON =
  '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="#fff" d="M8 5.14v13.72c0 .8.87 1.3 1.56.9l10.8-6.86a1.06 1.06 0 0 0 0-1.8L9.56 4.24A1.06 1.06 0 0 0 8 5.14Z"/></svg>';

const HEART_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.3 4.7 13a4.8 4.8 0 0 1 6.8-6.8l.5.5.5-.5A4.8 4.8 0 0 1 19.3 13Z"/></svg>';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

/** The videos to show for the current view, after applying the title search. */
function currentList() {
  let list =
    activeSection === 'favourites'
      ? videos.filter((v) => favourites.has(v.id))
      : videos.filter((v) => v.section === activeSection);

  const q = query.trim().toLowerCase();
  if (q) list = list.filter((v) => v.title.toLowerCase().includes(q));
  return list;
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
    </article>`;
}

function stateMarkup(heading, body) {
  return `
    <div class="state" style="grid-column: 1 / -1;">
      <h2>${escapeHtml(heading)}</h2>
      <p>${escapeHtml(body)}</p>
    </div>`;
}

function render() {
  const list = currentList();
  const view = VIEWS[activeSection] || VIEWS.main;
  const viewLabel = t(view.label);

  sectionHeadTitle.textContent = viewLabel;
  sectionCount.textContent =
    list.length === 1 ? t('count_one') : t('count_many', { n: list.length });
  grid.setAttribute('aria-labelledby', `tab-${activeSection}`);

  tabs.forEach((tab) => {
    const selected = tab.dataset.section === activeSection;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });

  playAllBtn.disabled = list.length === 0;
  if (shuffleBtn) shuffleBtn.disabled = list.length === 0;

  if (list.length === 0) {
    if (query.trim()) {
      grid.innerHTML = stateMarkup(
        t('empty_search_title'),
        t('empty_search_body', { query: query.trim() })
      );
    } else if (activeSection === 'favourites') {
      grid.innerHTML = stateMarkup(t('empty_fav_title'), t('empty_fav_body'));
    } else {
      grid.innerHTML = stateMarkup(
        t('empty_section_title'),
        t('empty_section_body', { section: viewLabel })
      );
    }
    return;
  }

  grid.innerHTML = list.map(cardMarkup).join('');
}

/** Refresh the heart state on every card without re-rendering the grid. */
function updateFavButtons() {
  grid.querySelectorAll('.card').forEach((card) => {
    const btn = card.querySelector('.card__fav');
    if (!btn) return;
    const fav = favourites.has(card.dataset.id);
    const title = btn.dataset.title || '';
    btn.setAttribute('aria-pressed', String(fav));
    btn.setAttribute('aria-label', `${t(fav ? 'fav_remove' : 'fav_add')}: ${title}`);
  });
}

function setSection(section, { focusTab = false } = {}) {
  if (!VIEWS[section]) section = 'main';
  activeSection = section;
  if (history.replaceState) {
    history.replaceState(null, '', `#${section}`);
  }
  render();
  if (focusTab) {
    tabs.find((t2) => t2.dataset.section === section)?.focus();
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
      <h2>${escapeHtml(t('error_title'))}</h2>
      <p>${escapeHtml(message)}</p>
      <p><button class="btn btn--ghost" type="button" id="retryBtn">${escapeHtml(
        t('error_retry')
      )}</button></p>
    </div>`;
  document.getElementById('retryBtn')?.addEventListener('click', init);
}

async function init() {
  showSkeleton();
  playAllBtn.disabled = true;
  if (shuffleBtn) shuffleBtn.disabled = true;
  try {
    if (!i18nReady) {
      await initI18n();
      i18nReady = true;
    }
    videos = await loadVideos('./data/videos.json');
    grid.removeAttribute('aria-busy');
    renderDanceOfTheDay();
    setSection(location.hash.replace('#', '') || 'main');
  } catch (err) {
    showError(err.message || 'Unknown error.');
  }
}

/** Fill the "Dance of the day" hero with today's deterministic pick. */
function renderDanceOfTheDay() {
  if (!dotdSection) return;
  const pick = danceOfTheDay(videos);
  if (!pick) return;
  dotdLink.href = `./watch/?v=${encodeURIComponent(pick.id)}&autoplay=1`;
  dotdThumb.src = thumbnailUrl(pick.id);
  dotdThumb.alt = '';
  dotdTitle.textContent = pick.title;
  dotdSection.hidden = false;
}

/* ---- Events ---- */
tabs.forEach((tab) => {
  tab.addEventListener('click', () => setSection(tab.dataset.section));
});

// Arrow-key navigation between tabs (WAI-ARIA tabs pattern).
document.querySelector('.tabs')?.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const idx = tabs.findIndex((tb) => tb.dataset.section === activeSection);
  const next = e.key === 'ArrowRight' ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
  setSection(tabs[next].dataset.section, { focusTab: true });
});

// Search by title.
searchInput?.addEventListener('input', () => {
  query = searchInput.value;
  render();
});

// Heart buttons (event delegation so it survives re-renders).
grid.addEventListener('click', (e) => {
  const btn = e.target.closest('.card__fav');
  if (!btn) return;
  const id = btn.closest('.card')?.dataset.id;
  if (id) toggleFavourite(id);
});

window.addEventListener(FAVOURITES_EVENT, (e) => {
  favourites = new Set(e.detail?.list || getFavourites());
  if (activeSection === 'favourites') render();
  else updateFavButtons();
});

playAllBtn?.addEventListener('click', () => {
  const first = currentList()[0];
  if (!first) return;
  location.href = `./watch/?v=${encodeURIComponent(first.id)}&autoplay=1`;
});

shuffleBtn?.addEventListener('click', () => {
  const list = currentList();
  if (!list.length) return;
  const pick = list[Math.floor(Math.random() * list.length)];
  location.href = `./watch/?v=${encodeURIComponent(pick.id)}&autoplay=1`;
});

window.addEventListener('hashchange', () => {
  const section = location.hash.replace('#', '');
  if (VIEWS[section] && section !== activeSection) setSection(section);
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
