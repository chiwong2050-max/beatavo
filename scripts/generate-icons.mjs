/**
 * Beatavo icon generator.
 *
 * Draws the Beatavo mark (gradient rounded square + sound-wave bars) and writes
 * PNGs for the PWA manifest, plus a social share image. Pure Node — no
 * dependencies, no image libraries.
 *
 * Usage:  node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const iconsDir = resolve(root, 'assets', 'icons');
const imagesDir = resolve(root, 'assets', 'images');
mkdirSync(iconsDir, { recursive: true });
mkdirSync(imagesDir, { recursive: true });

/* ------------------------------------------------------------------ colours */
const BRAND_A = [124, 77, 255]; // #7c4dff
const BRAND_B = [255, 62, 157]; // #ff3e9d
const ACCENT = [255, 210, 51]; // #ffd233
const WHITE = [255, 255, 255];

/* Bars of the sound wave, in glyph-local (0..1) coordinates. */
const BARS = [
  { x: 0.08, w: 0.12, h: 0.2 },
  { x: 0.26, w: 0.12, h: 0.33 },
  { x: 0.44, w: 0.12, h: 0.46, accent: true },
  { x: 0.62, w: 0.12, h: 0.3 },
  { x: 0.8, w: 0.12, h: 0.18 },
];

/* --------------------------------------------------------------- PNG encoder */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------------------------------------------------------- rendering */
function insideRoundedRect(px, py, x, y, w, h, r) {
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

/**
 * @param {object} opts
 * @param {number} opts.width
 * @param {number} opts.height
 * @param {number} [opts.cornerRatio] rounded-corner radius as a fraction of the
 *   smaller side (0 = full-bleed square, used for maskable/apple/og).
 * @param {number} [opts.glyphScale] glyph box size as a fraction of the smaller side.
 */
function render({ width, height, cornerRatio = 0, glyphScale = 0.8 }) {
  const SS = 3; // supersampling factor for smooth edges
  const W = width * SS;
  const H = height * SS;
  const src = Buffer.alloc(W * H * 4);

  const minSide = Math.min(W, H);
  const glyph = minSide * glyphScale;
  const centerX = W / 2;
  const centerY = H / 2;
  const gx0 = centerX - glyph / 2;
  const cornerR = cornerRatio * minSide;

  const rects = BARS.map((b) => {
    const w = b.w * glyph;
    const halfH = (b.h / 2) * glyph;
    return {
      x: gx0 + b.x * glyph,
      y: centerY - halfH,
      w,
      h: halfH * 2,
      r: w / 2,
      color: b.accent ? ACCENT : WHITE,
    };
  });

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const t = (px / W + py / H) / 2;
      let r = BRAND_A[0] + (BRAND_B[0] - BRAND_A[0]) * t;
      let g = BRAND_A[1] + (BRAND_B[1] - BRAND_A[1]) * t;
      let b = BRAND_A[2] + (BRAND_B[2] - BRAND_A[2]) * t;

      let a = 255;
      if (cornerR > 0) {
        const ccx = Math.min(Math.max(px, cornerR), W - cornerR);
        const ccy = Math.min(Math.max(py, cornerR), H - cornerR);
        const dx = px - ccx;
        const dy = py - ccy;
        if (dx * dx + dy * dy > cornerR * cornerR) a = 0;
      }

      if (a > 0) {
        for (const rc of rects) {
          if (insideRoundedRect(px, py, rc.x, rc.y, rc.w, rc.h, rc.r)) {
            r = rc.color[0];
            g = rc.color[1];
            b = rc.color[2];
            break;
          }
        }
      }

      const o = (py * W + px) * 4;
      src[o] = r;
      src[o + 1] = g;
      src[o + 2] = b;
      src[o + 3] = a;
    }
  }

  return downsample(src, W, H, SS);
}

function downsample(src, W, H, SS) {
  const w = W / SS;
  const h = H / SS;
  const out = Buffer.alloc(w * h * 4);
  const samples = SS * SS;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let accR = 0;
      let accG = 0;
      let accB = 0;
      let accA = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const o = ((y * SS + sy) * W + (x * SS + sx)) * 4;
          const a = src[o + 3] / 255;
          accR += src[o] * a;
          accG += src[o + 1] * a;
          accB += src[o + 2] * a;
          accA += a;
        }
      }
      const o2 = (y * w + x) * 4;
      if (accA > 0) {
        out[o2] = Math.round(accR / accA);
        out[o2 + 1] = Math.round(accG / accA);
        out[o2 + 2] = Math.round(accB / accA);
      }
      out[o2 + 3] = Math.round((accA / samples) * 255);
    }
  }
  return out;
}

/* ---------------------------------------------------------------- ICO output */
/** Wrap PNG images in a classic .ico container (PNG-in-ICO, widely supported). */
function encodeICO(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4); // image count

  const entries = Buffer.alloc(16 * pngs.length);
  let offset = 6 + 16 * pngs.length;
  const bodies = [];

  pngs.forEach(({ size, png }, i) => {
    const b = i * 16;
    entries[b] = size >= 256 ? 0 : size; // width (0 means 256)
    entries[b + 1] = size >= 256 ? 0 : size; // height
    entries.writeUInt16LE(1, b + 4); // colour planes
    entries.writeUInt16LE(32, b + 6); // bits per pixel
    entries.writeUInt32LE(png.length, b + 8); // size of image data
    entries.writeUInt32LE(offset, b + 12); // offset of image data
    offset += png.length;
    bodies.push(png);
  });

  return Buffer.concat([header, entries, ...bodies]);
}

/* -------------------------------------------------------------------- output */
const targets = [
  {
    file: resolve(iconsDir, 'icon-192.png'),
    opts: { width: 192, height: 192, cornerRatio: 0.22, glyphScale: 0.8 },
  },
  {
    file: resolve(iconsDir, 'icon-512.png'),
    opts: { width: 512, height: 512, cornerRatio: 0.22, glyphScale: 0.8 },
  },
  {
    file: resolve(iconsDir, 'icon-maskable-512.png'),
    opts: { width: 512, height: 512, cornerRatio: 0, glyphScale: 0.6 },
  },
  {
    file: resolve(iconsDir, 'apple-touch-icon.png'),
    opts: { width: 180, height: 180, cornerRatio: 0, glyphScale: 0.72 },
  },
  {
    file: resolve(imagesDir, 'og.png'),
    opts: { width: 1200, height: 630, cornerRatio: 0, glyphScale: 0.62 },
  },
];

for (const { file, opts } of targets) {
  const rgba = render(opts);
  const png = encodePNG(opts.width, opts.height, rgba);
  writeFileSync(file, png);
  console.log(`wrote ${file} (${opts.width}x${opts.height}, ${png.length} bytes)`);
}

/* Classic /favicon.ico fallback (16/32/48px) for older browsers and crawlers. */
const faviconPngs = [16, 32, 48].map((size) => ({
  size,
  png: encodePNG(size, size, render({ width: size, height: size, cornerRatio: 0.22, glyphScale: 0.8 })),
}));
const faviconIco = encodeICO(faviconPngs);
writeFileSync(resolve(root, 'favicon.ico'), faviconIco);
console.log(`wrote ${resolve(root, 'favicon.ico')} (16/32/48px, ${faviconIco.length} bytes)`);

console.log('Done. Icons generated.');
