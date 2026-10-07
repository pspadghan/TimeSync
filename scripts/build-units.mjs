// Builds the boundary building blocks: present-day district-level units for South Asia, taken
// through geoBoundaries (geoboundaries.org) only from releases that name a government survey or
// statistics office, or a UN agency, as the source. Files compiled from Wikipedia or Wikimedia
// are not used. India comes first, so where files overlap India's official extent stands. Historical territory is drawn
// by assigning these real units to a power for a given year, so every edge on the map is a
// surveyed present-day boundary rather than a freehand line.
// The units are modern. Which power held a unit in a given year comes from Chronoscope's
// own records, never from this file.
// Run: node scripts/build-units.mjs
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'scripts', 'raw', 'units');
const OUT = path.join(ROOT, 'public', 'data', 'base');
// Country, geoBoundaries release, and the administrative level that corresponds to a district.
const SOURCES = [['IND', 'gbOpen', 'ADM2'], ['BGD', 'gbHumanitarian', 'ADM2'], ['NPL', 'gbHumanitarian', 'ADM2'], ['LKA', 'gbAuthoritative', 'ADM2'], ['BTN', 'gbHumanitarian', 'ADM2'], ['PAK', 'gbHumanitarian', 'ADM2'],
  // No government-issued file is published for these two; the sources are named in units.sources.json.
  ['AFG', 'gbOpen', 'ADM2', false], ['MMR', 'gbOpen', 'ADM2', false], ['MDV', 'gbHumanitarian', 'ADM2', false]];

function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);

async function cached(name, load) {
  const file = path.join(RAW, name);
  try {
    await access(file);
  } catch {
    await writeFile(file, Buffer.from(await load()));
  }
  return JSON.parse(await readFile(file, 'utf8'));
}
const get = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.arrayBuffer();
};
const round = (v) => Math.round(v * 1000) / 1000;
function slimRing(ring) {
  const out = [];
  for (const [x, y] of ring) {
    const p = [round(x), round(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}

await mkdir(RAW, { recursive: true });
await mkdir(OUT, { recursive: true });
const features = [];
const sources = [];
for (const [iso, release, level, withParent = true] of SOURCES) {
  const load = async (lvl) => {
    const m = await cached(`${iso}-${release}-${lvl}.meta.json`, () => get(`https://www.geoboundaries.org/api/current/${release}/${iso}/${lvl}/`));
    return [m, await cached(`${iso}-${release}-${lvl}.geojson`, () => get(m.simplifiedGeometryGeoJSON))];
  };
  const [meta, data] = await load(level);
  // The parent state or province of each district, found by locating a point of the district inside it.
  const [, parents] = withParent ? await load('ADM1') : [null, { features: [] }];
  const stateOf = ([x, y]) => parents.features.find((p) => p.geometry && polysOf(p.geometry).some((poly) => inRing(poly[0], x, y)))?.properties.shapeName ?? '';
  sources.push({ country: iso, source: meta.boundarySource, licence: meta.boundaryLicense, year: meta.boundaryYearRepresented });
  for (const f of data.features) {
    if (!f.geometry) continue;
    const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)
      .map((poly) => poly.map(slimRing).filter((r) => r.length >= 4))
      .filter((poly) => poly.length);
    if (!polys.length) continue;
    const ring = polys[0][0];
    const mid = [0, 1].map((k) => ring.reduce((sum, p) => sum + p[k], 0) / ring.length);
    features.push({ type: 'Feature', properties: { id: features.length + 1, name: f.properties.shapeName, country: iso, state: stateOf(mid) || stateOf(ring[0]) }, geometry: { type: 'MultiPolygon', coordinates: polys } });
  }
  console.log(iso, level, data.features.length, `(${meta.boundarySource})`);
}
await writeFile(path.join(OUT, 'units.json'), JSON.stringify({ type: 'FeatureCollection', features }));
await writeFile(path.join(OUT, 'units.sources.json'), JSON.stringify(sources, null, 2));
console.log(`${features.length} units`);
