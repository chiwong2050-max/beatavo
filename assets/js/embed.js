/**
 * Beatavo — embeddable player.
 * A minimal, chrome-free player for a single video, meant to be dropped into
 * an <iframe>. Uses the same thumbnail-facade + youtube-nocookie pattern as
 * the watch page.
 */
import { loadVideos, thumbnailUrl } from './data.js';
import { initI18n, t } from './i18n.js';

const params = new URLSearchParams(location.search);
const id = (params.get('v') || '').trim();

const stage = document.getElementById('stage');
const caption = document.getElementById('caption');

let apiPromise = null;

const PLAY_SVG =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M8 5.14v13.72c0 .8.87 1.3 1.56.9l10.8-6.86a1.06 1.06 0 0 0 0-1.8L9.56 4.24A1.06 1.06 0 0 0 8 5.14Z"/></svg>';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

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

function start(videoId) {
  stage.innerHTML = '<div id="ytPlayer"></div>';
  ensureApi().then(() => {
    new window.YT.Player('ytPlayer', {
      videoId,
      host: 'https://www.youtube-nocookie.com',
      playerVars: {
        autoplay: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        origin: location.origin,
      },
    });
  });
}

function showFacade(title) {
  const label = title ? `${t('action_play')} ${title}` : t('facade_play');
  stage.innerHTML = `
    <button class="player__facade" id="facade" type="button" aria-label="${escapeHtml(label)}">
      <img src="${thumbnailUrl(id)}" alt="" width="480" height="360"
           fetchpriority="high" decoding="async">
      <span class="player__facade-play"><span>${PLAY_SVG} ${escapeHtml(t('facade_play'))}</span></span>
    </button>`;
  document.getElementById('facade').addEventListener('click', () => start(id));
}

async function init() {
  await initI18n();

  if (!id) {
    stage.innerHTML = `
      <div class="state" style="position:absolute; inset:0; border:0; display:grid; place-content:center; text-align:center;">
        <h2>Beatavo</h2>
        <p><a class="btn btn--primary" href="../">Beatavo</a></p>
      </div>`;
    return;
  }

  let title = '';
  try {
    const all = await loadVideos('../data/videos.json');
    title = all.find((v) => v.id === id)?.title || '';
  } catch {
    /* catalogue is optional for the embed */
  }

  if (title) {
    document.title = `${title} · Beatavo`;
    caption.textContent = title;
  }
  showFacade(title);
}

init();
