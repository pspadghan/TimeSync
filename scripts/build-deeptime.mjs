// Builds the deep-time snapshots: where the continents were, every STEP million years back
// to MAX_MA, from the Müller et al. (2019) global plate model served by the GPlates Web
// Service (gws.gplates.org). Nothing is drawn by hand: coastlines and the path of the Indian
// landmass are both reconstructed by the model.
//
// Output in public/data/deeptime/:
//   <ma>.json   reconstructed coastlines, each tagged with the landmass it belongs to
//   index.json  per snapshot: position of each landmass's reference point, and India's speed
// Run: node scripts/build-deeptime.mjs
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'scripts', 'raw', 'deeptime');
const OUT = path.join(ROOT, 'public', 'data', 'deeptime');
const API = 'https://gws.gplates.org/reconstruct';
const MODEL = 'MULLER2019';
const MAX_MA = 200;
const STEP = 5;
const MIN_EXTENT_DEG = 0.7;

// Present-day points that sit firmly inside each landmass. Reconstructing them tells us
// which of the model's unlabelled coastline polygons belong to which landmass.
const LANDS = {
  india: [[79.1, 21.1], [77.2, 28.6], [80.3, 13.1], [72.9, 19.1], [88.4, 22.6], [75.8, 26.9]],
  madagascar: [[46.8, -19.5]],
  africa: [[20, 5], [30, -20], [0, 20], [35, 0]],
  arabia: [[45, 23]],
  eurasia: [[90, 50], [60, 55], [100, 35], [30, 50], [85, 32]],
  antarctica: [[0, -80], [90, -75], [-90, -80]],
  australia: [[135, -25]],
};
const INDIA_REF = LANDS.india[0];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(name, url) {
  const file = path.join(RAW, name);
  try {
    await access(file);
  } catch {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
    await sleep(300);
  }
  return JSON.parse(await readFile(file, 'utf8'));
}

function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const round = (v) => Math.round(v * 100) / 100;
function slimRing(ring) {
  const out = [];
  for (const [x, y] of ring) {
    const p = [round(x), round(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}
function kmBetween([lng1, lat1], [lng2, lat2]) {
  const rad = Math.PI / 180;
  const h = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

await mkdir(RAW, { recursive: true });
await mkdir(OUT, { recursive: true });
const names = Object.keys(LANDS);
const allPoints = names.flatMap((n) => LANDS[n]);
const index = [];

for (let ma = 0; ma <= MAX_MA; ma += STEP) {
  const coast = await get(`coast-${ma}.json`, `${API}/coastlines/?time=${ma}&model=${MODEL}`);
  const moved = (await get(`points-${ma}.json`, `${API}/reconstruct_points/?points=${allPoints.flat().join(',')}&time=${ma}&model=${MODEL}`)).coordinates;
  const refs = {};
  let k = 0;
  for (const n of names) refs[n] = LANDS[n].map(() => moved[k++]);

  const features = [];
  for (const f of coast.features) {
    const rings = f.geometry.coordinates.map(slimRing).filter((r) => r.length >= 4);
    if (!rings.length) continue;
    const xs = rings[0].map((p) => p[0]), ys = rings[0].map((p) => p[1]);
    const land = names.find((n) => refs[n].some(([x, y]) => inRing(rings[0], x, y))) ?? 'other';
    if (land === 'other' && Math.max(...xs) - Math.min(...xs) < MIN_EXTENT_DEG && Math.max(...ys) - Math.min(...ys) < MIN_EXTENT_DEG) continue;
    features.push({ type: 'Feature', properties: { land }, geometry: { type: 'Polygon', coordinates: rings } });
  }
  await writeFile(path.join(OUT, `${ma}.json`), JSON.stringify({ type: 'FeatureCollection', features }));
  index.push({ ma, refs: Object.fromEntries(names.map((n) => [n, refs[n][0].map(round)])) });
  console.log(ma, features.length, 'india at', refs.india[0].map(round).join(','));
}

// Speed of India's reference point over each step: km per million years equals mm per year.
for (let i = 0; i < index.length; i++) {
  const older = index[i + 1];
  index[i].indiaCmPerYear = older ? Math.round((kmBetween(older.refs.india, index[i].refs.india) / STEP) * 10) / 100 : null;
}
await writeFile(path.join(OUT, 'index.json'), JSON.stringify({ model: 'Müller et al. 2019, via GPlates Web Service', step: STEP, indiaRef: INDIA_REF, snapshots: index }));
console.log('done');
