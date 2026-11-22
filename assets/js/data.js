/**
 * Beatavo — shared data layer.
 * Loads and normalises the video catalogue from /data/videos.json.
 * No API keys, no backend.
 */

export const SECTIONS = {
  main: { id: 'main', label: 'Beatavo', title: 'Beatavo' },
  kids: { id: 'kids', label: 'Beatavo Kids', title: 'Beatavo Kids' },
};

const VALID_SECTIONS = new Set(['main', 'kids']);

/** Newest first. */
function byNewestFirst(a, b) {
  const ta = Date.parse(a.published) || 0;
  const tb = Date.parse(b.published) || 0;
  if (tb !== ta) return tb - ta;
  return a.title.localeCompare(b.title);
}

/** Keep only well-formed entries, then sort newest first. */
export function normaliseVideos(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(
      (v) =>
        v &&
        typeof v.id === 'string' &&
        v.id.trim() !== '' &&
        typeof v.title === 'string' &&
        v.title.trim() !== '' &&
        VALID_SECTIONS.has(v.section)
    )
    .map((v) => ({
      id: v.id.trim(),
      title: v.title.trim(),
      section: v.section,
      published: typeof v.published === 'string' ? v.published : '',
      tags: Array.isArray(v.tags)
        ? Array.from(
            new Set(
              v.tags
                .filter((x) => typeof x === 'string')
                .map((x) => x.trim().toLowerCase())
                .filter(Boolean)
            )
          )
        : [],
    }))
    .sort(byNewestFirst);
}

/**
 * Fetch the catalogue.
 * @param {string} path relative path to videos.json for the current page.
 */
export async function loadVideos(path = './data/videos.json') {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load videos (HTTP ${res.status})`);
  return normaliseVideos(await res.json());
}

/** YouTube thumbnail (always-available 480x360 asset). */
export function thumbnailUrl(id, size = 'hqdefault') {
  return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/${size}.jpg`;
}

/** Link to a video's shareable watch page (used from the site root). */
export function watchHref(id) {
  return `./watch/?v=${encodeURIComponent(id)}`;
}

/* --------------------------------------------------------------------------
   Tags — optional categories on each video (e.g. animals, party).
   -------------------------------------------------------------------------- */

/** A tag needs at least this many videos before it gets its own page. */
export const MIN_TAG_VIDEOS = 3;

/** Tags with at least `minVideos` videos, most-used first. */
export function collectTags(videos, { minVideos = MIN_TAG_VIDEOS } = {}) {
  const counts = new Map();
  for (const v of videos || []) {
    for (const tag of v.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return Array.from(counts, ([tag, count]) => ({ tag, count }))
    .filter((entry) => entry.count >= minVideos)
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Videos carrying a given tag (case-insensitive). */
export function videosByTag(videos, tag) {
  const want = String(tag || '').trim().toLowerCase();
  if (!want) return [];
  return (videos || []).filter((v) => (v.tags || []).includes(want));
}

/** Link to a tag page; pass `base` ('../') from nested pages. */
export function tagHref(tag, base = './') {
  return `${base}tag/?t=${encodeURIComponent(tag)}`;
}

/** Turn a tag slug ("kids-favourites") into a display label ("Kids Favourites"). */
export function formatTag(tag) {
  return String(tag || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Human-friendly date. */
export function formatDate(iso) {
  const t = Date.parse(iso);
  if (!t) return '';
  return new Date(t).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Deterministically pick one video per calendar day (UTC) so that everyone
 * sees the same "Dance of the day". No storage, no randomness.
 */
export function danceOfTheDay(videos, date = new Date()) {
  if (!videos || videos.length === 0) return null;
  const day = Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000
  );
  return videos[day % videos.length];
}

/* --------------------------------------------------------------------------
   Favourites — stored locally in the browser (no accounts, no server).
   -------------------------------------------------------------------------- */
const FAV_KEY = 'beatavo:favourites';

/** Fired on window whenever the favourites list changes. */
export const FAVOURITES_EVENT = 'beatavo:favourites-changed';

/** Read the saved favourite ids (safe if storage is unavailable). */
export function getFavourites() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function isFavourite(id) {
  return getFavourites().includes(id);
}

/** Add or remove an id. Returns the new favourite state for that id. */
export function toggleFavourite(id) {
  const set = new Set(getFavourites());
  const added = !set.has(id);
  if (added) set.add(id);
  else set.delete(id);
  const list = Array.from(set);
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(list));
  } catch {
    /* private mode / quota — favourites simply won't persist */
  }
  window.dispatchEvent(new CustomEvent(FAVOURITES_EVENT, { detail: { id, list } }));
  return added;
}
