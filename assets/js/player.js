/**
 * Beatavo — watch page.
 * Lightweight YouTube embeds: a thumbnail facade first, the iframe (nocookie)
 * is only created after a click. Continuous play advances through the queue.
 */
import { SECTIONS, loadVideos, thumbnailUrl, formatDate } from '../assets/js/data.js';

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
const shareStatus = document.getElementById('shareStatus');
const sectionPill = document.getElementById('sectionPill');

let videos = [];
let queue = [];
let index = 0;
let player = null;
let apiPromise = null;
let errorStreak = 0;

const PLAY_SVG =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M8 5.14v13.72c0 .8.87 1.3 1.56.9l10.8-6.86a1.06 1.06 0 0 0 0-1.8L9.56 4.24A1.06 1.06 0 0 0 8 5.14Z"/></svg>';

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

function canonicalUrl(id) {
  return `${location.origin}${location.pathname}?v=${encodeURIComponent(id)}`;
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
}

function updateUrl(id) {
  history.replaceState(null, '', `?v=${encodeURIComponent(id)}`);
}

/* -------------------------------------------------------------- rendering */
function renderInfo(video) {
  titleEl.textContent = video.title;
  const bits = [];
  if (video.published) bits.push(formatDate(video.published));
  bits.push('Hosted on YouTube');
  metaEl.textContent = bits.join(' · ');
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
            aria-label="Play ${escapeHtml(video.title)}">
      <img src="${thumbnailUrl(video.id)}" alt="" width="480" height="360">
      <span class="player__facade-play"><span>${PLAY_SVG} Play</span></span>
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

async function startPlayback(videoId) {
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
        if (e.data === window.YT.PlayerState.PLAYING) errorStreak = 0;
        if (e.data === window.YT.PlayerState.ENDED) go(1);
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

  updateUrl(video.id);
  updateMeta(video);
  renderInfo(video);
  renderQueue();

  if (player && typeof player.loadVideoById === 'function') {
    player.loadVideoById(video.id);
  } else {
    showFacade(video);
  }

  queueEl.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
}

/* ------------------------------------------------------------------- init */
function showMessage(heading, body) {
  stage.innerHTML = `
    <div class="state" style="position:absolute; inset:0; border:0; display:grid; place-content:center;">
      <h2>${escapeHtml(heading)}</h2>
      <p>${escapeHtml(body)}</p>
      <p><a class="btn btn--primary" href="../">Back to Beatavo</a></p>
    </div>`;
  queueEl.innerHTML = '';
  prevBtn.disabled = true;
  nextBtn.disabled = true;
  shareBtn.disabled = true;
}

async function init() {
  try {
    videos = await loadVideos('../data/videos.json');
  } catch (err) {
    showMessage("We couldn't load the videos", err.message || 'Please try again later.');
    return;
  }

  if (videos.length === 0) {
    showMessage('Nothing to play yet', 'The video list is empty for now.');
    return;
  }

  const current = videos.find((v) => v.id === requestedId) || videos[0];
  queue = videos.filter((v) => v.section === current.section);
  index = Math.max(0, queue.findIndex((v) => v.id === current.id));

  queueTitleEl.textContent = `${SECTIONS[current.section].label} · up next`;
  updateUrl(current.id);
  updateMeta(current);
  renderInfo(current);
  renderQueue();

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

shareBtn.addEventListener('click', async () => {
  const video = queue[index];
  if (!video) return;
  const url = canonicalUrl(video.id);
  try {
    if (navigator.share) {
      await navigator.share({ title: `${video.title} · Beatavo`, url });
      shareStatus.textContent = 'Shared!';
      return;
    }
    await navigator.clipboard.writeText(url);
    shareStatus.textContent = 'Link copied!';
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    shareStatus.textContent = 'Copy this link: ' + url;
  }
  setTimeout(() => (shareStatus.textContent = ''), 4000);
});

document.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  if (e.key === 'ArrowRight') go(1);
  if (e.key === 'ArrowLeft') go(-1);
});

/* ---- Service worker ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('../sw.js').catch(() => {});
  });
}

init();
