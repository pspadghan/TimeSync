// Builds a shared-arc topology of the present-day districts in units.json. The districts
// themselves stay modern (see build-units.mjs) — this file exists only so the map can trace a
// *smooth* boundary around whichever districts a power holds in a given year, using the real
// surveyed district shapes, instead of approximating the shape with a raster grid of squares.
// Which district belongs to which power at a given year is decided at runtime from Chronoscope's
// own records; this topology never encodes ownership, only geometry.
// Run: node scripts/build-units-topology.mjs
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { topology } from 'topojson-server';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'data', 'base');

const units = JSON.parse(await readFile(path.join(OUT, 'units.json'), 'utf8'));
const topo = topology({ units }, 1e5);
await writeFile(path.join(OUT, 'units-topology.json'), JSON.stringify(topo));
console.log(`${units.features.length} districts -> ${topo.arcs.length} shared arcs`);
