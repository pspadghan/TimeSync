// Builds the finer and coarser levels of India's present-day administrative hierarchy, to sit
// with the districts from scripts/build-units.mjs:
//   states.json    states and union territories (geoBoundaries gbOpen ADM1)
//   talukas.json   sub-districts: talukas, tehsils, mandals (geoBoundaries gbOpen ADM3)
// Together these give every spot a boundary at three levels. Village boundaries are not
// published as open data and are not included.
// Run: node scripts/build-subunits.mjs
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'scripts', 'raw', 'units');
const OUT = path.join(ROOT, 'public', 'data', 'base');

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
const sources = [];
for (const [level, file] of [['ADM1', 'states.json'], ['ADM3', 'talukas.json']]) {
  const meta = await cached(`IND-gbOpen-${level}.meta.json`, () => get(`https://www.geoboundaries.org/api/current/gbOpen/IND/${level}/`));
  const data = await cached(`IND-gbOpen-${level}.geojson`, () => get(meta.simplifiedGeometryGeoJSON));
  const features = [];
  for (const f of data.features) {
    if (!f.geometry) continue;
    const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)
      .map((poly) => poly.map(slimRing).filter((r) => r.length >= 4))
      .filter((poly) => poly.length);
    if (polys.length) features.push({ type: 'Feature', properties: { name: f.properties.shapeName }, geometry: { type: 'MultiPolygon', coordinates: polys } });
  }
  await writeFile(path.join(OUT, file), JSON.stringify({ type: 'FeatureCollection', features }));
  sources.push({ level, source: meta.boundarySource, licence: meta.boundaryLicense, year: meta.boundaryYearRepresented, count: features.length });
  console.log(level, features.length, `(${meta.boundarySource})`);
}
await writeFile(path.join(OUT, 'subunits.sources.json'), JSON.stringify(sources, null, 2));
