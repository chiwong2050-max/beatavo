/**
 * Beatavo — 404 page.
 * The "Play something random" button picks any video from the catalogue and
 * sends the visitor straight to its watch page.
 */
import { loadVideos } from './data.js';
import { initI18n } from './i18n.js';
import './theme.js';

const randomBtn = document.getElementById('randomBtn');
const DATA_URL = new URL('../../data/videos.json', import.meta.url).href;
const WATCH_URL = new URL('../../watch/', import.meta.url);

function openRandom(videos) {
  const pick = videos[Math.floor(Math.random() * videos.length)];
  location.href = `${WATCH_URL}?v=${encodeURIComponent(pick.id)}`;
}

async function goRandom() {
  randomBtn.disabled = true;
  try {
    const videos = await loadVideos(DATA_URL);
    if (videos.length) {
      openRandom(videos);
      return;
    }
  } catch {
    /* fall through to home */
  }
  location.href = new URL('../../', import.meta.url).href;
}

randomBtn?.addEventListener('click', goRandom);
initI18n();
