// One-time import: records which internal division of a power each attested place belonged
// to (a Mughal subah, a presidency or province of British India). A division is just another
// field on a claim, so any power in any period can be given divisions the same way.
// Names are the longest-used form; boundary reorganisations inside a span are not yet split
// out (for example Bihar and Orissa leaving Bengal in 1912, or Sind leaving Bombay in 1936).
// Entered from memory and unverified. Run once: node scripts/import-divisions.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'records', 'control.json');
const claims = JSON.parse(readFileSync(file, 'utf8'));

const subah = (name) => `Subah of ${name}`;
const DIVISIONS = {
  'Mughal Empire': {
    kabul: subah('Kabul'), lahore: subah('Lahore'), multan: subah('Multan'), delhi: subah('Delhi'), agra: subah('Agra'), lucknow: subah('Awadh'),
    prayagraj: subah('Allahabad'), patna: subah('Bihar'), dhaka: subah('Bengal'), ujjain: subah('Malwa'), ajmer: subah('Ajmer'), chittorgarh: subah('Ajmer'),
    ahmedabad: subah('Gujarat'), surat: subah('Gujarat'), burhanpur: subah('Khandesh'), achalpur: subah('Berar'), ahmadnagar: subah('Ahmadnagar'),
    daulatabad: subah('Aurangabad'), thatta: subah('Thatta'), srinagar: subah('Kashmir'), cuttack: subah('Orissa'), bijapur: subah('Bijapur'),
    'golconda-hyderabad': subah('Hyderabad'), kandahar: subah('Kandahar'),
  },
  'British Raj': {
    calcutta: 'Bengal Presidency', murshidabad: 'Bengal Presidency', patna: 'Bengal Presidency', cuttack: 'Bengal Presidency', dhaka: 'Bengal Presidency',
    bombay: 'Bombay Presidency', pune: 'Bombay Presidency', surat: 'Bombay Presidency', ahmedabad: 'Bombay Presidency', karachi: 'Bombay Presidency',
    madras: 'Madras Presidency', kochi: 'Madras Presidency', lahore: 'Punjab', amritsar: 'Punjab', multan: 'Punjab', shimla: 'Punjab', delhi: 'Delhi',
    agra: 'United Provinces', lucknow: 'United Provinces', prayagraj: 'United Provinces', nagpur: 'Central Provinces', guwahati: 'Assam', peshawar: 'North-West Frontier',
  },
};

let set = 0;
for (const c of claims) {
  const division = DIVISIONS[c.polity]?.[c.placeId];
  if (division && c.division !== division) { c.division = division; set++; }
}
writeFileSync(file, '[\n' + claims.map((r) => '  ' + JSON.stringify(r)).join(',\n') + '\n]\n');
console.log(`${set} claims given a division`);
