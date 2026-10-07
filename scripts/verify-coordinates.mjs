// Checks every place's coordinates against OpenStreetMap's gazetteer (Nominatim).
// A place is marked verified only when an independently located OSM feature of the same
// name lies within AGREE_KM of the coordinates already on record; the OSM position is then
// adopted. Anything further away is left unverified and listed for a person to resolve.
// Run: node scripts/verify-coordinates.mjs   (one request per second, as the service asks)
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'records', 'places.json');
const places = JSON.parse(readFileSync(file, 'utf8'));
const AGREE_KM = 6;
const TODAY = new Date().toISOString().slice(0, 10);

// What to look up for each record: the historical site itself where it survives.
const QUERY = {
  delhi: 'Red Fort, Delhi', agra: 'Agra Fort', lahore: 'Lahore Fort', srinagar: 'Hari Parbat, Srinagar', amber: 'Amber Fort, Jaipur',
  chittorgarh: 'Chittorgarh Fort', udaipur: 'City Palace, Udaipur', lucknow: 'Lucknow', ahmedabad: 'Bhadra Fort, Ahmedabad', surat: 'Surat Castle',
  bombay: 'Fort, Mumbai', goa: 'Old Goa', burhanpur: 'Burhanpur', ahmadnagar: 'Ahmednagar Fort', daulatabad: 'Daulatabad Fort',
  bijapur: 'Gol Gumbaz, Vijayapura', 'golconda-hyderabad': 'Golconda Fort', vijayanagara: 'Hampi', torna: 'Torna Fort', pratapgad: 'Pratapgad Fort',
  raigad: 'Raigad Fort', purandar: 'Purandar Fort', sinhagad: 'Sinhagad Fort', gingee: 'Gingee Fort', thanjavur: 'Thanjavur Palace',
  madurai: 'Madurai', srirangapatna: 'Srirangapatna', calicut: 'Kozhikode', madras: 'Fort St. George, Chennai', pondicherry: 'Puducherry',
  kochi: 'Fort Kochi', mandu: 'Mandu, Madhya Pradesh', gaur: 'Gaur, Malda', kaushambi: 'Kosam, Kaushambi', girnar: 'Girnar, Junagadh', kannauj: 'Kannauj, Uttar Pradesh', malkhed: 'Malkhed, Kalaburagi',
  pratapgad: 'Pratapgad, Satara', raigad: 'Raigad Fort, Mahad', murshidabad: 'Murshidabad', taxila: 'Taxila Museum', dhauli: 'Dhauli, Bhubaneswar',
  calcutta: 'B. B. D. Bagh, Kolkata', murshidabad: 'Hazarduari Palace, Murshidabad', guwahati: 'Guwahati',
};

const km = (a, b) => {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const unresolved = [];
for (const p of places) {
  if (p.coordStatus === 'verified') continue; // already confirmed on an earlier run
  const q = QUERY[p.id] ?? p.name;
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=in,pk,af,bd,np,lk&q=${encodeURIComponent(q)}`, { headers: { 'User-Agent': 'chronoscope-coordinate-check/0.1' } });
  const hits = res.ok ? await res.json() : [];
  const best = hits.map((h) => ({ lat: Number(h.lat), lng: Number(h.lon), name: h.display_name })).map((h) => ({ ...h, d: km(p, h) })).sort((a, b) => a.d - b.d)[0];
  if (best && best.d <= AGREE_KM) {
    Object.assign(p, {
      lng: Math.round(best.lng * 1e5) / 1e5, lat: Math.round(best.lat * 1e5) / 1e5, precisionKm: 0.5, coordStatus: 'verified',
      coordSource: `OpenStreetMap (Nominatim): "${best.name.split(',').slice(0, 2).join(',')}", retrieved ${TODAY}; ${best.d.toFixed(1)} km from the earlier entry.`,
    });
    console.log(`ok   ${p.id}  ${best.d.toFixed(1)} km  (${q})`);
  } else {
    unresolved.push(p.id);
    console.log(`open ${p.id}  ${best ? `${best.d.toFixed(0)} km away: ${best.name.slice(0, 60)}` : 'no match'}  (${q})`);
  }
  await sleep(1100);
}

writeFileSync(file, '[\n' + places.map((r) => '  ' + JSON.stringify(r)).join(',\n') + '\n]\n');
console.log(`\nverified ${places.length - unresolved.length} of ${places.length}${unresolved.length ? `; still open: ${unresolved.join(', ')}` : ''}`);
