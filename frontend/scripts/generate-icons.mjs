/**
 * Generates PWA icons — WW2 Panther tank side profile (facing left) with "DB" text.
 * Pure Node.js, no external dependencies.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '../public');

// ─── PNG infrastructure ───────────────────────────────────────────────────────

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[i] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const byte of buf) crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii'), d = Buffer.from(data);
  const len = Buffer.alloc(4), c = Buffer.alloc(4);
  len.writeUInt32BE(d.length); c.writeUInt32BE(crc32(Buffer.concat([t, d])));
  return Buffer.concat([len, t, d, c]);
}
function makePNG(w, h, draw) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const hdr = Buffer.alloc(13);
  hdr.writeUInt32BE(w, 0); hdr.writeUInt32BE(h, 4); hdr[8] = 8; hdr[9] = 2;
  const raw = [];
  for (let y = 0; y < h; y++) {
    raw.push(0);
    for (let x = 0; x < w; x++) {
      const [r, g, b] = draw(x, y);
      raw.push(r, g, b);
    }
  }
  return Buffer.concat([
    sig,
    pngChunk('IHDR', hdr),
    pngChunk('IDAT', deflateSync(Buffer.from(raw))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Icon composer ────────────────────────────────────────────────────────────

function makeDrawer(W, H) {
  const BG     = [0x1a, 0x1a, 0x2e]; // dark navy background
  const OLIVE  = [0x3d, 0x4a, 0x30]; // military olive (tank body)
  const DARK   = [0x1e, 0x21, 0x16]; // near-black olive (tracks)
  const HUB    = [0x58, 0x68, 0x48]; // lighter olive (wheel hub highlight)
  const ACCENT = [0xe9, 0x45, 0x60]; // red (DB text)

  // ── Bitmap font 7×9 ───────────────────────────────────────────────────────
  const G = {
    D: [
      [1,1,1,1,0,0,0],
      [1,0,0,0,1,0,0],
      [1,0,0,0,0,1,0],
      [1,0,0,0,0,1,0],
      [1,0,0,0,0,1,0],
      [1,0,0,0,0,1,0],
      [1,0,0,0,0,1,0],
      [1,0,0,0,1,0,0],
      [1,1,1,1,0,0,0],
    ],
    B: [
      [1,1,1,1,0,0,0],
      [1,0,0,0,1,0,0],
      [1,0,0,0,1,0,0],
      [1,1,1,1,0,0,0],
      [1,0,0,0,0,1,0],
      [1,0,0,0,0,1,0],
      [1,0,0,0,0,1,0],
      [1,0,0,0,1,0,0],
      [1,1,1,1,0,0,0],
    ],
  };
  const FC = 7, FR = 9, GAP = 2;
  const bs = Math.max(1, Math.round(H * 0.031));       // font block size in pixels
  const tx0 = Math.round((W - (2 * FC + GAP) * bs) / 2);
  const ty0 = Math.round(H * 0.04);

  function inDB(x, y) {
    const row = Math.floor((y - ty0) / bs);
    if (row < 0 || row >= FR) return false;
    const col = Math.floor((x - tx0) / bs);
    if (col >= 0 && col < FC) return G.D[row][col] === 1;
    const c2 = col - FC - GAP;
    if (c2 >= 0 && c2 < FC) return G.B[row][c2] === 1;
    return false;
  }

  // ── Tank geometry (Panther, facing left — gun points left) ────────────────
  // Tank bounding box: x [0.02W, 0.98W], y [0.43H, 0.97H]
  const px = v => (0.02 + v * 0.96) * W;
  const py = v => (0.43 + v * 0.54) * H;

  // Point-in-convex-polygon (ray casting)
  function pip(ptx, pty, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > pty) !== (yj > pty) && ptx < (xj - xi) * (pty - yi) / (yj - yi) + xi)
        inside = !inside;
    }
    return inside;
  }

  function inCirc(ptx, pty, cx, cy, r) {
    return (ptx - cx) ** 2 + (pty - cy) ** 2 <= r * r;
  }

  // Track band — dark rubber/steel rectangle along the bottom
  const trkY1 = py(0.65), trkY2 = py(1.00);
  const trkX1 = px(0.00), trkX2 = px(1.00);

  // Hull — trapezoidal main armour. Front (left) is Panther's sloped glacis.
  const hull = [
    [px(0.05), py(0.30)],  // glacis top-front
    [px(0.02), py(0.67)],  // glacis bottom-front (meets track)
    [px(0.97), py(0.67)],  // rear bottom
    [px(0.95), py(0.36)],  // rear top
  ];

  // Turret — Panther's distinctive shape: steep front, near-vertical rear.
  // Positioned ~30–65% from front of hull. Bottom extends below hull top
  // to guarantee no pixel gap where they meet.
  const turret = [
    [px(0.29), py(0.42)],  // front-bottom (overlaps hull top)
    [px(0.31), py(0.00)],  // front-top
    [px(0.65), py(0.02)],  // rear-top
    [px(0.66), py(0.42)],  // rear-bottom (overlaps hull top)
  ];

  // Gun barrel — 75 mm L/70, very long. Runs from left edge to mantlet.
  const gunY1 = py(0.12), gunY2 = py(0.20);
  const gunX2 = px(0.31);               // meets mantlet
  // gunX1 = 0 (clipped to left edge — barrel exits the icon, looks dramatic)

  // Mantlet — rounded bulge where gun exits the turret front face
  const mCX = px(0.31), mCY = (gunY1 + gunY2) / 2, mR = 0.050 * W;

  // Road wheels — 8 large interleaved wheels (Panther hallmark)
  const wY = py(0.830);
  const wR = 0.044 * W;
  const hR = 0.013 * W;   // hub highlight radius
  const wXs = [0.09, 0.20, 0.31, 0.42, 0.52, 0.63, 0.74, 0.85].map(px);

  // Idler (front-left) and drive sprocket (rear-right)
  const idX = px(0.03), idY = py(0.800), idR = 0.038 * W;
  const spX = px(0.96), spY = py(0.805), spR = 0.037 * W;

  // ── Per-pixel colour decision ─────────────────────────────────────────────
  return function draw(x, y) {
    // DB text — always on top
    if (inDB(x, y)) return ACCENT;

    // Gun barrel (thin horizontal rectangle)
    if (x >= 0 && x <= gunX2 && y >= gunY1 && y <= gunY2) return OLIVE;

    // Mantlet (circular boss at turret front)
    if (inCirc(x, y, mCX, mCY, mR)) return OLIVE;

    // Turret and hull — same colour, checked together so no gap forms
    if (pip(x, y, turret) || pip(x, y, hull)) return OLIVE;

    // Wheel hub highlights (drawn before wheels so they appear on top)
    for (const wx of wXs)
      if (inCirc(x, y, wx, wY, hR)) return HUB;
    if (inCirc(x, y, idX, idY, hR)) return HUB;
    if (inCirc(x, y, spX, spY, hR)) return HUB;

    // Road wheels
    for (const wx of wXs)
      if (inCirc(x, y, wx, wY, wR)) return DARK;
    if (inCirc(x, y, idX, idY, idR)) return DARK;
    if (inCirc(x, y, spX, spY, spR)) return DARK;

    // Track band
    if (x >= trkX1 && x <= trkX2 && y >= trkY1 && y <= trkY2) return DARK;

    return BG;
  };
}

// ─── Generate all sizes ───────────────────────────────────────────────────────

mkdirSync(join(PUBLIC, 'icons'), { recursive: true });

for (const [p, w, h] of [
  ['icons/icon-192.png', 192, 192],
  ['icons/icon-512.png', 512, 512],
  ['apple-touch-icon.png', 180, 180],
  ['favicon.png', 48, 48],
]) {
  writeFileSync(join(PUBLIC, p), makePNG(w, h, makeDrawer(w, h)));
  console.log(`  ✓ ${p} (${w}×${h})`);
}

console.log('\nDone. Icons written to frontend/public/');
