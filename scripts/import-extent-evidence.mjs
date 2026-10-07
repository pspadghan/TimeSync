// One-time import: more attested places for three empires, so that the area enclosed by a
// power's recorded places reflects the evidence for its reach.
//   Maurya   find-spots of Ashoka's inscriptions
//   Gupta    find-spots of dated Gupta inscriptions
//   Mughal   seats of the provinces (subahs) listed in the Ain-i-Akbari
// Entered from memory and unverified, like the rest of the records.
// Run once: node scripts/import-extent-evidence.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'records');
const read = (f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
const write = (f, rows) => writeFileSync(path.join(dir, f), '[\n' + rows.map((r) => '  ' + JSON.stringify(r)).join(',\n') + '\n]\n');
const places = read('places.json');
const claims = read('control.json');

const PLACES = [
  ['kandahar', 'Kandahar', 65.71, 31.61], ['shahbazgarhi', 'Shahbazgarhi', 72.16, 34.23], ['mansehra', 'Mansehra', 73.2, 34.33], ['kalsi', 'Kalsi', 77.85, 30.52],
  ['sopara', 'Nala Sopara', 72.8, 19.42, ['Shurparaka', -257, -232]], ['jaugada', 'Jaugada', 84.83, 19.52], ['erragudi', 'Yerragudi', 77.63, 15.21], ['maski', 'Maski', 76.65, 15.96],
  ['brahmagiri', 'Brahmagiri', 76.8, 14.81], ['sannati', 'Sannati', 76.93, 16.83], ['lumbini', 'Lumbini', 83.28, 27.47], ['sarnath', 'Sarnath', 83.02, 25.38],
  ['sanchi', 'Sanchi', 77.74, 23.48], ['lauriya', 'Lauriya Nandangarh', 84.41, 26.99],
  ['eran', 'Eran', 78.17, 24.09, ['Airikina', 360, 510]], ['vidisha', 'Vidisha', 77.81, 23.52], ['mahasthangarh', 'Mahasthangarh', 89.37, 24.96, ['Pundravardhana', 440, 544]], ['ayodhya', 'Ayodhya', 82.2, 26.8, ['Saketa', 320, 550]],
  ['kabul', 'Kabul', 69.17, 34.53], ['multan', 'Multan', 71.47, 30.2], ['thatta', 'Thatta', 67.92, 24.75], ['cuttack', 'Cuttack', 85.88, 20.46],
  ['achalpur', 'Achalpur', 77.51, 21.26, ['Ellichpur', 1596, 1724]], ['dhaka', 'Dhaka', 90.41, 23.71, ['Jahangirnagar', 1610, 1717]],
];
for (const [id, name, lng, lat, ...names] of PLACES) {
  if (places.some((p) => p.id === id)) continue;
  const row = { id, name, lng, lat, precisionKm: 3, coordStatus: 'unverified', coordSource: 'Entered from memory; not yet checked against a gazetteer or survey sheet.' };
  if (names.length) row.names = names.map(([n, from, to]) => ({ name: n, from, to }));
  places.push(row);
}
const prayag = places.find((p) => p.id === 'prayagraj');
if (!prayag.names.some((n) => n.name === 'Ilahabas')) prayag.names.push({ name: 'Ilahabas', from: 1583, to: 1765 });

const EDICT = 'Find-spot of an inscription of Ashoka. Dated to his reign; nothing later is recorded here.';
const GUPTA = 'Find-spot of a dated Gupta inscription.';
const SUBAH = 'Seat of a province listed in the Ain-i-Akbari.';
const MAURYA = 'Maurya Empire', GUPTAS = 'Gupta Empire', MUGHAL = 'Mughal Empire';
const CLAIMS = [
  ...['kandahar', 'shahbazgarhi', 'mansehra', 'kalsi', 'sopara', 'jaugada', 'erragudi', 'maski', 'brahmagiri', 'sannati', 'lumbini', 'sarnath', 'sanchi', 'lauriya'].map((id) => [id, MAURYA, -257, -232, ['ashoka-edicts', 'thapar'], EDICT]),
  ['eran', GUPTAS, 360, 510, ['fleet', 'singh'], GUPTA], ['vidisha', GUPTAS, 401, 500, ['fleet', 'singh'], GUPTA], ['girnar', GUPTAS, 455, 470, ['fleet'], 'Skandagupta’s Junagadh rock inscription.'],
  ['mahasthangarh', GUPTAS, 440, 544, ['fleet', 'singh'], 'Approximate; from copper-plate grants of the region.'], ['ayodhya', GUPTAS, 320, 550, ['singh'], 'Approximate dates.'],
  ['kabul', MUGHAL, 1526, 1738, ['baburnama', 'ain'], SUBAH], ['multan', MUGHAL, 1527, 1752, ['ain', 'richards'], SUBAH], ['thatta', MUGHAL, 1592, 1737, ['ain', 'richards'], SUBAH],
  ['cuttack', MUGHAL, 1592, 1751, ['ain', 'richards'], SUBAH], ['achalpur', MUGHAL, 1596, 1724, ['ain', 'richards'], SUBAH], ['dhaka', MUGHAL, 1610, 1717, ['richards'], 'Seat of the Bengal province from 1610.'],
  ['patna', MUGHAL, 1574, 1733, ['akbarnama', 'ain'], SUBAH], ['prayagraj', MUGHAL, 1583, 1765, ['akbarnama', 'ain'], SUBAH], ['ujjain', MUGHAL, 1562, 1735, ['akbarnama', 'ain'], `${SUBAH} End date approximate.`],
  ['ajmer', MUGHAL, 1558, 1743, ['akbarnama', 'ain'], `${SUBAH} End date approximate.`], ['kandahar', MUGHAL, 1595, 1622, ['akbarnama', 'richards'], 'Lost to the Safavids in 1622.'], ['kandahar', MUGHAL, 1638, 1649, ['lahori', 'richards'], 'Regained in 1638 and lost for good in 1649.'],
  ['madurai', 'Chola Empire', 920, 1216, ['sastri'], 'Approximate; Pandya revivals within this span are not separately entered.'],
];
let added = 0;
for (const [placeId, polity, from, to, sourceIds, note] of CLAIMS) {
  if (claims.some((c) => c.placeId === placeId && c.polity === polity && c.from === from)) continue;
  claims.push({ placeId, polity, from, to, sourceIds, note });
  added++;
}
write('places.json', places);
write('control.json', claims);
console.log(`${places.length} places, ${claims.length} claims (${added} added)`);
