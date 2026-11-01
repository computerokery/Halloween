import { alterEgo, sigilOf } from './fate.js';

/**
 * Renders a Midnight Pass to a 1080×1350 PNG (Instagram portrait), so what the guest sees in
 * the dialog is exactly what they save and share.
 */

export const PASS_W = 1080;
export const PASS_H = 1350;

const C = {
  page: '#080706',
  card: '#120d0a',
  cream: '#f5ebdd',
  secondary: '#b9a99a',
  muted: '#786b60',
  accent: '#e97820',
  light: '#ffb45c',
  border: 'rgba(233, 120, 32, 0.5)',
  hair: 'rgba(185, 169, 154, 0.2)',
};
const UI = "'Manrope', system-ui, sans-serif";
const DISPLAY = "'Bodoni Moda', Didot, Georgia, serif";

/** Make sure the web fonts are usable by canvas before drawing. */
async function fontsReady() {
  if (!document.fonts) return;
  await Promise.race([
    Promise.all([
      document.fonts.load(`300 80px ${UI}`, 'A'),
      document.fonts.load(`500 24px ${UI}`, 'A'),
      document.fonts.load(`italic 500 60px ${DISPLAY}`, 'A'),
    ]),
    new Promise((r) => setTimeout(r, 2500)),
  ]).catch(() => {});
}

/** Letter-spaced text drawn char by char (ctx.letterSpacing is not universal). */
function spaced(ctx, text, x, y, spacing, align = 'center') {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => {
    ctx.fillText(ch, cx, y);
    cx += widths[i] + spacing;
  });
  ctx.textAlign = prev;
  return total;
}

/** Largest font size (≤ max) at which text fits in width. */
function fit(ctx, text, font, max, width) {
  let size = max;
  ctx.font = font(size);
  while (size > 24 && ctx.measureText(text).width > width) {
    size -= 2;
    ctx.font = font(size);
  }
  return size;
}

function wrap(ctx, text, width) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  words.forEach((w) => {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = w;
    } else line = next;
  });
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function sparkle(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x - s / 2, y - s / 2);
  ctx.scale(s / 24, s / 24);
  ctx.fill(new Path2D('M12 0c.35 6.2 1.9 10.6 12 12-10.1 1.4-11.65 5.8-12 12-.35-6.2-1.9-10.6-12-12C10.1 10.6 11.65 6.2 12 0z'));
  ctx.restore();
}

function drawSigil(ctx, seed, cx, cy, size) {
  const s = sigilOf(seed);
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 200, size / 200);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(255, 132, 35, 0.85)';
  ctx.shadowBlur = 28;
  ctx.strokeStyle = C.light;
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.55;
  ctx.stroke(new Path2D(s.ring));
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.8;
  [s.star, s.spine, s.inner].forEach((d) => ctx.stroke(new Path2D(d)));
  ctx.fillStyle = C.cream;
  ctx.fill(new Path2D(s.nodes));
  ctx.restore();
}

/**
 * @param {{ name: string, fate: ReturnType<import('./fate.js').fateOf>, from?: string }} pass
 * @returns {Promise<Blob>}
 */
export async function renderPass({ name, fate, from }) {
  await fontsReady();
  const canvas = document.createElement('canvas');
  canvas.width = PASS_W;
  canvas.height = PASS_H;
  const ctx = canvas.getContext('2d');
  const W = PASS_W;
  const mid = W / 2;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';

  // page + card
  ctx.fillStyle = C.page;
  ctx.fillRect(0, 0, W, PASS_H);
  const inset = 28;
  roundRect(ctx, inset, inset, W - inset * 2, PASS_H - inset * 2, 28);
  ctx.fillStyle = C.card;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // the candle's glow behind the sigil, and a floor bounce
  let g = ctx.createRadialGradient(mid, 420, 0, mid, 420, 560);
  g.addColorStop(0, 'rgba(233, 120, 32, 0.34)');
  g.addColorStop(0.45, 'rgba(169, 77, 23, 0.12)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, PASS_H);
  g = ctx.createLinearGradient(0, 1060, 0, PASS_H);
  g.addColorStop(0, 'rgba(8, 7, 6, 0)');
  g.addColorStop(1, 'rgba(8, 7, 6, 0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 1060, W, PASS_H - 1060);
  // grain
  const grain = ctx.createImageData(256, 256);
  for (let i = 0; i < grain.data.length; i += 4) {
    const v = Math.random() * 255;
    grain.data[i] = grain.data[i + 1] = grain.data[i + 2] = v;
    grain.data[i + 3] = 10;
  }
  const tile = document.createElement('canvas');
  tile.width = tile.height = 256;
  tile.getContext('2d').putImageData(grain, 0, 0);
  ctx.fillStyle = ctx.createPattern(tile, 'repeat');
  ctx.fillRect(0, 0, W, PASS_H);
  ctx.restore();

  // frame
  roundRect(ctx, inset + 18, inset + 18, W - (inset + 18) * 2, PASS_H - (inset + 18) * 2, 16);
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  // header
  ctx.fillStyle = C.light;
  sparkle(ctx, mid, 128, 26);
  ctx.fillStyle = C.secondary;
  ctx.font = `500 22px ${UI}`;
  spaced(ctx, 'THE MIDNIGHT CLUB', mid, 186, 8);
  ctx.fillStyle = C.light;
  ctx.font = `italic 500 34px ${DISPLAY}`;
  ctx.fillText('Admit one soul', mid, 236);

  // sigil
  drawSigil(ctx, fate.seed, mid, 470, 380);

  // name
  const upper = name.toLocaleUpperCase();
  const nameSize = fit(ctx, upper, (s) => `300 ${s}px ${UI}`, 92, W - 220);
  ctx.fillStyle = C.cream;
  ctx.font = `300 ${nameSize}px ${UI}`;
  ctx.fillText(upper, mid, 790);

  // alter ego — the ember gradient of "calling"
  const ego = alterEgo(fate);
  const egoSize = fit(ctx, ego, (s) => `italic 500 ${s}px ${DISPLAY}`, 64, W - 200);
  ctx.font = `italic 500 ${egoSize}px ${DISPLAY}`;
  const ew = ctx.measureText(ego).width;
  g = ctx.createLinearGradient(mid - ew / 2, 0, mid + ew / 2, 0);
  g.addColorStop(0, C.accent);
  g.addColorStop(0.55, '#f0904a');
  g.addColorStop(1, C.light);
  ctx.fillStyle = g;
  ctx.fillText(ego, mid, 870);
  ctx.fillStyle = C.secondary;
  ctx.font = `italic 400 32px ${DISPLAY}`;
  ctx.fillText(`of ${fate.domain}`, mid, 920);

  // details
  const cols = [
    ['DATE', 'October 31'],
    ['DOORS', '8 PM'],
    ['YOUR HOUR', fate.hour],
  ];
  const colW = (W - 200) / 3;
  cols.forEach(([label, value], i) => {
    const x = 100 + colW * i + colW / 2;
    ctx.fillStyle = C.muted;
    ctx.font = `500 18px ${UI}`;
    spaced(ctx, label, x, 1002, 5);
    ctx.fillStyle = C.cream;
    ctx.font = `400 30px ${UI}`;
    ctx.fillText(value, x, 1044);
  });
  ctx.strokeStyle = C.hair;
  ctx.lineWidth = 1;
  [1, 2].forEach((i) => {
    const x = 100 + colW * i;
    ctx.beginPath();
    ctx.moveTo(x, 978);
    ctx.lineTo(x, 1052);
    ctx.stroke();
  });

  // perforation, with the ticket's notches
  const perf = 1100;
  ctx.setLineDash([10, 12]);
  ctx.strokeStyle = 'rgba(233, 120, 32, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(inset + 40, perf);
  ctx.lineTo(W - inset - 40, perf);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = C.page;
  [inset, W - inset].forEach((x) => {
    ctx.beginPath();
    ctx.arc(x, perf, 26, 0, Math.PI * 2);
    ctx.fill();
  });

  // stub: the omen + pass number
  ctx.textAlign = 'left';
  ctx.fillStyle = C.muted;
  ctx.font = `500 18px ${UI}`;
  spaced(ctx, 'YOUR COSTUME OMEN', 110, 1164, 5, 'left');
  ctx.fillStyle = C.cream;
  ctx.font = `italic 400 30px ${DISPLAY}`;
  wrap(ctx, fate.omen, 640)
    .slice(0, 2)
    .forEach((line, i) => ctx.fillText(line, 110, 1212 + i * 40));

  ctx.textAlign = 'right';
  ctx.fillStyle = C.muted;
  ctx.font = `500 18px ${UI}`;
  spaced(ctx, 'PASS', W - 110, 1164, 5, 'right');
  ctx.fillStyle = C.light;
  ctx.font = `500 54px ${DISPLAY}`;
  ctx.fillText(`№ ${fate.number}`, W - 110, 1222);
  if (from) {
    ctx.fillStyle = C.secondary;
    ctx.font = `400 20px ${UI}`;
    ctx.fillText(`summoned by ${from}`, W - 110, 1280);
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render the pass'))), 'image/png'),
  );
}
