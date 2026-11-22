/**
 * Beatavo — watch page.
 * Lightweight YouTube embeds: a thumbnail facade first, the iframe (nocookie)
 * is only created after a click. Continuous play advances through the queue,
 * which can come from a section, a category (?tag=) or a playlist (?playlist=).
 */
import {
  loadVideos,
  thumbnailUrl,
  formatDate,
  formatTag,
  MIN_TAG_VIDEOS,
  getPlaylist,
  pushRecentlyPlayed,
} from './data.js';
import { initI18n, t } from './i18n.js';
import { initPlaylistUI, playlistButtonMarkup } from './playlist-dialog.js';
import { enforceKidsMode } from './kids-mode.js';

const params = new URLSearchParams(location.search);
const requestedId = params.get('v');
const wantsAutoplay = params.get('autoplay') === '1';

const stage = document.getElementById('stage');
const titleEl = document.getElementById('videoTitle');
const metaEl = document.getElementById('videoMeta');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const queueEl = document.getElementById('queue');
const queueTitleEl = document.getElementById('queueTitle');
const shareBtn = document.getElementById('shareBtn');
const embedBtn = document.getElementById('embedBtn');
const shareStatus = document.getElementById('shareStatus');
const playlistSlot = document.getElementById('watchPlaylist');
const helpBtn = document.getElementById('shortcutHelpBtn');
const miniplayer = document.getElementById('miniplayer');
const miniTitle = document.getElementById('miniTitle');
const miniPlay = document.getElementById('miniPlay');
const miniPrev = document.getElementById('miniPrev');
const miniNext = document.getElementById('miniNext');
const miniExpand = document.getElementById('miniExpand');

let videos = [];
let queue = [];
let queueTag = '';
let queuePlaylist = '';
let index = 0;
let player = null;
let apiPromise = null;
let errorStreak = 0;
let isPlaying = false;
let sleepTimerId = null;
let loopVideo = false;

const PLAY_SVG =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M8 5.14v13.72c0 .8.87 1.3 1.56.9l10.8-6.86a1.06 1.06 0 0 0 0-1.8L9.56 4.24A1.06 1.06 0 0 0 8 5.14Z"/></svg>';

const PLAY_SM =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M8 5.14v13.72c0 .8.87 1.3 1.56.9l10.8-6.86a1.06 1.06 0 0 0 0-1.8L9.56 4.24A1.06 1.06 0 0 0 8 5.14Z"/></svg>';

const PAUSE_SM =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z"/></svg>';

/* ------------------------------------------------------------------ utils */
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

/** Canonical origin for search engines (the production domain). */
const SITE_ORIGIN = 'https://beatavo.com';

function canonicalUrl(id) {
  return `${SITE_ORIGIN}/watch/?v=${encodeURIComponent(id)}`;
}

/** Respect the user's motion preference for programmatic scrolling. */
function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function updateMeta(video) {
  const pageTitle = `${video.title} · Beatavo`;
  const description = `Watch "${video.title}" and dance along on Beatavo — fun cartoon music videos for everyone.`;
  const image = thumbnailUrl(video.id, 'hqdefault');

  document.title = pageTitle;
  setMeta('name', 'description', description);
  setMeta('property', 'og:type', 'video.other');
  setMeta('property', 'og:title', pageTitle);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', canonicalUrl(video.id));
  setMeta('property', 'og:image', image);
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', pageTitle);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', image);

  const canonical = document.head.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', canonicalUrl(video.id));

  updateJsonLd(video, description);
}

/** Structured data (schema.org VideoObject) for rich search results. */
function updateJsonLd(video, description) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description,
    thumbnailUrl: [thumbnailUrl(video.id, 'hqdefault')],
    embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}`,
    contentUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`,
    url: canonicalUrl(video.id),
  };
  if (video.published) data.uploadDate = video.published;

  let el = document.getElementById('videoJsonLd');
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'videoJsonLd';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function updateUrl(id) {
  const query = new URLSearchParams({ v: id });
  if (queueTag) query.set('tag', queueTag);
  if (queuePlaylist) query.set('playlist', queuePlaylist);
  history.replaceState(null, '', `?${query}`);
}

/* -------------------------------------------------------------- rendering */
function renderInfo(video) {
  titleEl.textContent = video.title;
  if (miniTitle) miniTitle.textContent = video.title;
  const bits = [];
  if (video.published) bits.push(formatDate(video.published));
  bits.push(t('meta_hosted'));
  metaEl.textContent = bits.join(' · ');
}

/** Swap the "Add to playlist" button for the current video. */
function renderPlaylistButton(video) {
  if (!playlistSlot) return;
  playlistSlot.innerHTML = playlistButtonMarkup(video, {
    className: 'btn btn--ghost btn--icon',
  });
}

function renderQueue() {
  queueEl.innerHTML = queue
    .map((v, i) => {
      const current = i === index;
      return `
        <li>
          <button class="queue__item" type="button" data-index="${i}"
                  aria-current="${current}" title="${escapeHtml(v.title)}">
            <span class="queue__thumb">
              <img src="${thumbnailUrl(v.id, 'mqdefault')}" alt="" width="320" height="180"
                   loading="lazy" decoding="async">
            </span>
            <span class="queue__title">${escapeHtml(v.title)}</span>
          </button>
        </li>`;
    })
    .join('');
}

function showFacade(video) {
  stage.innerHTML = `
    <button class="player__facade" id="facade" type="button"
            aria-label="${escapeHtml(`${t('action_play')} ${video.title}`)}">
      <img src="${thumbnailUrl(video.id)}" alt="" width="480" height="360"
           fetchpriority="high" decoding="async">
      <span class="player__facade-play"><span>${PLAY_SVG} ${escapeHtml(t('facade_play'))}</span></span>
    </button>`;
  document.getElementById('facade').addEventListener('click', () => startPlayback(video.id));
}

/* ------------------------------------------------------------- YT plumbing */
function ensureApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous();
      resolve();
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    document.head.appendChild(s);
  });
  return apiPromise;
}

/** Remember a video as recently played (deduped, capped in data.js). */
function markPlayed(video) {
  if (video) pushRecentlyPlayed(video.id);
}

async function startPlayback(videoId) {
  markPlayed(queue.find((v) => v.id === videoId));
  stage.innerHTML = '<div id="ytPlayer"></div>';
  await ensureApi();
  player = new window.YT.Player('ytPlayer', {
    videoId,
    host: 'https://www.youtube-nocookie.com',
    playerVars: {
      autoplay: 1,
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
      origin: location.origin,
    },
    events: {
      onReady: (e) => e.target.playVideo(),
      onStateChange: (e) => {
        const S = window.YT.PlayerState;
        if (e.data === S.PLAYING) {
          errorStreak = 0;
          isPlaying = true;
        } else if (e.data === S.PAUSED || e.data === S.ENDED) {
          isPlaying = false;
        }
        updateMiniPlayIcon();
        if (e.data === S.ENDED) {
          // "Loop this video" replays the current clip instead of advancing.
          if (loopVideo) {
            e.target.seekTo(0);
            e.target.playVideo();
          } else {
            go(1);
          }
        }
      },
      onError: () => {
        // Unplayable/private video: skip along, but never spin forever.
        errorStreak += 1;
        if (errorStreak <= queue.length) go(1);
      },
    },
  });
}

/* ------------------------------------------------------------- navigation */
function go(step) {
  if (queue.length === 0) return;
  playIndex((index + step + queue.length) % queue.length);
}

function playIndex(newIndex) {
  index = ((newIndex % queue.length) + queue.length) % queue.length;
  const video = queue[index];

  markPlayed(video);
  updateUrl(video.id);
  updateMeta(video);
  renderInfo(video);
  renderPlaylistButton(video);
  renderQueue();

  if (player && typeof player.loadVideoById === 'function') {
    player.loadVideoById(video.id);
  } else {
    showFacade(video);
  }

  queueEl.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
}

/* --------------------------------------------------------- mini sticky bar */
function updateMiniPlayIcon() {
  if (!miniPlay) return;
  miniPlay.innerHTML = isPlaying ? PAUSE_SM : PLAY_SM;
  miniPlay.setAttribute('aria-label', isPlaying ? t('action_pause') : t('action_play'));
}

function setMiniVisible(visible) {
  if (!miniplayer) return;
  if (visible) updateMiniPlayIcon();
  miniplayer.hidden = !visible;
}

function togglePlay() {
  const video = queue[index];
  const S = window.YT && window.YT.PlayerState;
  if (!player || typeof player.getPlayerState !== 'function') {
    if (video) startPlayback(video.id);
    return;
  }
  if (player.getPlayerState() === S.PLAYING) player.pauseVideo();
  else player.playVideo();
}

function setupMiniplayer() {
  if (!miniplayer || !stage) return;

  // Show the mini bar only while the full player is scrolled out of view.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => setMiniVisible(!entries[0].isIntersecting),
      { threshold: 0 }
    );
    io.observe(stage);
  }

  miniPrev.addEventListener('click', () => go(-1));
  miniNext.addEventListener('click', () => go(1));
  miniPlay.addEventListener('click', togglePlay);
  miniExpand.addEventListener('click', () => {
    setMiniVisible(false);
    stage.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
  });
}

/* --------------------------------------------------- keyboard + shortcuts */
/** Keep the current video playing but randomise everything after it. */
function shuffleQueue() {
  if (queue.length < 2) return;
  const currentVideo = queue[index];
  const rest = queue.filter((v) => v !== currentVideo);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  queue = [currentVideo, ...rest];
  index = 0;
  renderQueue();
  setStatus(t('shortcut_shuffled'));
}

function toggleFullscreen() {
  const el = stage;
  const active = document.fullscreenElement || document.webkitFullscreenElement;
  if (!active) {
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  }
}

const SHORTCUT_ROWS = [
  { keys: ['Space'], label: 'shortcut_play_pause' },
  { keys: ['N'], label: 'shortcut_next' },
  { keys: ['S'], label: 'shortcut_shuffle' },
  { keys: ['F'], label: 'shortcut_fullscreen' },
  { keys: ['←', '→'], label: 'shortcut_prev_next' },
  { keys: ['?'], label: 'shortcut_help' },
];

let helpModal = null;
let helpLastFocus = null;

function ensureHelp() {
  if (helpModal) return helpModal;
  helpModal = document.createElement('div');
  helpModal.className = 'modal';
  helpModal.id = 'shortcutHelp';
  helpModal.hidden = true;
  document.body.appendChild(helpModal);

  helpModal.addEventListener('click', (e) => {
    if (e.target.closest('[data-help-close]')) closeHelp();
  });
  helpModal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeHelp();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = helpModal.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
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
  });
  return helpModal;
}

function renderHelpContent() {
  const rows = SHORTCUT_ROWS.map(
    ({ keys, label }) => `
      <li class="shortcuts__row">
        <span class="shortcuts__keys">${keys
          .map((k) => `<kbd>${escapeHtml(k)}</kbd>`)
          .join('')}</span>
        <span class="shortcuts__label">${escapeHtml(t(label))}</span>
      </li>`
  ).join('');
  helpModal.innerHTML = `
    <div class="modal__backdrop" data-help-close></div>
    <div class="modal__panel" role="dialog" aria-modal="true" aria-labelledby="helpTitle">
      <div class="modal__head">
        <h2 id="helpTitle">${escapeHtml(t('shortcuts_title'))}</h2>
        <button class="modal__x" type="button" data-help-close
                aria-label="${escapeHtml(t('close'))}">&times;</button>
      </div>
      <ul class="shortcuts">${rows}</ul>
      <div class="modal__actions">
        <button class="btn btn--ghost" type="button" data-help-close>${escapeHtml(t('done'))}</button>
      </div>
    </div>`;
}

function openHelp() {
  ensureHelp();
  helpLastFocus = document.activeElement;
  renderHelpContent();
  helpModal.hidden = false;
  document.body.classList.add('modal-open');
  helpModal.querySelector('[data-help-close]')?.focus();
}

function closeHelp() {
  if (!helpModal || helpModal.hidden) return;
  helpModal.hidden = true;
  document.body.classList.remove('modal-open');
  helpLastFocus?.focus?.();
}

function isHelpOpen() {
  return !!helpModal && !helpModal.hidden;
}

/* ------------------------------------------------------------------- init */
function showMessage(heading, body) {
  setMiniVisible(false);
  stage.innerHTML = `
    <div class="state" style="position:absolute; inset:0; border:0; display:grid; place-content:center;">
      <h2>${escapeHtml(heading)}</h2>
      <p>${escapeHtml(body)}</p>
      <p><a class="btn btn--primary" href="../">${escapeHtml(t('back_home'))}</a></p>
    </div>`;
  queueEl.innerHTML = '';
  if (playlistSlot) playlistSlot.innerHTML = '';
  prevBtn.disabled = true;
  nextBtn.disabled = true;
  shareBtn.disabled = true;
  if (embedBtn) embedBtn.disabled = true;
}

async function init() {
  await initI18n();

  try {
    videos = await loadVideos('../data/videos.json');
  } catch (err) {
    showMessage(t('error_title'), err.message || '');
    return;
  }

  if (videos.length === 0) {
    showMessage(t('empty_section_title'), t('empty_section_body', { section: t('tab_main') }));
    return;
  }

  const current = videos.find((v) => v.id === requestedId) || videos[0];

  // A ?playlist= link (from the playlists page) plays a whole list in order.
  const playlistParam = (params.get('playlist') || '').trim();
  const playlist = playlistParam ? getPlaylist(playlistParam) : null;
  const playlistQueue = playlist
    ? playlist.ids.map((id) => videos.find((v) => v.id === id)).filter(Boolean)
    : [];

  // A ?tag= link (from category pages) keeps "Play all" inside that category.
  const tag = (params.get('tag') || '').trim().toLowerCase();
  const tagQueue = tag ? videos.filter((v) => (v.tags || []).includes(tag)) : [];

  if (playlistQueue.length >= 2 && playlistQueue.some((v) => v.id === current.id)) {
    queuePlaylist = playlist.id;
    queue = playlistQueue;
    queueTitleEl.textContent = t('watch_up_next', { section: playlist.name });
  } else if (
    tagQueue.length >= MIN_TAG_VIDEOS &&
    tagQueue.some((v) => v.id === current.id)
  ) {
    queueTag = tag;
    queue = tagQueue;
    queueTitleEl.textContent = t('watch_up_next', { section: formatTag(tag) });
  } else {
    queue = videos.filter((v) => v.section === current.section);
    queueTitleEl.textContent = t('watch_up_next', { section: t(`tab_${current.section}`) });
  }
  index = Math.max(0, queue.findIndex((v) => v.id === current.id));

  markPlayed(current);
  updateUrl(current.id);
  updateMeta(current);
  renderInfo(current);
  renderPlaylistButton(current);
  renderQueue();
  setupMiniplayer();

  if (wantsAutoplay) {
    startPlayback(current.id);
  } else {
    showFacade(current);
  }
}

/* ---------------------------------------------------------------- handlers */
prevBtn.addEventListener('click', () => go(-1));
nextBtn.addEventListener('click', () => go(1));

queueEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.queue__item');
  if (btn) playIndex(Number(btn.dataset.index));
});

let statusTimer = null;
function setStatus(text) {
  shareStatus.textContent = text;
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (shareStatus.textContent = ''), 4000);
}

shareBtn.addEventListener('click', async () => {
  const video = queue[index];
  if (!video) return;
  const url = canonicalUrl(video.id);
  const title = `${video.title} · Beatavo`;

  // Prefer the native share sheet; fall back to copying the link.
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      setStatus(t('share_shared'));
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      /* otherwise fall through to the copy fallback */
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    setStatus(t('share_copied'));
  } catch {
    setStatus(`${t('share_copy_prompt')} ${url}`);
  }
});

/** Copy an <iframe> snippet that embeds this video from /embed/. */
embedBtn?.addEventListener('click', async () => {
  const video = queue[index];
  if (!video) return;
  const src = `${location.origin}/embed/?v=${encodeURIComponent(video.id)}`;
  const snippet =
    `<iframe src="${src}" width="560" height="315" title="${video.title}" ` +
    'loading="lazy" frameborder="0" allow="accelerometer; autoplay; clipboard-write; ' +
    'encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
  try {
    await navigator.clipboard.writeText(snippet);
    setStatus(t('embed_copied'));
  } catch {
    setStatus(`${t('embed_copy_prompt')} ${snippet}`);
  }
});

helpBtn?.addEventListener('click', openHelp);

sleepSelect?.addEventListener('change', () => applySleepTimer(sleepSelect.value));
loopBtn?.addEventListener('click', () => setLoop(!loopVideo));

document.addEventListener('keydown', (e) => {
  // While the shortcut help is open, Escape (handled there) is the only key.
  if (isHelpOpen()) return;

  // Don't hijack keys while typing or during a modifier shortcut.
  const el = e.target;
  const tag = (el.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  // Space would activate a focused button/link — let the browser do that instead.
  const onControl = tag === 'button' || tag === 'a';

  switch (e.key) {
    case ' ':
      if (onControl) return;
      e.preventDefault();
      togglePlay();
      break;
    case 'n':
    case 'N':
      go(1);
      break;
    case 's':
    case 'S':
      shuffleQueue();
      break;
    case 'f':
    case 'F':
      toggleFullscreen();
      break;
    case '?':
      e.preventDefault();
      openHelp();
      break;
    case 'ArrowRight':
      go(1);
      break;
    case 'ArrowLeft':
      go(-1);
      break;
    default:
      break;
  }
});

/* ---- Service worker ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('../sw.js').catch(() => {});
  });
}

initPlaylistUI();

/* When kids mode is on, the whole app funnels back to /kids/. */
if (!enforceKidsMode('../kids/')) init();
