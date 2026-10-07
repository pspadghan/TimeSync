// One-time import: more attested places for the periods before 1526, so less land is
// assigned only by nearness. Entered from memory against standard reference works;
// unverified, and dates before about 600 CE are approximate.
// Run once, then: node scripts/assign-colours.mjs && node scripts/verify-coordinates.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'records');
const read = (f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
const write = (f, rows) => writeFileSync(path.join(dir, f), '[\n' + rows.map((r) => '  ' + JSON.stringify(r)).join(',\n') + '\n]\n');
const places = read('places.json');
const claims = read('control.json');

const PLACES = [
  ['badaun', 'Budaun', 79.12, 28.03, ['Badaun', 1206, 1400]], ['kara', 'Kara', 81.36, 25.7], ['bihar-sharif', 'Bihar Sharif', 85.52, 25.2], ['uch', 'Uch Sharif', 71.07, 29.24, ['Uch', 1228, 1398]],
  ['ranthambore', 'Ranthambore', 76.46, 26.02], ['khambhat', 'Khambhat', 72.62, 22.31, ['Cambay', 1304, 1730]], ['raichur', 'Raichur', 77.36, 16.21], ['udayagiri', 'Udayagiri', 79.27, 14.87],
  ['mamallapuram', 'Mamallapuram', 80.19, 12.62], ['ellora', 'Ellora', 75.18, 20.03], ['aihole', 'Aihole', 75.88, 16.02], ['pattadakal', 'Pattadakal', 75.82, 15.95],
  ['nalanda', 'Nalanda', 85.44, 25.14], ['vikramashila', 'Vikramashila', 87.28, 25.32], ['bagram', 'Bagram', 69.31, 34.99, ['Kapisa', 60, 230]], ['nashik', 'Nashik', 73.79, 20.0],
  ['junnar', 'Junnar', 73.88, 19.21], ['bharuch', 'Bharuch', 72.99, 21.71, ['Bharukaccha', 78, 395]],
];
for (const [id, name, lng, lat, ...names] of PLACES) {
  if (places.some((p) => p.id === id)) continue;
  const row = { id, name, lng, lat, precisionKm: 3, coordStatus: 'unverified', coordSource: 'Entered from memory; not yet checked against a gazetteer or survey sheet.' };
  if (names.length) row.names = names.map(([n, from, to]) => ({ name: n, from, to }));
  places.push(row);
}

const A = 'Approximate dates.';
const DS = 'Delhi Sultanate', VN = 'Vijayanagara', BAH = 'Bahmani Sultanate';
const S = ['singh'], K = ['kulke'], SA = ['sastri'], MB = ['minhaj', 'barani'], F = ['firishta'];
// placeId, holder, from, to, sources, note
const CLAIMS = [
  ['badaun', DS, 1206, 1400, MB, A], ['kara', DS, 1206, 1394, MB, A], ['ayodhya', DS, 1226, 1394, MB, 'Seat of the province of Awadh. Approximate dates.'], ['bihar-sharif', DS, 1206, 1394, MB, A],
  ['gwalior', DS, 1232, 1398, MB], ['gwalior', 'Tomars of Gwalior', 1398, 1518, K], ['gwalior', 'Delhi Sultanate (Lodi)', 1518, 1526, K], ['uch', DS, 1228, 1398, MB, A],
  ['ranthambore', DS, 1301, 1400, ['barani'], 'Taken by Alauddin Khalji in 1301. End date approximate.'], ['mandu', DS, 1305, 1401, ['barani']], ['khambhat', DS, 1304, 1407, ['barani', 'ibn-battuta']],
  ['khambhat', 'Gujarat Sultanate', 1407, 1573, F], ['khambhat', 'Mughal Empire', 1573, 1730, ['akbarnama', 'ain'], A],
  ['goa', VN, 1370, 1472, SA, A], ['goa', BAH, 1472, 1498, F], ['bijapur', BAH, 1347, 1490, F], ['golconda-hyderabad', BAH, 1363, 1518, F],
  ['raichur', VN, 1520, 1565, [...SA, ...F], 'Won at the Battle of Raichur in 1520.'], ['udayagiri', VN, 1514, 1565, SA, 'Taken from the Gajapatis by Krishnadevaraya.'],
  ['mamallapuram', 'Pallava dynasty', 630, 897, SA, A], ['ellora', 'Rashtrakuta dynasty', 757, 973, SA, 'The Kailasa temple was cut under Krishna I.'],
  ['aihole', 'Chalukyas of Badami', 543, 753, SA], ['pattadakal', 'Chalukyas of Badami', 543, 753, SA], ['gwalior', 'Gurjara-Pratihara dynasty', 836, 950, K, 'Attested by an inscription of Mihira Bhoja. Approximate dates.'],
  ['nalanda', 'Gupta Empire', 427, 550, ['xuanzang', ...S], 'The monastery was founded under Kumaragupta I.'], ['nalanda', 'Empire of Harsha', 606, 647, ['xuanzang']], ['nalanda', 'Pala Empire', 750, 1160, [...S, ...K]],
  ['vikramashila', 'Pala Empire', 783, 1160, [...S, ...K], 'Founded by Dharmapala. Approximate start.'], ['sarnath', 'Kushan Empire', 127, 230, S, 'An inscription dated in the third year of Kanishka.'],
  ['sarnath', 'Gupta Empire', 320, 550, S, A], ['vaishali', 'Gupta Empire', 320, 550, S, A], ['kaushambi', 'Kushan Empire', 127, 230, S, A], ['bagram', 'Kushan Empire', 60, 230, S, A],
  ['thanesar', 'Empire of Harsha', 606, 647, ['xuanzang', ...S]], ['prayagraj', 'Empire of Harsha', 606, 647, ['xuanzang'], 'Site of Harsha’s five-yearly assemblies.'],
  ['nashik', 'Satavahana dynasty', 50, 220, S, 'Cave inscriptions of Gautamiputra Satakarni and his line. Approximate dates.'], ['junnar', 'Satavahana dynasty', 50, 220, S, A],
  ['girnar', 'Western Kshatrapas', 100, 395, S, 'Rudradaman’s rock inscription is dated about 150.'], ['bharuch', 'Western Kshatrapas', 78, 395, S, A],
];

const stretch = (placeId, polity, from, patch) => Object.assign(claims.find((c) => c.placeId === placeId && c.polity === polity && c.from === from) ?? (() => { throw new Error(`missing ${placeId} ${polity} ${from}`); })(), patch);
stretch('goa', 'Bijapur (Adil Shahi)', 1500, { from: 1498 });
stretch('bijapur', 'Bijapur (Adil Shahi)', 1500, { from: 1490 });

let added = 0;
for (const [placeId, polity, from, to, sourceIds, note] of CLAIMS) {
  if (claims.some((c) => c.placeId === placeId && c.polity === polity && c.from === from)) continue;
  const row = { placeId, polity, from, to, sourceIds };
  if (note) row.note = note;
  claims.push(row);
  added++;
}
write('places.json', places);
write('control.json', claims);
console.log(`${places.length} places, ${claims.length} claims (${added} added)`);
