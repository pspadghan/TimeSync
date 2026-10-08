// Checks the territory records before they can reach the map. Fails the build on any error.
// Run: npm run validate
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
const places = JSON.parse(readFileSync(path.join(dir, 'records', 'places.json'), 'utf8'));
const claims = JSON.parse(readFileSync(path.join(dir, 'records', 'control.json'), 'utf8'));
const sourceIds = new Set(JSON.parse(readFileSync(path.join(dir, 'records', 'sources.json'), 'utf8')).map((s) => s.id));

const coloured = new Set(JSON.parse(readFileSync(path.join(dir, 'records', 'powers.json'), 'utf8')).map((p) => p.name));
const errors = [];
const notes = [];
const byId = new Map();

for (const p of places) {
  if (byId.has(p.id)) errors.push(`place "${p.id}" is listed twice`);
  byId.set(p.id, p);
  if (!(p.lng >= -180 && p.lng <= 180 && p.lat >= -90 && p.lat <= 90)) errors.push(`place "${p.id}" has coordinates outside the globe`);
  if (!(p.precisionKm > 0)) errors.push(`place "${p.id}" does not state how precise its coordinates are`);
  if (!['verified', 'unverified'].includes(p.coordStatus)) errors.push(`place "${p.id}" has no coordinate status`);
  if (p.coordStatus === 'verified' && !p.coordSource) errors.push(`place "${p.id}" is marked verified but names no coordinate source`);
}

const byPlace = new Map();
claims.forEach((c, i) => {
  const at = `claim ${i + 1} (${c.placeId}, ${c.polity}, ${c.from}–${c.to})`;
  if (!byId.has(c.placeId)) errors.push(`${at}: unknown place`);
  if (!(Number.isInteger(c.from) && Number.isInteger(c.to) && c.from < c.to)) errors.push(`${at}: years must be whole numbers with from before to`);
  if (!c.polity?.trim()) errors.push(`${at}: no holder named`);
  else if (!coloured.has(c.polity)) errors.push(`${at}: "${c.polity}" has no colour; run node scripts/assign-colours.mjs`);
  if (!c.sourceIds?.length) errors.push(`${at}: no supporting work`);
  for (const s of c.sourceIds ?? []) if (!sourceIds.has(s)) errors.push(`${at}: unknown source "${s}"`);
  if (new Set(c.sourceIds).size !== c.sourceIds.length) errors.push(`${at}: the same work is counted twice`);
  byPlace.set(c.placeId, [...(byPlace.get(c.placeId) ?? []), c]);
});

// One place cannot have two holders in the same year. Disagreement between sources has to be
// recorded as a dispute, not as two overlapping claims that the map would resolve silently.
for (const [placeId, list] of byPlace) {
  list.sort((a, b) => a.from - b.from);
  for (let i = 1; i < list.length; i++) {
    if (list[i].from < list[i - 1].to) errors.push(`${placeId}: ${list[i - 1].polity} (${list[i - 1].from}–${list[i - 1].to}) overlaps ${list[i].polity} (${list[i].from}–${list[i].to})`);
    else if (list[i].from > list[i - 1].to) notes.push(`${placeId}: no holder entered for ${list[i - 1].to}–${list[i].from}`);
  }
}
for (const p of places) if (!byPlace.has(p.id)) notes.push(`place "${p.id}" has no claim`);

// A person's position at a moment is read off a single nearest record (server/api.mjs
// tracksAt). Two day-precision events that put the same person in two places on the same
// calendar day would make that pick silently arbitrary, so it is surfaced here instead.
const events = JSON.parse(readFileSync(path.join(dir, 'records', 'events.json'), 'utf8'));
const people = JSON.parse(readFileSync(path.join(dir, 'records', 'people.json'), 'utf8'));
const personIds = new Set(people.map((p) => p.id));

const seenPersonId = new Set();
const seenUid = new Set();
for (const p of people) {
  if (seenPersonId.has(p.id)) errors.push(`person "${p.id}" is listed twice — give the second one a distinct id, and a namesakes entry on both if they share a name`);
  seenPersonId.add(p.id);
  if (seenUid.has(p.uid)) errors.push(`person "${p.id}": uid "${p.uid}" is already used by another person — uids must never be reused`);
  seenUid.add(p.uid);
}

for (const p of people) {
  for (const r of p.relationships ?? []) {
    const at = `${p.id} relationship -> ${r.personId}`;
    if (!personIds.has(r.personId)) errors.push(`${at}: unknown person`);
    if (r.personId === p.id) errors.push(`${at}: a person cannot be related to themself`);
    if (!r.sourceIds?.length) errors.push(`${at}: no supporting work`);
    for (const s of r.sourceIds ?? []) if (!sourceIds.has(s)) errors.push(`${at}: unknown source "${s}"`);
  }
}

// Event-table structural checks: catches the exact mistake made this session (independently
// researching and adding an event that already existed under a different id). An id collision
// can't happen in a JSON array — this instead catches same-moment duplicates at the content
// level, which is the actual failure mode: two different ids for the same real-world event.
const seenEventId = new Set();
const byDate = new Map();
for (const e of events) {
  if (seenEventId.has(e.id)) errors.push(`event "${e.id}" is listed twice`);
  seenEventId.add(e.id);
  for (const id of e.personIds ?? []) if (!personIds.has(id)) errors.push(`event "${e.id}": unknown person "${id}"`);
  for (const s of e.sourceIds ?? []) if (!sourceIds.has(s)) errors.push(`event "${e.id}": unknown source "${s}"`);
  if (!e.sourceIds?.length) errors.push(`event "${e.id}": no supporting work`);
  byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
}
// Grouping by a rounded coordinate string missed a real duplicate once already (two points a
// few km apart straddled a rounding boundary): measure actual distance instead, so no boundary
// can hide a match. Two events on the same day within ~25km are almost certainly one real-world
// moment described twice, not two coincidentally nearby happenings.
const DUPLICATE_KM = 25;
const haversineKm = (a, b) => {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
for (const [date, list] of byDate) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const km = haversineKm(list[i], list[j]);
      if (km < DUPLICATE_KM) errors.push(`duplicate event: "${list[i].id}" and "${list[j].id}" are both dated ${date}, ${km.toFixed(0)}km apart — merge them into one event and point every person at it`);
    }
  }
}

const byPerson = new Map();
for (const e of events) {
  if (e.precision !== 'day') continue;
  for (const id of e.personIds) byPerson.set(id, [...(byPerson.get(id) ?? []), e]);
}
for (const p of people) {
  for (const s of p.journey ?? []) {
    if (!s.eventId) byPerson.set(p.id, [...(byPerson.get(p.id) ?? []), { date: `${s.year}-01-01`, title: s.label, precision: 'year' }]);
  }
}
for (const [personId, list] of byPerson) {
  const byDay = new Map();
  for (const e of list) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e.title]);
  for (const [date, titles] of byDay) {
    if (titles.length > 1) notes.push(`${personId}: ${titles.length} records place them on ${date} (${titles.join(' / ')}) — the one shown as "current" will be picked arbitrarily unless this is meant as one shared moment`);
  }
}

const count = (n) => claims.filter((c) => c.sourceIds.length === n || (n === 5 && c.sourceIds.length > 5)).length;
console.log(`${places.length} places, ${claims.length} claims, ${new Set(claims.map((c) => c.polity)).size} powers`);
console.log(`coordinates verified: ${places.filter((p) => p.coordStatus === 'verified').length} of ${places.length}`);
console.log(`claims by supporting works: 1 → ${count(1)}, 2 → ${count(2)}, 3 → ${count(3)}, 4 → ${count(4)}, 5+ (settled) → ${count(5)}`);
if (notes.length) console.log(`\nGaps (${notes.length}):\n  ${notes.join('\n  ')}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log('\nRecords are consistent.');
