// Builds the settlement base layer for South Asia from the GeoNames gazetteer
// (geonames.org, CC BY 4.0): every populated place GeoNames lists with 500 or more people.
// These are present-day places under present-day names, shown for orientation. They carry
// no historical claim: who held the ground a settlement stands on in a given year is read
// from Chronoscope's own territory records.
// Expects scripts/raw/cities500.txt (unzipped from download.geonames.org/export/dump/cities500.zip).
// Run: node scripts/build-settlements.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COUNTRIES = new Set(['IN', 'PK', 'BD', 'NP', 'LK', 'BT', 'AF']);
const [NAME, LAT, LNG, COUNTRY, POPULATION] = [1, 4, 5, 8, 14];

const features = readFileSync(path.join(ROOT, 'scripts', 'raw', 'cities500.txt'), 'utf8')
  .split('\n')
  .map((line) => line.split('\t'))
  .filter((row) => COUNTRIES.has(row[COUNTRY]))
  .map((row) => ({
    type: 'Feature',
    properties: { name: row[NAME], pop: Number(row[POPULATION]) || 0 },
    geometry: { type: 'Point', coordinates: [Math.round(Number(row[LNG]) * 1e4) / 1e4, Math.round(Number(row[LAT]) * 1e4) / 1e4] },
  }))
  .sort((a, b) => b.properties.pop - a.properties.pop); // larger places win label collisions

mkdirSync(path.join(ROOT, 'public', 'data', 'base'), { recursive: true });
writeFileSync(path.join(ROOT, 'public', 'data', 'base', 'settlements.json'), JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`${features.length} settlements`);
