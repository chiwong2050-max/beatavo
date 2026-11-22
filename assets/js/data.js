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
