/**
 * Beatavo — sitemap.xml + robots.txt generator.
 * Reads data/videos.json and writes one URL per watch page, plus the static
 * pages. Dependency-free.
 *
 * Usage:  npm run sitemap              (or: node scripts/generate-sitemap.mjs)
 *         SITE_URL=https://example.com npm run sitemap
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

/* Production origin. Override with SITE_URL when deploying elsewhere. */
const BASE_URL = (process.env.SITE_URL || 'https://beatavo.com').replace(/\/+$/, '');

function xmlEscape(str) {
  return String(str).replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])
  );
}

/** Keep only well-formed entries we can build a watch URL from. */
function normalise(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(
    (v) =>
      v &&
      typeof v.id === 'string' &&
      v.id.trim() !== '' &&
      typeof v.title === 'string' &&
      v.title.trim() !== '' &&
      (v.section === 'main' || v.section === 'kids')
  );
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  const lines = ['  <url>', `    <loc>${xmlEscape(loc)}</loc>`];
  if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) lines.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) lines.push(`    <priority>${priority}</priority>`);
  lines.push('  </url>');
  return lines.join('\n');
}

async function main() {
  const raw = await readFile(resolve(root, 'data/videos.json'), 'utf8');
  const videos = normalise(JSON.parse(raw));
  const today = new Date().toISOString().slice(0, 10);

  const entries = [
    { loc: `${BASE_URL}/`, changefreq: 'daily', priority: '1.0', lastmod: today },
    { loc: `${BASE_URL}/kids/`, changefreq: 'weekly', priority: '0.8', lastmod: today },
  ];

  for (const v of videos) {
    entries.push({
      loc: `${BASE_URL}/watch/?v=${encodeURIComponent(v.id)}`,
      lastmod: (v.published || '').slice(0, 10) || today,
      priority: '0.6',
    });
  }

  entries.push({ loc: `${BASE_URL}/privacy/`, changefreq: 'yearly', priority: '0.3', lastmod: today });

  const sitemap =
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      entries.map(urlEntry).join('\n'),
      '</urlset>',
      '',
    ].join('\n') + '\n';

  const robots = ['User-agent: *', 'Allow: /', '', `Sitemap: ${BASE_URL}/sitemap.xml`, ''].join('\n');

  await writeFile(resolve(root, 'sitemap.xml'), sitemap, 'utf8');
  await writeFile(resolve(root, 'robots.txt'), robots, 'utf8');

  console.log(`Wrote sitemap.xml (${entries.length} URLs) and robots.txt for ${BASE_URL}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
