// One-time import: more attested places for powers that were thinly covered, so their
// enclosed areas reflect more of the record. Entered from memory and unverified.
// Run once, then: node scripts/assign-colours.mjs && node scripts/verify-coordinates.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'records');
const read = (f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
const write = (f, rows) => writeFileSync(path.join(dir, f), '[\n' + rows.map((r) => '  ' + JSON.stringify(r)).join(',\n') + '\n]\n');
const places = read('places.json');
const claims = read('control.json');
const END = 2011;

const PLACES = [
  ['satara', 'Satara', 74.0, 17.69], ['pune', 'Pune', 73.856, 18.52, ['Poona', 1818, 1947]], ['nagpur', 'Nagpur', 79.09, 21.15], ['indore', 'Indore', 75.86, 22.72],
  ['vadodara', 'Vadodara', 73.18, 22.31, ['Baroda', 1734, 1947]], ['mysore', 'Mysuru', 76.64, 12.3, ['Mysore', 1799, 1947]], ['karachi', 'Karachi', 67.01, 24.86],
  ['amritsar', 'Amritsar', 74.87, 31.63], ['shimla', 'Shimla', 77.17, 31.1, ['Simla', 1864, 1947]], ['jaipur', 'Jaipur', 75.79, 26.92],
  ['kochi', 'Kochi', 76.26, 9.96, ['Cochin', 1503, 1947]], ['tranquebar', 'Tharangambadi', 79.85, 11.03, ['Tranquebar', 1620, 1845]], ['diu', 'Diu', 70.98, 20.71], ['daman', 'Daman', 72.83, 20.41],
  ['thiruvananthapuram', 'Thiruvananthapuram', 76.94, 8.52, ['Trivandrum', 1795, 1949]], ['nagapattinam', 'Nagapattinam', 79.84, 10.77], ['polonnaruwa', 'Polonnaruwa', 81.0, 7.94],
  ['jaunpur', 'Jaunpur', 82.68, 25.75], ['mandu', 'Mandu', 75.4, 22.33], ['penukonda', 'Penukonda', 77.59, 14.08], ['chandragiri', 'Chandragiri', 79.31, 13.58],
];
for (const [id, name, lng, lat, ...names] of PLACES) {
  if (places.some((p) => p.id === id)) continue;
  const row = { id, name, lng, lat, precisionKm: 3, coordStatus: 'unverified', coordSource: 'Entered from memory; not yet checked against a gazetteer or survey sheet.' };
  if (names.length) row.names = names.map(([n, from, to]) => ({ name: n, from, to }));
  places.push(row);
}
const allahabad = places.find((p) => p.id === 'prayagraj');
if (!allahabad.names.some((n) => n.name === 'Allahabad')) allahabad.names.push({ name: 'Allahabad', from: 1765, to: END });

const MARATHA = 'Maratha State', COMPANY = 'English East India Company', RAJ = 'British Raj', INDIA = 'Republic of India', PAKISTAN = 'Pakistan';
const DS = 'Delhi Sultanate', SIKH = 'Sikh Kingdom (Ranjit Singh)', B = ['bandyopadhyay'], G = ['gordon'], PRINCELY = 'A princely state under British paramountcy.';
/** Company, then Crown, then the successor state: the usual sequence for a place annexed in `from`. */
const british = (id, from, successor = INDIA, until = 1947) => [[id, COMPANY, from, 1858, B], [id, RAJ, 1858, until, B], [id, successor, until, END, B]];

const CLAIMS = [
  ['satara', MARATHA, 1708, 1818, G, 'Seat of the Chhatrapati from 1708.'], ['pune', MARATHA, 1720, 1818, G, 'Seat of the Peshwas.'], ...british('pune', 1818),
  ['nagpur', MARATHA, 1743, 1853, G, 'Held by the Bhonsles of Nagpur.'], ...british('nagpur', 1853), ['indore', MARATHA, 1733, 1818, G, 'Held by the Holkars.'],
  ['vadodara', MARATHA, 1734, 1818, G, 'Held by the Gaekwads.'], ['cuttack', MARATHA, 1751, 1803, [...G, 'sarkar-fall']], ...british('cuttack', 1803),
  ...british('agra', 1803), ...british('lucknow', 1856), ['patna', 'Bengal (Nawabs)', 1733, 1765, ['sarkar-fall']], ...british('patna', 1765),
  ['dhaka', 'Bengal (Nawabs)', 1717, 1765, ['sarkar-fall']], ['dhaka', COMPANY, 1765, 1858, B], ['dhaka', RAJ, 1858, 1947, B], ['dhaka', PAKISTAN, 1947, 1971, B], ['dhaka', 'Bangladesh', 1971, END, B],
  ['murshidabad', RAJ, 1858, 1947, B], ['murshidabad', INDIA, 1947, END, B],
  ['prayagraj', 'Awadh', 1765, 1801, ['sarkar-fall']], ...british('prayagraj', 1801), ...british('surat', 1800), ...british('ahmedabad', 1818),
  ['mysore', 'Mysore', 1799, 1947, ['beatson', ...B], PRINCELY], ['mysore', INDIA, 1947, END, B],
  ...british('karachi', 1839, PAKISTAN), ['peshawar', SIKH, 1834, 1849, ['grewal']], ...british('peshawar', 1849, PAKISTAN),
  ['multan', 'Durrani Empire', 1752, 1818, ['sarkar-fall', 'grewal']], ['multan', SIKH, 1818, 1849, ['grewal']], ...british('multan', 1849, PAKISTAN),
  ['srinagar', SIKH, 1819, 1846, ['grewal']], ['srinagar', 'Jammu and Kashmir (Dogra)', 1846, 1947, B, PRINCELY],
  ['amritsar', 'Sikh Misls', 1765, 1802, ['grewal']], ['amritsar', SIKH, 1802, 1849, ['grewal']], ...british('amritsar', 1849),
  ['shimla', RAJ, 1864, 1947, B, 'Summer capital of British India.'], ['shimla', INDIA, 1947, END, B],
  ['jaipur', 'Jaipur (Kachhwaha)', 1727, 1949, ['sarkar-fall', ...B], 'Founded in 1727 as the new Kachhwaha capital.'], ['jaipur', INDIA, 1949, END, B],
  ['kochi', 'Portuguese Estado da Índia', 1503, 1663, ['albuquerque']], ['kochi', 'Dutch East India Company', 1663, 1795, ['kulke']], ['kochi', COMPANY, 1795, 1858, B], ['kochi', RAJ, 1858, 1947, B], ['kochi', INDIA, 1947, END, B],
  ['tranquebar', 'Danish East India Company', 1620, 1845, ['kulke']], ['diu', 'Portuguese Estado da Índia', 1535, 1961, ['firishta', ...B]], ['diu', INDIA, 1961, END, B],
  ['daman', 'Portuguese Estado da Índia', 1559, 1961, B], ['daman', INDIA, 1961, END, B], ['pondicherry', 'French Compagnie des Indes', 1816, 1954, B, 'French India, restored after the Napoleonic wars.'], ['pondicherry', INDIA, 1954, END, B],
  ['thiruvananthapuram', 'Travancore', 1795, 1949, B, PRINCELY], ['thiruvananthapuram', INDIA, 1949, END, B],
  ['guwahati', 'Konbaung Burma', 1821, 1826, ['gait']], ...british('guwahati', 1826),
  ['nagapattinam', 'Chola Empire', 1000, 1279, ['sastri'], 'Approximate dates.'], ['polonnaruwa', 'Chola Empire', 1017, 1070, ['sastri']],
  ['multan', DS, 1228, 1398, ['minhaj', 'barani'], 'Approximate; lost after Timur’s invasion.'], ['jaunpur', DS, 1359, 1394, ['barani', 'kulke']],
  ['jaunpur', 'Jaunpur Sultanate', 1394, 1479, ['kulke'], undefined, true], ['jaunpur', 'Delhi Sultanate (Lodi)', 1479, 1526, ['kulke']],
  ['dhar', 'Malwa Sultanate', 1401, 1531, ['firishta', 'kulke']], ['mandu', 'Malwa Sultanate', 1401, 1531, ['firishta', 'kulke'], undefined, true],
  ['penukonda', 'Vijayanagara', 1565, 1592, ['sastri', 'stein'], 'Capital after the fall of the city of Vijayanagara.', true], ['chandragiri', 'Vijayanagara', 1592, 1646, ['sastri', 'stein'], undefined, true],
  ['kanchipuram', 'Vijayanagara', 1361, 1565, ['sastri'], 'Approximate start.'],
];

const stretch = (placeId, polity, from, patch) => Object.assign(claims.find((c) => c.placeId === placeId && c.polity === polity && c.from === from) ?? (() => { throw new Error(`missing ${placeId} ${polity} ${from}`); })(), patch);
stretch('lucknow', 'Awadh', 1722, { to: 1856 });
stretch('murshidabad', COMPANY, 1765, { to: 1858 });
stretch('srinagar', 'Durrani Empire', 1752, { to: 1819 });
stretch('agra', MARATHA, 1785, { to: 1803 });
stretch('ahmedabad', MARATHA, 1758, { to: 1818 });
stretch('ahmedabad', 'Gujarat Sultanate', 1500, { from: 1411 });
stretch('guwahati', 'Ahom Kingdom', 1682, { to: 1821 });

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
