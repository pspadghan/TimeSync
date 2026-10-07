// One-time import: more attested places for the dynasties of 150 BCE – 1200 CE, each tied to a
// real site (temple, fort, inscription site or capital), so fewer districts are assigned only
// by nearness. Entered from memory against standard reference works; unverified, and dates
// are approximate throughout. Run once, then:
//   node scripts/assign-colours.mjs && node scripts/verify-coordinates.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'records');
const read = (f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
const write = (f, rows) => writeFileSync(path.join(dir, f), '[\n' + rows.map((r) => '  ' + JSON.stringify(r)).join(',\n') + '\n]\n');
const places = read('places.json');
const claims = read('control.json');

const PLACES = [
  ['kumbakonam', 'Kumbakonam', 79.38, 10.96], ['chidambaram', 'Chidambaram', 79.69, 11.4], ['kolar', 'Kolar', 78.13, 13.14], ['paharpur', 'Paharpur', 88.97, 25.03, ['Somapura', 770, 1100]],
  ['lakkundi', 'Lakkundi', 75.73, 15.39], ['belur', 'Belur', 75.86, 13.16, ['Velapura', 1100, 1342]], ['somanathapura', 'Somanathapura', 76.88, 12.27], ['palampet', 'Palampet', 79.93, 18.25],
  ['kalinjar', 'Kalinjar', 80.48, 25.0], ['mahoba', 'Mahoba', 79.87, 25.29, ['Mahotsavanagara', 830, 1182]], ['modhera', 'Modhera', 72.13, 23.58], ['somnath', 'Somnath', 70.4, 20.89, ['Prabhas Patan', 400, 1300]],
  ['nabadwip', 'Nabadwip', 88.37, 23.4, ['Navadvipa', 1100, 1500]], ['sialkot', 'Sialkot', 74.53, 32.5, ['Sakala', -200, 500]], ['ramtek', 'Ramtek', 79.33, 21.4], ['tezpur', 'Tezpur', 92.8, 26.63, ['Haruppeswara', 700, 1100]],
  ['vijayawada', 'Vijayawada', 80.65, 16.52], ['puri', 'Puri', 85.83, 19.81], ['konark', 'Konark', 86.1, 19.89],
];
for (const [id, name, lng, lat, ...names] of PLACES) {
  if (places.some((p) => p.id === id)) continue;
  const row = { id, name, lng, lat, precisionKm: 3, coordStatus: 'unverified', coordSource: 'Entered from memory; not yet checked against a gazetteer or survey sheet.' };
  if (names.length) row.names = names.map(([n, from, to]) => ({ name: n, from, to }));
  places.push(row);
}

const A = 'Approximate dates.';
const SA = ['sastri'], K = ['kulke'], S = ['singh'], ST = ['singh', 'thapar'];
const CLAIMS = [
  ['kumbakonam', 'Chola Empire', 850, 1279, SA, A], ['chidambaram', 'Chola Empire', 900, 1279, SA, A], ['kolar', 'Western Ganga dynasty', 350, 1000, SA, A], ['kolar', 'Chola Empire', 1000, 1070, SA, A],
  ['nashik', 'Chalukyas of Badami', 610, 753, SA, A], ['nashik', 'Rashtrakuta dynasty', 757, 973, SA, A], ['paharpur', 'Pala Empire', 770, 1160, [...S, ...K], 'The Somapura monastery was founded under Dharmapala.'],
  ['bhagalpur', 'Pala Empire', 750, 1160, [...S, ...K], A], ['mathura', 'Gurjara-Pratihara dynasty', 816, 1018, K, A], ['ujjain', 'Gurjara-Pratihara dynasty', 836, 950, K, A], ['ujjain', 'Paramara dynasty', 1000, 1235, K, A],
  ['ujjain', 'Delhi Sultanate', 1235, 1401, MB(), 'Taken by Iltutmish in 1235. End date approximate.'], ['ujjain', 'Malwa Sultanate', 1401, 1531, ['firishta', 'kulke'], A],
  ['lakkundi', 'Western Chalukyas', 1042, 1189, SA, A], ['kolhapur', 'Western Chalukyas', 1042, 1189, SA, A], ['belur', 'Hoysala dynasty', 1100, 1342, SA, A], ['somanathapura', 'Hoysala dynasty', 1100, 1343, SA, A],
  ['palampet', 'Kakatiya dynasty', 1195, 1323, SA, A], ['kalinjar', 'Chandela dynasty', 900, 1203, K, A], ['mahoba', 'Chandela dynasty', 900, 1182, K, A],
  ['modhera', 'Chaulukya (Solanki) dynasty', 1026, 1244, K, 'The Sun Temple was built about 1026.'], ['somnath', 'Chaulukya (Solanki) dynasty', 960, 1244, K, A], ['khambhat', 'Chaulukya (Solanki) dynasty', 1000, 1304, K, A],
  ['ranthambore', 'Chahamana (Chauhan) dynasty', 1100, 1301, K, A], ['varanasi', 'Gahadavala dynasty', 1090, 1193, K, A], ['ayodhya', 'Gahadavala dynasty', 1090, 1193, K, A],
  ['nabadwip', 'Sena dynasty', 1160, 1204, ['minhaj', 'kulke'], 'Taken by Bakhtiyar Khalji about 1204.'], ['multan', 'Ghaznavid dynasty', 1010, 1175, K, A], ['peshawar', 'Ghaznavid dynasty', 1001, 1186, K, A],
  ['vidisha', 'Shunga dynasty', -185, -73, ST, A], ['ayodhya', 'Shunga dynasty', -185, -73, ST, 'An inscription of Dhanadeva, a Shunga-era ruler, was found here. Approximate.'],
  ['sialkot', 'Indo-Greek kingdoms', -180, -90, S, 'Sakala, the capital of Menander. Approximate.'], ['kabul', 'Indo-Greek kingdoms', -180, -10, S, A], ['ramtek', 'Vakataka dynasty', 350, 500, S, A],
  ['tezpur', 'Kamarupa', 700, 1100, S, A], ['vijayawada', 'Eastern Chalukyas', 624, 1189, SA, A], ['puri', 'Eastern Ganga dynasty', 1135, 1434, K, A], ['konark', 'Eastern Ganga dynasty', 1238, 1434, K, 'The Sun Temple was built about 1250.'],
  ['puri', 'Gajapati Kingdom', 1434, 1541, K, A],
];
function MB() { return ['minhaj', 'barani']; }

let added = 0;
for (const [placeId, polity, from, to, sourceIds, note] of CLAIMS) {
  if (claims.some((c) => c.placeId === placeId && c.polity === polity && c.from === from)) continue;
  claims.push({ placeId, polity, from, to, sourceIds, note });
  added++;
}
write('places.json', places);
write('control.json', claims);
console.log(`${places.length} places, ${claims.length} claims (${added} added)`);
