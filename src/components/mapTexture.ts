// A parchment feel for the map without needing commissioned illustration: a tileable paper
// grain (used as a low-opacity CSS overlay) and a drawn compass rose, built the same way the
// marker icons are — once, on a canvas, cached. The underlying map stays the precise vector
// data it already was; this only changes how it reads.

let grainUrl: string | null = null;

/** A small, seamless-tiling paper-grain PNG, as a data URL for a CSS background-image. */
export function paperGrainUrl(): string {
  if (grainUrl) return grainUrl;
  const SIZE = 128;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(SIZE, SIZE);
  // Simple value noise with a touch of warm tint, tiled by construction (each pixel is
  // independent, so the edges already match).
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 90 + Math.random() * 110;
    img.data[i] = n;
    img.data[i + 1] = n * 0.93;
    img.data[i + 2] = n * 0.78;
    img.data[i + 3] = 40;
  }
  ctx.putImageData(img, 0, 0);
  // A handful of soft fibre strokes on top, the way laid paper shows faint directional texture.
  ctx.strokeStyle = 'rgba(90, 78, 56, 0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const y = Math.random() * SIZE;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(SIZE * 0.3, y + (Math.random() - 0.5) * 10, SIZE * 0.7, y + (Math.random() - 0.5) * 10, SIZE, y);
    ctx.stroke();
  }
  grainUrl = canvas.toDataURL();
  return grainUrl;
}

let roseUrl: string | null = null;

/** A simple eight-point compass rose, drawn once and cached as a data URL for an <img>. */
export function compassRoseUrl(): string {
  if (roseUrl) return roseUrl;
  const SIZE = 72;
  const c = SIZE / 2;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const spike = (len: number, width: number, fill: string) => {
    const p = new Path2D();
    p.moveTo(c, c - len);
    p.lineTo(c + width, c);
    p.lineTo(c, c + len);
    p.lineTo(c - width, c);
    p.closePath();
    ctx.fillStyle = fill;
    ctx.fill(p);
  };
  ctx.save();
  // Four long main points (N/E/S/W), four short ordinal points, each alternating light/dark
  // halves the way an engraved compass rose shades its facets.
  for (let i = 0; i < 4; i++) {
    ctx.translate(c, c);
    ctx.rotate(Math.PI / 2);
    ctx.translate(-c, -c);
    spike(c - 4, 3.2, '#e7dcc0');
  }
  ctx.restore();
  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(Math.PI / 4);
  ctx.translate(-c, -c);
  for (let i = 0; i < 4; i++) {
    ctx.translate(c, c);
    ctx.rotate(Math.PI / 2);
    ctx.translate(-c, -c);
    spike((c - 4) * 0.55, 2.4, 'rgba(231, 220, 192, 0.6)');
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(c, c, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#e7dcc0';
  ctx.fill();
  roseUrl = canvas.toDataURL();
  return roseUrl;
}

let cornerUrl: string | null = null;

/**
 * A single engraved corner flourish, meant for the map's top-left corner — the other three
 * corners reuse this same image, rotated 90°/180°/270° in CSS. Gives the frame an old-atlas
 * plate feel without needing four separate drawings.
 */
export function cornerFlourishUrl(): string {
  if (cornerUrl) return cornerUrl;
  const SIZE = 64;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const gold = '#e7dcc0';
  ctx.strokeStyle = gold;
  ctx.fillStyle = gold;
  ctx.lineWidth = 1.4;
  // Two nested L-shaped scrolls curling in from the corner.
  ctx.beginPath();
  ctx.moveTo(2, 22);
  ctx.bezierCurveTo(2, 6, 6, 2, 22, 2);
  ctx.moveTo(2, 30);
  ctx.bezierCurveTo(2, 10, 10, 2, 30, 2);
  ctx.stroke();
  // A small curling spiral terminus on each scroll end, the way engraved map borders finish.
  const spiral = (cx: number, cy: number, r: number) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 1.5);
    ctx.stroke();
  };
  spiral(22, 8, 5);
  spiral(8, 22, 5);
  // A single accent dot at the outer corner.
  ctx.beginPath();
  ctx.arc(4, 4, 1.6, 0, Math.PI * 2);
  ctx.fill();
  cornerUrl = canvas.toDataURL();
  return cornerUrl;
}
