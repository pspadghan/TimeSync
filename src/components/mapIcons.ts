// Runtime-generated map icons. Chronoscope draws three kinds of thing on the map, and each
// gets its own SILHOUETTE so the kind is readable at a glance, before colour is even read:
//   place  — a plain filled circle (the standard cartographic mark for a settlement/site)
//   event  — a small badge shaped like what kind of event it was (see EVENT_ICON below)
//   person — a bust/avatar glyph, tinted per person via MapLibre's SDF icon-color
// Every icon here is drawn once per map instance, as a 64x64 monochrome silhouette, and
// registered as an SDF image so MapLibre can recolour it at render time (icon-color /
// icon-halo-color) without needing a separate asset per colour.
import type { EventCategory } from '../data/types';

const NATIVE = 64;
const C = NATIVE / 2;

function raster(draw: (ctx: CanvasRenderingContext2D) => void): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = NATIVE;
  canvas.height = NATIVE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx);
  return ctx.getImageData(0, 0, NATIVE, NATIVE);
}

const cache = new Map<string, ImageData>();
const memo = (key: string, draw: (ctx: CanvasRenderingContext2D) => void): (() => ImageData) => () => {
  if (!cache.has(key)) cache.set(key, raster(draw));
  return cache.get(key)!;
};

// --- person --------------------------------------------------------------------------------
// Two generic silhouettes — not a claim about any specific person's actual appearance, just
// which of the two a record's `gender` field picks when there is no commissioned
// portraitIconUrl (Person.portraitIconUrl, unused so far — the hook for a real likeness once
// one is sourced and cited). Distinguished the same way minimal pictogram sets usually do: a
// straight-sided bust versus a flared, dress-shaped one, not by caricaturing either.
export const personGlyph = memo('person', (ctx) => {
  const p = new Path2D();
  p.arc(32, 23, 12, 0, Math.PI * 2); // head
  p.moveTo(10, 56);
  p.bezierCurveTo(10, 40, 18, 34, 32, 34);
  p.bezierCurveTo(46, 34, 54, 40, 54, 56); // shoulders
  p.closePath();
  ctx.fill(p);
});

export const personGlyphFemale = memo('person-female', (ctx) => {
  const p = new Path2D();
  p.arc(32, 21, 10, 0, Math.PI * 2); // head, same proportion, sits a touch higher
  p.moveTo(32, 31);
  p.lineTo(52, 56);
  p.lineTo(12, 56);
  p.closePath(); // a flared triangular body, the standard pictogram distinction from the bust above
  ctx.fill(p);
});

// Several people at the same place become ONE marker, not a pile of overlapping busts — this
// is its badge: a rounded hexagon (not a circle or diamond — a third, clearly separate
// silhouette), so "this is a group, not a single person or event" reads before the count
// number (drawn as a separate text layer) is even read. At small sizes "two overlapping
// circles" fused into one Path2D read as a single indistinct blob — a plain polygon is
// crisper under the SDF halo than that blended-arc approach was.
// A capital's own flag — a pole with a flying rectangular pennant, anchored at its base (so
// placed with icon-anchor 'bottom' it reads as "planted at" the place dot beneath it, not
// floating free of it). Tinted per-polity via the same SDF icon-color mechanism as everything
// else — a generic flag shape, not a claim about any empire's actual heraldry, which isn't
// attested for most of the polities in this dataset.
export const flagGlyph = memo('flag', (ctx) => {
  const p = new Path2D();
  p.rect(18, 6, 3, 50); // pole
  p.moveTo(21, 8);
  p.lineTo(50, 14);
  p.lineTo(21, 24);
  p.closePath(); // pennant, flying right from near the top of the pole
  ctx.fill(p);
});

export const groupGlyph = memo('group', (ctx) => {
  const p = new Path2D();
  const r = 30;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 6;
    const x = C + Math.cos(a) * r, y = C + Math.sin(a) * r;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  ctx.fill(p);
});

// --- event category glyphs ------------------------------------------------------------------
// Each is a small badge: a rounded diamond background with a simple line-drawn symbol inside,
// so the badge alone (before the symbol is even read) still says "this is an event".
function diamondBadge(ctx: CanvasRenderingContext2D) {
  const p = new Path2D();
  const r = 30;
  p.moveTo(C, C - r);
  p.lineTo(C + r, C);
  p.lineTo(C, C + r);
  p.lineTo(C - r, C);
  p.closePath();
  ctx.fill(p);
}

const crossedBlades = (hiltStyle: 'guard' | 'bolt') => (ctx: CanvasRenderingContext2D) => {
  diamondBadge(ctx);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  if (hiltStyle === 'guard') {
    // Two crossed sword blades with a small crossguard — an older-weapons read.
    for (const sign of [1, -1]) {
      ctx.save();
      ctx.translate(C, C);
      ctx.rotate((sign * Math.PI) / 4);
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(0, -17);
      ctx.lineTo(0, 15);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-6, 6);
      ctx.lineTo(6, 6);
      ctx.stroke();
      ctx.restore();
    }
  } else {
    // A sharp angular bolt/impact mark — a modern-conflict read, distinct from the symmetric blades.
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(C - 2, C - 17);
    ctx.lineTo(C - 9, C - 1);
    ctx.lineTo(C + 1, C - 1);
    ctx.lineTo(C - 6, C + 17);
    ctx.lineTo(C + 11, C - 3);
    ctx.lineTo(C + 1, C - 3);
    ctx.lineTo(C + 7, C - 17);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  }
  ctx.restore();
};

const EVENT_ICON: Record<EventCategory, (ctx: CanvasRenderingContext2D) => void> = {
  battle: crossedBlades('guard'),
  siege: (ctx) => {
    diamondBadge(ctx);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    // Two bold merlons, not three thin ones — three 5px-wide notches collapse into noise once
    // scaled down to real icon size; two wide ones stay a readable "castle top" silhouette.
    const p = new Path2D();
    p.rect(C - 12, C - 2, 24, 18); // tower body
    p.rect(C - 12, C - 11, 10, 9); // left merlon
    p.rect(C + 2, C - 11, 10, 9); // right merlon
    ctx.fill(p);
    ctx.restore();
  },
  accession: (ctx) => {
    diamondBadge(ctx);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const p = new Path2D();
    p.moveTo(C - 13, C + 10);
    p.lineTo(C - 13, C - 2);
    p.lineTo(C - 7, C + 6);
    p.lineTo(C, C - 8);
    p.lineTo(C + 7, C + 6);
    p.lineTo(C + 13, C - 2);
    p.lineTo(C + 13, C + 10);
    p.closePath();
    ctx.fill(p);
    ctx.restore();
  },
  death: (ctx) => {
    diamondBadge(ctx);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const p = new Path2D();
    p.moveTo(C, C - 15);
    p.bezierCurveTo(C + 10, C - 2, C + 9, C + 7, C, C + 15);
    p.bezierCurveTo(C - 9, C + 7, C - 10, C - 2, C, C - 15);
    ctx.fill(p);
    ctx.restore();
  },
  birth: (ctx) => {
    diamondBadge(ctx);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const p = new Path2D();
    p.arc(C, C + 6, 9, Math.PI, 0); // rising sun
    p.closePath();
    ctx.fill(p);
    // Four bold rays, not five thin ones — fewer, thicker strokes hold together at real icon size.
    ctx.lineWidth = 4.5;
    for (const a of [-45, -15, 15, 45]) {
      const rad = (a * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(C + Math.sin(rad) * 12, C + 6 - Math.cos(rad) * 12);
      ctx.lineTo(C + Math.sin(rad) * 18, C + 6 - Math.cos(rad) * 18);
      ctx.stroke();
    }
    ctx.restore();
  },
  founding: (ctx) => {
    diamondBadge(ctx);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(C - 10, C + 16);
    ctx.lineTo(C - 10, C - 16);
    ctx.stroke();
    const p = new Path2D();
    p.moveTo(C - 10, C - 16);
    p.lineTo(C + 11, C - 10);
    p.lineTo(C - 10, C - 2);
    p.closePath();
    ctx.fill(p);
    ctx.restore();
  },
  construction: (ctx) => {
    diamondBadge(ctx);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const p = new Path2D();
    p.moveTo(C, C - 17);
    p.lineTo(C + 16, C - 4);
    p.lineTo(C - 16, C - 4);
    p.closePath(); // roof
    p.rect(C - 12, C - 2, 5, 15);
    p.rect(C - 2.5, C - 2, 5, 15);
    p.rect(C + 7, C - 2, 5, 15); // columns
    ctx.fill(p);
    ctx.restore();
  },
  treaty: (ctx) => {
    diamondBadge(ctx);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    // Two thin overlapping ring outlines used to go here — at real icon size the two close,
    // fine strokes blurred into a scribble instead of reading as "linked rings". A single thick
    // stroke per ring, pulled further apart so the outlines don't crowd each other, survives
    // being scaled down to ~16px.
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(C - 8, C, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(C + 8, C, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },
  religious: (ctx) => {
    diamondBadge(ctx);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    // Four larger petals, not six small ones — six tight ellipses merged into a smudge once
    // scaled down; four bigger ones keep a clean "flower" silhouette at real icon size.
    const p = new Path2D();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const cx = C + Math.cos(a) * 9, cy = C + Math.sin(a) * 9;
      p.moveTo(cx + 8, cy);
      p.ellipse(cx, cy, 8, 5, a, 0, Math.PI * 2);
    }
    ctx.fill(p);
    ctx.beginPath();
    ctx.arc(C, C, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  journey: (ctx) => {
    diamondBadge(ctx);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(C - 13, C + 13);
    ctx.bezierCurveTo(C - 4, C + 13, C - 4, C - 5, C + 2, C - 5);
    ctx.bezierCurveTo(C + 8, C - 5, C + 7, C - 13, C + 13, C - 13);
    ctx.stroke();
    const p = new Path2D();
    p.moveTo(C + 7, C - 17);
    p.lineTo(C + 17, C - 13);
    p.lineTo(C + 7, C - 9);
    p.closePath();
    ctx.fill(p);
    ctx.restore();
  },
  political: (ctx) => {
    diamondBadge(ctx);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const p = new Path2D();
    p.rect(C - 11, C - 13, 22, 26);
    ctx.fill(p);
    ctx.globalCompositeOperation = 'source-over';
    // Two bold lines, not three thin ones — a third close line was the part that smeared at
    // real icon size; two thicker ones still read as "document" without the noise.
    ctx.lineWidth = 4;
    for (const y of [-4, 4]) {
      ctx.beginPath();
      ctx.moveTo(C - 6, C + y);
      ctx.lineTo(C + 6, C + y);
      ctx.stroke();
    }
    ctx.restore();
  },
  protest: (ctx) => {
    diamondBadge(ctx);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const p = new Path2D();
    p.arc(C, C - 4, 9, 0, Math.PI * 2); // fist
    p.rect(C - 4, C + 2, 8, 15); // forearm
    ctx.fill(p);
    ctx.restore();
  },
  independence: (ctx) => {
    diamondBadge(ctx);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const p = new Path2D();
    const spikes = 8, rOut = 15, rIn = 6;
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i * Math.PI) / spikes - Math.PI / 2;
      const r = i % 2 === 0 ? rOut : rIn;
      const x = C + Math.cos(a) * r, y = C + Math.sin(a) * r;
      if (i === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    }
    p.closePath();
    ctx.fill(p);
    ctx.restore();
  },
  disaster: (ctx) => {
    diamondBadge(ctx);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(C, C, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(C - 4, C - 13);
    ctx.lineTo(C + 2, C - 2);
    ctx.lineTo(C - 3, C + 1);
    ctx.lineTo(C + 4, C + 13);
    ctx.stroke();
    ctx.restore();
  },
  science: (ctx) => {
    diamondBadge(ctx);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const p = new Path2D();
    p.moveTo(C, C - 17);
    p.bezierCurveTo(C + 9, C - 8, C + 7, C + 6, C + 4, C + 10);
    p.lineTo(C - 4, C + 10);
    p.bezierCurveTo(C - 7, C + 6, C - 9, C - 8, C, C - 17);
    p.closePath(); // nose cone + body
    p.moveTo(C - 4, C + 6);
    p.lineTo(C - 11, C + 15);
    p.lineTo(C - 4, C + 12);
    p.closePath(); // left fin
    p.moveTo(C + 4, C + 6);
    p.lineTo(C + 11, C + 15);
    p.lineTo(C + 4, C + 12);
    p.closePath(); // right fin
    ctx.fill(p);
    ctx.beginPath();
    ctx.arc(C, C - 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
};
// A newer-weapons read for battles dated 1850 or later, so a 20th-century engagement isn't
// shown with crossed medieval blades. Swapped in by iconIdFor() below, never stored on the record.
const BATTLE_MODERN_YEAR = 1850;
const battleModern = crossedBlades('bolt');

const builders: Record<string, () => ImageData> = {};
for (const cat of Object.keys(EVENT_ICON) as EventCategory[]) builders[`event-${cat}`] = memo(`event-${cat}`, EVENT_ICON[cat]);
builders['event-battle-modern'] = memo('event-battle-modern', battleModern);
// A bare diamond, no inner glyph, for a marker with no event category (a journey waypoint
// that isn't tied to one specific dated event).
builders['event-plain'] = memo('event-plain', diamondBadge);

/** The icon id to use for an event: its category, with battle split by era. */
export function iconIdFor(category: EventCategory, year: number): string {
  return category === 'battle' && year >= BATTLE_MODERN_YEAR ? 'event-battle-modern' : `event-${category}`;
}

/** Registers every icon this map will need (person + every event badge) on `map`, once. */
export function registerIcons(map: { addImage: (id: string, image: ImageData, opts: { sdf: boolean }) => void; hasImage: (id: string) => boolean }) {
  if (!map.hasImage('person-pin')) map.addImage('person-pin', personGlyph(), { sdf: true });
  if (!map.hasImage('person-pin-female')) map.addImage('person-pin-female', personGlyphFemale(), { sdf: true });
  if (!map.hasImage('person-group')) map.addImage('person-group', groupGlyph(), { sdf: true });
  if (!map.hasImage('capital-flag')) map.addImage('capital-flag', flagGlyph(), { sdf: true });
  for (const [id, build] of Object.entries(builders)) if (!map.hasImage(id)) map.addImage(id, build(), { sdf: true });
}
