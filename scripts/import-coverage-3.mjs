// One-time import: fills thinly covered stretches of the timeline, working back from the
// princely states to the first farming villages. Entered from memory against standard
// reference works; unverified, and dates before about 600 CE are approximate.
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
  ['mehrgarh', 'Mehrgarh', 67.61, 29.39], ['kot-diji', 'Kot Diji', 68.67, 27.35], ['hastinapur', 'Hastinapur', 78.02, 29.16], ['ahichchhatra', 'Ahichchhatra', 79.13, 28.37],
  ['adichanallur', 'Adichanallur', 77.88, 8.63], ['varanasi', 'Varanasi', 83.01, 25.32, ['Kashi', -600, 1200]], ['bhagalpur', 'Bhagalpur', 86.98, 25.24, ['Champa', -600, -400]],
  ['kushinagar', 'Kushinagar', 83.89, 26.74, ['Kusinara', -600, -400]], ['bairat', 'Bairat', 76.18, 27.45, ['Viratanagara', -600, -400]], ['bodhan', 'Bodhan', 77.88, 18.67, ['Potana', -600, -400]],
  ['karur', 'Karur', 78.08, 10.96, ['Vanji', -300, 300]], ['uraiyur', 'Uraiyur', 78.68, 10.83], ['sisupalgarh', 'Sisupalgarh', 85.85, 20.23, ['Kalinganagari', -150, -50]],
  ['nagardhan', 'Nagardhan', 79.36, 21.34, ['Nandivardhana', 250, 500]], ['banavasi', 'Banavasi', 75.02, 14.53], ['talakad', 'Talakadu', 77.03, 12.19, ['Talakad', 350, 1000]],
  ['valabhi', 'Vallabhipur', 71.88, 21.89, ['Valabhi', 475, 776]], ['munger', 'Munger', 86.47, 25.38, ['Mudgagiri', 750, 1160]], ['hund', 'Hund', 72.43, 34.02, ['Udabhandapura', 870, 1026]],
  ['khajuraho', 'Khajuraho', 79.92, 24.85], ['jabalpur', 'Jabalpur', 79.94, 23.17, ['Tripuri', 675, 1212]], ['rajahmundry', 'Rajamahendravaram', 81.8, 17.0, ['Vengi', 624, 1189]],
  ['mansura', 'Mansura', 68.77, 25.88], ['ghazni', 'Ghazni', 68.42, 33.55, ['Ghazna', 977, 1215]], ['anuradhapura', 'Anuradhapura', 80.4, 8.35], ['kandy', 'Kandy', 80.64, 7.29, ['Senkadagala', 1469, 1815]],
  ['colombo', 'Colombo', 79.86, 6.93], ['jodhpur', 'Jodhpur', 73.02, 26.29], ['bikaner', 'Bikaner', 73.31, 28.02], ['imphal', 'Imphal', 93.94, 24.82, ['Kangla', 1467, 1891]],
  ['gangtok', 'Gangtok', 88.61, 27.33], ['gwalior', 'Gwalior', 78.18, 26.22], ['bhopal', 'Bhopal', 77.41, 23.26], ['kolhapur', 'Kolhapur', 74.24, 16.7], ['patiala', 'Patiala', 76.4, 30.34],
  ['bahawalpur', 'Bahawalpur', 71.68, 29.39], ['kalat', 'Kalat', 66.59, 29.03], ['junagadh', 'Junagadh', 70.46, 21.52], ['bhuj', 'Bhuj', 69.67, 23.25], ['cooch-behar', 'Cooch Behar', 89.44, 26.32],
  ['rewa', 'Rewa', 81.3, 24.53], ['bharatpur', 'Bharatpur', 77.49, 27.22], ['kota', 'Kota', 75.83, 25.18],
];
for (const [id, name, lng, lat, ...names] of PLACES) {
  if (places.some((p) => p.id === id)) continue;
  const row = { id, name, lng, lat, precisionKm: 3, coordStatus: 'unverified', coordSource: 'Entered from memory; not yet checked against a gazetteer or survey sheet.' };
  if (names.length) row.names = names.map(([n, from, to]) => ({ name: n, from, to }));
  places.push(row);
}

const A = 'Approximate dates.';
const S = ['singh'], ST = ['singh', 'thapar'], K = ['kulke'], SA = ['sastri'], B = ['bandyopadhyay'], P = ['possehl', 'singh'];
const CULTURE = 'Known from excavation. A way of life shared by many settlements, not a state with rulers or borders.';
const STATE = 'A princely state under British paramountcy from the early nineteenth century.';
// placeId, holder, from, to, sources, note, capital
const CLAIMS = [
  ['mehrgarh', 'Mehrgarh Neolithic culture', -7000, -2600, P, CULTURE],
  ...['harappa', 'kalibangan', 'rakhigarhi', 'kot-diji'].map((id) => [id, 'Early Harappan culture', -3300, -2600, P, CULTURE]),
  ['kot-diji', 'Indus (Harappan) Civilization', -2600, -1900, P, CULTURE], ...['harappa', 'lothal', 'rakhigarhi'].map((id) => [id, 'Late Harappan culture', -1900, -1300, P, CULTURE]),
  ...['hastinapur', 'ahichchhatra'].map((id) => [id, 'Painted Grey Ware culture', -1200, -600, S, CULTURE]), ['adichanallur', 'Megalithic culture of South India', -1000, -300, [...S, ...SA], CULTURE],
  ['varanasi', 'Kashi', -600, -500, ST, A, true], ['bhagalpur', 'Anga', -600, -500, ST, A, true], ['kushinagar', 'Malla', -600, -400, ST, A, true], ['hastinapur', 'Kuru', -600, -400, ST, A, true],
  ['ahichchhatra', 'Panchala', -600, -400, ST, A, true], ['bairat', 'Matsya', -600, -400, ST, A, true], ['mathura', 'Surasena', -600, -400, ST, A, true], ['bodhan', 'Assaka', -600, -400, ST, A, true],
  ['taxila', 'Gandhara', -600, -518, ST, A, true],
  ['karur', 'Chera kingdom', -300, 300, ['ashoka-edicts', ...SA], 'Named in Ashoka’s edicts as an independent neighbour. Dates approximate.', true], ['uraiyur', 'Early Chola kingdom', -300, 300, ['ashoka-edicts', ...SA], 'Named in Ashoka’s edicts as an independent neighbour. Dates approximate.', true],
  ['madurai', 'Early Pandya kingdom', -300, 300, ['ashoka-edicts', 'megasthenes', ...SA], 'Named in Ashoka’s edicts as an independent neighbour. Dates approximate.', true], ['anuradhapura', 'Anuradhapura Kingdom', -377, 1017, K, A, true],
  ['sisupalgarh', 'Kalinga (Mahameghavahana)', -150, -50, S, 'The kingdom of Kharavela, known from the Hathigumpha inscription. Dates approximate.', true],
  ['ujjain', 'Western Kshatrapas', 100, 395, S, A, true], ['nagardhan', 'Vakataka dynasty', 250, 500, S, A, true], ['banavasi', 'Kadamba dynasty', 345, 540, SA, A, true], ['talakad', 'Western Ganga dynasty', 350, 1000, SA, A, true],
  ['guwahati', 'Kamarupa', 350, 1140, S, A, true], ['valabhi', 'Maitraka dynasty', 475, 776, S, A, true], ['kannauj', 'Maukhari dynasty', 550, 606, S, A, true], ['madurai', 'Pandya dynasty', 590, 920, SA, A, true],
  ['rajahmundry', 'Eastern Chalukyas', 624, 1189, SA, A, true], ['srinagar', 'Kingdom of Kashmir', 625, 1339, ['singh', 'kulke'], 'The Karkota, Utpala and Lohara dynasties in turn.', true], ['jabalpur', 'Kalachuri dynasty', 675, 1212, K, A, true],
  ['mansura', 'Arab emirates of Sindh', 712, 1010, K, 'Conquered for the Umayyad Caliphate in 712; later ruled by local Arab dynasties.', true], ['multan', 'Arab emirates of Sindh', 712, 1010, K, A],
  ['munger', 'Pala Empire', 750, 1160, ['singh', 'kulke'], A], ['gaur', 'Pala Empire', 750, 1160, ['singh', 'kulke'], A], ['gaur', 'Sena dynasty', 1160, 1204, ['minhaj', 'kulke'], undefined, true],
  ['kabul', 'Hindu Shahi dynasty', 850, 870, K, A, true], ['hund', 'Hindu Shahi dynasty', 870, 1026, K, A, true], ['khajuraho', 'Chandela dynasty', 900, 1203, K, A, true],
  ['ghazni', 'Ghaznavid dynasty', 977, 1163, K, undefined, true], ['ghazni', 'Ghurid dynasty', 1173, 1215, ['minhaj'], undefined, true], ['delhi', 'Tomara dynasty', 1052, 1160, K, A, true],
  ['polonnaruwa', 'Polonnaruwa Kingdom', 1070, 1232, K, undefined, true], ['cuttack', 'Eastern Ganga dynasty', 1135, 1434, K, A, true], ['cuttack', 'Gajapati Kingdom', 1434, 1541, K, undefined, true],
  ['chittorgarh', 'Delhi Sultanate', 1303, 1326, ['barani']], ['kandy', 'Kingdom of Kandy', 1469, 1815, K, undefined, true], ['colombo', 'Portuguese Estado da Índia', 1597, 1658, K], ['colombo', 'Dutch East India Company', 1658, 1796, K],
  ['colombo', 'English East India Company', 1796, 1815, K, 'Coastal Ceylon became a Crown colony in 1802.'],
  ['jodhpur', 'Marwar (Rathore)', 1459, 1949, K, STATE, true], ['bikaner', 'Bikaner (Rathore)', 1488, 1949, K, STATE, true], ['imphal', 'Kingdom of Manipur', 1467, 1949, K, 'Approximate start. Under British paramountcy from 1891.', true],
  ['gangtok', 'Kingdom of Sikkim', 1642, 1947, K, 'Founded in 1642; a British protectorate from 1861.'], ['kota', 'Kota (Hada Chauhan)', 1631, 1948, K, STATE, true], ['rewa', 'Rewa (Baghel)', 1617, 1948, K, STATE, true],
  ['kalat', 'Khanate of Kalat', 1666, 1955, K, STATE, true], ['cooch-behar', 'Koch Bihar', 1586, 1949, K, STATE, true], ['bhuj', 'Kingdom of Kutch', 1549, 1948, K, STATE, true],
  ['kolhapur', 'Kolhapur (Bhonsle)', 1710, 1949, ['gordon', ...B], STATE, true], ['bharatpur', 'Bharatpur (Jat)', 1722, 1948, ['sarkar-fall', ...B], STATE, true], ['bhopal', 'Bhopal State (Nawabs)', 1723, 1949, B, STATE, true],
  ['junagadh', 'Junagadh State (Nawabs)', 1730, 1948, B, STATE, true], ['bahawalpur', 'Bahawalpur State (Nawabs)', 1748, 1955, B, STATE, true], ['patiala', 'Patiala (Phulkian)', 1763, 1948, ['grewal', ...B], STATE, true],
  ['gwalior', 'Gwalior (Scindia)', 1810, 1948, ['gordon', ...B], STATE, true], ['indore', 'Indore (Holkar)', 1818, 1948, ['gordon', ...B], STATE, true], ['vadodara', 'Baroda (Gaekwad)', 1818, 1949, ['gordon', ...B], STATE, true],
];

const stretch = (placeId, polity, from, patch) => Object.assign(claims.find((c) => c.placeId === placeId && c.polity === polity && c.from === from) ?? (() => { throw new Error(`missing ${placeId} ${polity} ${from}`); })(), patch);
stretch('chittorgarh', 'Mewar', 1500, { from: 1326 });
stretch('udaipur', 'Mewar', 1559, { to: 1948 });
stretch('amber', 'Amber (Kachhwaha)', 1562, { to: 1727 });

let added = 0;
for (const [placeId, polity, from, to, sourceIds, note, capital] of CLAIMS) {
  if (claims.some((c) => c.placeId === placeId && c.polity === polity && c.from === from)) continue;
  const row = { placeId, polity, from, to, sourceIds };
  if (note) row.note = note;
  if (capital) row.capital = true;
  claims.push(row);
  added++;
}
write('places.json', places);
write('control.json', claims);
console.log(`${places.length} places, ${claims.length} claims (${added} added)`);
