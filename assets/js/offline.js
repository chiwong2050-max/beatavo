/**
 * Beatavo — offline page.
 * Shown by the service worker when a navigation fails. Lists the titles the
 * user played most recently (from localStorage) so they can jump back in.
 */
import { getRecentlyPlayed } from './data.js';
import { initI18n } from './i18n.js';

const listEl = document.getElementById('offlineList');
const emptyEl = document.getElementById('offlineEmpty');
const retryBtn = document.getElementById('offlineRetry');
const DATA_URL = new URL('../../data/videos.json', import.meta.url);

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

async function render() {
  const ids = getRecentlyPlayed();
  if (!ids.length) {
    emptyEl.hidden = false;
    return;
  }

  let videos = [];
  try {
    const res = await fetch(DATA_URL, { cache: 'no-cache' });
    if (res.ok) videos = await res.json();
  } catch {
    /* no cached data — fall back to ids */
  }
  const byId = new Map((videos || []).map((v) => [v.id, v]));
  const base = new URL('../../watch/', import.meta.url);

  listEl.innerHTML = ids
    .map((id) => {
      const title = byId.get(id)?.title || id;
      const href = `${base}?v=${encodeURIComponent(id)}`;
      return `<li class="offline__item"><a class="offline__link" href="${href}">${escapeHtml(title)}</a></li>`;
    })
    .join('');
}

retryBtn?.addEventListener('click', () => location.reload());

initI18n().then(render).catch(render);
