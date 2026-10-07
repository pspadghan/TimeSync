// Builds the physical base layer: rivers and lakes from Natural Earth (public domain,
// naturalearthdata.com) and the label fonts. Physical geography only. No political or
// historical boundaries come from here; those are Chronoscope's own sourced records.
// Run: node scripts/build-basemap.mjs
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'scripts', 'raw');
const OUT = path.join(ROOT, 'public', 'data', 'base');
const FONTS = path.join(ROOT, 'public', 'fonts');
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';
const FONT_HOST = 'https://demotiles.maplibre.org/font';
const FONT_STACKS = ['Open Sans Semibold', 'Noto Sans Regular'];
const FONT_RANGES = ['0-255', '256-511', '7680-7935', '8192-8447'];
const MAX_LAKE_RANK = 6;

async function fetched(file, url) {
  try {
    await access(file);
  } catch {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  return file;
}

const round = (v) => Math.round(v * 1000) / 1000;
function slimLine(coords) {
  const out = [];
  for (const [x, y] of coords) {
    const p = [round(x), round(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}
const slim = (geometry) => {
  const map = { LineString: slimLine, MultiLineString: (c) => c.map(slimLine), Polygon: (c) => c.map(slimLine), MultiPolygon: (c) => c.map((p) => p.map(slimLine)) };
  return { type: geometry.type, coordinates: map[geometry.type](geometry.coordinates) };
};

async function layer(name, keep, props) {
  const src = JSON.parse(await readFile(await fetched(path.join(RAW, `${name}.geojson`), `${NE}/${name}.geojson`), 'utf8'));
  const features = src.features.filter((f) => f.geometry && keep(f.properties)).map((f) => ({ type: 'Feature', properties: props(f.properties), geometry: slim(f.geometry) }));
  return { type: 'FeatureCollection', features };
}

await mkdir(OUT, { recursive: true });
const rivers = await layer('ne_10m_rivers_lake_centerlines', () => true, (p) => ({ name: p.name_en || p.name || '', rank: p.scalerank }));
const lakes = await layer('ne_10m_lakes', (p) => p.scalerank <= MAX_LAKE_RANK, (p) => ({ name: p.name_en || p.name || '', rank: p.scalerank }));
await writeFile(path.join(OUT, 'rivers.json'), JSON.stringify(rivers));
await writeFile(path.join(OUT, 'lakes.json'), JSON.stringify(lakes));
console.log(`rivers ${rivers.features.length}, lakes ${lakes.features.length}`);

for (const stack of FONT_STACKS) {
  for (const range of FONT_RANGES) {
    await fetched(path.join(FONTS, stack, `${range}.pbf`), `${FONT_HOST}/${encodeURIComponent(stack)}/${range}.pbf`);
  }
}
console.log('fonts ready');
