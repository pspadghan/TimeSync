// One-time import: extends the records from 1500–1800 to the whole span of Indian history,
// from the Indus cities to the present. Every row was entered from memory against standard
// reference works and is unverified: dates before about 600 CE are approximate, coordinates
// are marked unverified until scripts/verify-coordinates.mjs confirms them.
// Run once: node scripts/import-india-timeline.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'records');
const read = (f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
const write = (f, rows) => writeFileSync(path.join(dir, f), '[\n' + rows.map((r) => '  ' + JSON.stringify(r)).join(',\n') + '\n]\n');
const places = read('places.json');
const claims = read('control.json');
const END = 2011;

// id, filing name, lng, lat, [period name, from, to]...
const NEW_PLACES = [
  ['harappa', 'Harappa', 72.868, 30.631], ['mohenjo-daro', 'Mohenjo-daro', 68.136, 27.329], ['dholavira', 'Dholavira', 70.214, 23.886],
  ['lothal', 'Lothal', 72.249, 22.521], ['rakhigarhi', 'Rakhigarhi', 76.114, 29.287], ['kalibangan', 'Kalibangan', 74.13, 29.474],
  ['rajgir', 'Rajgir', 85.42, 25.03, ['Rajagriha', -600, -460]], ['patna', 'Patna', 85.14, 25.61, ['Pataliputra', -460, 550]],
  ['vaishali', 'Vaishali', 85.13, 25.99], ['shravasti', 'Shravasti', 82.05, 27.52], ['kaushambi', 'Kaushambi', 81.39, 25.34],
  ['ujjain', 'Ujjain', 75.78, 23.18, ['Ujjayini', -600, 500]], ['taxila', 'Taxila', 72.8, 33.75, ['Takshashila', -518, 230]],
  ['dhauli', 'Dhauli', 85.84, 20.19, ['Tosali', -261, -185]], ['girnar', 'Girnar', 70.5, 21.52, ['Girinagara', -260, -185]],
  ['paithan', 'Paithan', 75.38, 19.48, ['Pratishthana', -30, 220]], ['amaravati', 'Amaravati', 80.36, 16.57, ['Dhanyakataka', 100, 220]],
  ['mathura', 'Mathura', 77.67, 27.49], ['peshawar', 'Peshawar', 71.58, 34.01, ['Purushapura', 127, 230]],
  ['prayagraj', 'Prayagraj', 81.85, 25.43, ['Prayaga', 335, 550]], ['thanesar', 'Thanesar', 76.83, 29.97, ['Sthanvishvara', 580, 606]],
  ['kannauj', 'Kannauj', 79.92, 27.05, ['Kanyakubja', 606, 1193]], ['kanchipuram', 'Kanchipuram', 79.7, 12.83, ['Kanchi', 275, 1279]],
  ['badami', 'Badami', 75.68, 15.92, ['Vatapi', 543, 753]], ['gangaikondacholapuram', 'Gangaikonda Cholapuram', 79.45, 11.21],
  ['malkhed', 'Malkhed', 77.16, 17.19, ['Manyakheta', 814, 973]], ['basavakalyan', 'Basavakalyan', 76.95, 17.87, ['Kalyani', 1042, 1189]],
  ['halebidu', 'Halebidu', 75.99, 13.21, ['Dvarasamudra', 1060, 1343]], ['warangal', 'Warangal', 79.59, 17.97, ['Orugallu', 1195, 1336]],
  ['gulbarga', 'Kalaburagi', 76.83, 17.33, ['Gulbarga', 1347, 1425]], ['bidar', 'Bidar', 77.52, 17.91],
  ['ajmer', 'Ajmer', 74.64, 26.45, ['Ajayameru', 1113, 1192]], ['patan', 'Patan', 72.12, 23.85, ['Anahilapataka', 940, 1304]],
  ['dhar', 'Dhar', 75.3, 22.6, ['Dhara', 1010, 1305]], ['gaur', 'Gaur', 88.14, 24.87, ['Lakhnauti', 1204, 1342]],
];
for (const [id, name, lng, lat, ...names] of NEW_PLACES) {
  if (places.some((p) => p.id === id)) continue;
  const row = { id, name, lng, lat, precisionKm: 3, coordStatus: 'unverified', coordSource: 'Entered from memory; not yet checked against a gazetteer or survey sheet.' };
  if (names.length) row.names = names.map(([n, from, to]) => ({ name: n, from, to }));
  places.push(row);
}
// Earlier names for places already on record.
const addName = (id, name, from, to) => { const p = places.find((x) => x.id === id); p.names = [{ name, from, to }, ...(p.names ?? []).filter((n) => n.name !== name)]; };
addName('delhi', 'Dehli', 1206, 1648);
addName('daulatabad', 'Devagiri', 1187, 1327);

const A = 'Approximate dates.';
const INDUS = 'Indus (Harappan) Civilization';
const DS = 'Delhi Sultanate';
// placeId, holder, from, to, sources, capital, note
const NEW_CLAIMS = [
  ...['harappa', 'mohenjo-daro', 'dholavira', 'lothal', 'rakhigarhi', 'kalibangan'].map((id) => [id, INDUS, -2600, -1900, ['possehl', 'singh'], false, 'Mature urban phase. A civilization known from excavation, not a state with known rulers; the ancient name of the site is not known.']),
  ['rajgir', 'Magadha', -600, -460, ['singh', 'thapar'], true, A], ['patna', 'Magadha', -460, -322, ['singh', 'thapar'], true, A],
  ['vaishali', 'Vajji confederacy', -600, -468, ['singh', 'thapar'], true, A], ['shravasti', 'Kosala', -600, -460, ['singh', 'thapar'], true, A],
  ['kaushambi', 'Vatsa', -600, -400, ['singh', 'thapar'], true, A], ['ujjain', 'Avanti', -600, -400, ['singh', 'thapar'], true, A],
  ['taxila', 'Achaemenid Empire', -518, -326, ['singh', 'thapar'], false, A],
  ['patna', 'Maurya Empire', -322, -185, ['megasthenes', 'ashoka-edicts', 'thapar'], true], ['taxila', 'Maurya Empire', -317, -185, ['ashoka-edicts', 'thapar']],
  ['ujjain', 'Maurya Empire', -320, -185, ['ashoka-edicts', 'thapar']], ['dhauli', 'Maurya Empire', -261, -185, ['ashoka-edicts'], false, 'Kalinga was conquered in Ashoka’s eighth regnal year, as his Rock Edict XIII records.'],
  ['girnar', 'Maurya Empire', -260, -185, ['ashoka-edicts'], false, 'Site of a set of Ashoka’s rock edicts.'],
  ['patna', 'Shunga dynasty', -185, -73, ['singh', 'thapar'], true, A], ['taxila', 'Indo-Greek kingdoms', -180, -90, ['singh'], false, A],
  ['paithan', 'Satavahana dynasty', -30, 220, ['singh', 'sastri'], true, A], ['amaravati', 'Satavahana dynasty', 100, 220, ['singh', 'sastri'], false, A],
  ['mathura', 'Kushan Empire', 80, 230, ['singh'], false, A], ['peshawar', 'Kushan Empire', 127, 230, ['singh'], true, A], ['taxila', 'Kushan Empire', 60, 230, ['singh'], false, A],
  ['patna', 'Gupta Empire', 320, 550, ['allahabad-pillar', 'singh'], true, A], ['prayagraj', 'Gupta Empire', 335, 550, ['allahabad-pillar', 'singh'], false, 'Samudragupta’s inscription is cut on the pillar here.'],
  ['ujjain', 'Gupta Empire', 400, 500, ['singh'], false, A], ['mathura', 'Gupta Empire', 350, 500, ['singh'], false, A],
  ['thanesar', 'Pushyabhuti dynasty', 580, 606, ['xuanzang', 'singh'], true, A], ['kannauj', 'Empire of Harsha', 606, 647, ['xuanzang', 'singh'], true],
  ['kanchipuram', 'Pallava dynasty', 275, 897, ['sastri'], true, A], ['badami', 'Chalukyas of Badami', 543, 753, ['sastri'], true],
  ['malkhed', 'Rashtrakuta dynasty', 814, 973, ['sastri'], true, A], ['kannauj', 'Gurjara-Pratihara dynasty', 816, 1018, ['singh', 'kulke'], true, A],
  ['thanjavur', 'Chola Empire', 850, 1279, ['sastri'], false, 'Capital until about 1025.'], ['gangaikondacholapuram', 'Chola Empire', 1025, 1279, ['sastri'], true],
  ['kanchipuram', 'Chola Empire', 897, 1279, ['sastri']], ['madurai', 'Pandya dynasty', 1216, 1311, ['sastri'], true],
  ['patan', 'Chaulukya (Solanki) dynasty', 940, 1244, ['kulke'], true, A], ['patan', 'Vaghela dynasty', 1244, 1304, ['kulke'], true],
  ['dhar', 'Paramara dynasty', 1010, 1305, ['kulke'], true, A], ['basavakalyan', 'Western Chalukyas', 1042, 1189, ['sastri'], true, A],
  ['halebidu', 'Hoysala dynasty', 1060, 1343, ['sastri'], true, A], ['daulatabad', 'Yadava dynasty', 1187, 1317, ['sastri', 'firishta'], true],
  ['warangal', 'Kakatiya dynasty', 1195, 1323, ['sastri'], true, A], ['ajmer', 'Chahamana (Chauhan) dynasty', 1113, 1192, ['kulke'], true],
  ['delhi', 'Chahamana (Chauhan) dynasty', 1160, 1192, ['minhaj', 'kulke'], false, A], ['kannauj', 'Gahadavala dynasty', 1090, 1193, ['kulke'], true, A],
  ['lahore', 'Ghaznavid dynasty', 1021, 1186, ['kulke']], ['lahore', 'Ghurid dynasty', 1186, 1206, ['minhaj']],
  ['delhi', 'Ghurid dynasty', 1192, 1206, ['minhaj']], ['ajmer', 'Ghurid dynasty', 1192, 1206, ['minhaj']],
  ['delhi', DS, 1206, 1451, ['minhaj', 'barani', 'ibn-battuta'], true, 'Sacked by Timur in 1398.'], ['delhi', 'Delhi Sultanate (Lodi)', 1451, 1500, ['kulke'], true],
  ['lahore', DS, 1206, 1524, ['minhaj', 'barani']], ['ajmer', DS, 1206, 1400, ['minhaj'], false, A],
  ['gaur', DS, 1204, 1342, ['minhaj'], false, 'Held by governors who were often independent in practice.'], ['gaur', 'Bengal Sultanate', 1342, 1565, ['kulke'], false, A],
  ['patan', DS, 1304, 1407, ['barani'], false, A], ['dhar', DS, 1305, 1401, ['barani'], false, A],
  ['daulatabad', DS, 1317, 1347, ['barani', 'ibn-battuta'], false, 'Muhammad bin Tughluq moved his capital here from 1327 to about 1335.'],
  ['warangal', DS, 1323, 1336, ['barani']], ['madurai', DS, 1311, 1335, ['barani', 'sastri'], false, A], ['madurai', 'Madurai Sultanate', 1335, 1378, ['ibn-battuta', 'sastri'], true],
  ['daulatabad', 'Bahmani Sultanate', 1347, 1500, ['firishta']], ['gulbarga', 'Bahmani Sultanate', 1347, 1425, ['firishta'], true], ['bidar', 'Bahmani Sultanate', 1425, 1527, ['firishta'], true],
  ['vijayanagara', 'Vijayanagara', 1336, 1500, ['stein', 'sastri'], true], ['madurai', 'Vijayanagara', 1378, 1529, ['sastri']],
  ['srinagar', 'Kashmir Sultanate', 1339, 1500, ['kulke'], true],
  // 1800 onward
  ['delhi', 'English East India Company', 1803, 1858, ['bandyopadhyay'], false, 'The Mughal emperor remained in the city as a pensioner until 1857.'],
  ['delhi', 'British Raj', 1858, 1947, ['bandyopadhyay'], false, 'Capital of British India from 1911.'], ['delhi', 'Republic of India', 1947, END, ['bandyopadhyay'], true],
  ['calcutta', 'British Raj', 1858, 1947, ['bandyopadhyay'], false, 'Capital of British India until 1911.'], ['calcutta', 'Republic of India', 1947, END, ['bandyopadhyay']],
  ['bombay', 'British Raj', 1858, 1947, ['bandyopadhyay']], ['bombay', 'Republic of India', 1947, END, ['bandyopadhyay']],
  ['madras', 'British Raj', 1858, 1947, ['bandyopadhyay']], ['madras', 'Republic of India', 1947, END, ['bandyopadhyay']],
  ['lahore', 'Sikh Kingdom (Ranjit Singh)', 1801, 1849, ['grewal'], true], ['lahore', 'English East India Company', 1849, 1858, ['grewal', 'bandyopadhyay']],
  ['lahore', 'British Raj', 1858, 1947, ['bandyopadhyay']], ['lahore', 'Pakistan', 1947, END, ['bandyopadhyay']],
  ['golconda-hyderabad', 'Hyderabad (Nizam)', 1801, 1948, ['bandyopadhyay'], true, 'A princely state under British paramountcy.'], ['golconda-hyderabad', 'Republic of India', 1948, END, ['bandyopadhyay']],
  ['goa', 'Portuguese Estado da Índia', 1801, 1961, ['bandyopadhyay']], ['goa', 'Republic of India', 1961, END, ['bandyopadhyay']],
];

// Stretch three existing claims so they meet the new ones exactly.
const stretch = (placeId, polity, from, patch) => Object.assign(claims.find((c) => c.placeId === placeId && c.polity === polity && c.from === from) ?? (() => { throw new Error(`missing ${placeId} ${polity} ${from}`); })(), patch);
stretch('delhi', 'Mughal Empire', 1555, { to: 1803 });
stretch('calcutta', 'English East India Company', 1757, { to: 1858 });
stretch('bombay', 'English East India Company', 1668, { to: 1858 });
stretch('madras', 'English East India Company', 1749, { to: 1858 });

let added = 0;
for (const [placeId, polity, from, to, sourceIds, capital, note] of NEW_CLAIMS) {
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
