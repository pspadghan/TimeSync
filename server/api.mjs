// Chronoscope's data service. The records are loaded into a SQLite database and every
// answer is computed by a query for the time the client asks about; nothing about a given
// year is precomputed or baked into the front end.
//
//   GET /api/territory?year=1687          who held each attested place in that year, under
//                                         the name it had then
//   GET /api/handovers?from=1680&to=1690  changes of holder in [from, to)
//   GET /api/events?from=&to=             events whose date overlaps [from, to) in milliseconds
//   GET /api/tracks?ms=<timestamp>        where each recorded person is at that moment, from their
//                                         appearances only; interpolated, never invented
//   GET /api/era?year=1687                the conventional period name for that year
//   GET /api/deeptime?ma=65&window=6      stage and world events around a point in deep time
//
// Used as middleware by the Vite dev and preview servers (see vite.config.ts). The JSON files
// under src/data/records are the import format; this database is what gets queried.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RECORDS = path.join(ROOT, 'src', 'data', 'records');
const load = (name) => JSON.parse(readFileSync(path.join(RECORDS, name), 'utf8'));

function build() {
  mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  const db = new DatabaseSync(path.join(ROOT, 'data', 'chronoscope.db'));
  db.exec(`
    DROP TABLE IF EXISTS claim_source; DROP TABLE IF EXISTS claim; DROP TABLE IF EXISTS place_name; DROP TABLE IF EXISTS place;
    DROP TABLE IF EXISTS deep_stage; DROP TABLE IF EXISTS deep_event; DROP TABLE IF EXISTS era; DROP TABLE IF EXISTS appearance; DROP TABLE IF EXISTS event; DROP TABLE IF EXISTS person;
    CREATE TABLE place (id TEXT PRIMARY KEY, name TEXT NOT NULL, lng REAL NOT NULL, lat REAL NOT NULL, precision_km REAL NOT NULL, coord_status TEXT NOT NULL, coord_source TEXT);
    CREATE TABLE place_name (place_id TEXT NOT NULL REFERENCES place(id), name TEXT NOT NULL, year_from INTEGER NOT NULL, year_to INTEGER NOT NULL, note TEXT);
    CREATE TABLE claim (id INTEGER PRIMARY KEY, place_id TEXT NOT NULL REFERENCES place(id), polity TEXT NOT NULL, overlord TEXT, division TEXT, year_from INTEGER NOT NULL, year_to INTEGER NOT NULL, capital INTEGER NOT NULL DEFAULT 0, note TEXT);
    CREATE TABLE claim_source (claim_id INTEGER NOT NULL REFERENCES claim(id), source_id TEXT NOT NULL);
    CREATE TABLE deep_stage (ma_from REAL NOT NULL, ma_to REAL NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL);
    CREATE TABLE deep_event (ma REAL NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL);
    CREATE TABLE era (year_from INTEGER NOT NULL, year_to INTEGER NOT NULL, name TEXT NOT NULL, note TEXT);
    CREATE TABLE event (id TEXT PRIMARY KEY, ms_from REAL NOT NULL, ms_to REAL NOT NULL, data TEXT NOT NULL);
    CREATE INDEX event_span ON event (ms_from, ms_to);
    CREATE TABLE person (id TEXT PRIMARY KEY, uid TEXT NOT NULL, name TEXT NOT NULL, gender TEXT NOT NULL, born INTEGER NOT NULL, died INTEGER NOT NULL);
    -- One row per recorded appearance of a person: an event they were at, or a dated stage of their journey.
    CREATE TABLE appearance (person_id TEXT NOT NULL REFERENCES person(id), ms_from REAL NOT NULL, ms_to REAL NOT NULL, precision TEXT NOT NULL, lng REAL NOT NULL, lat REAL NOT NULL, label TEXT NOT NULL, ref_kind TEXT NOT NULL, ref_id TEXT NOT NULL);
    CREATE INDEX appearance_span ON appearance (person_id, ms_from);
    CREATE INDEX claim_span ON claim (year_from, year_to);
    CREATE INDEX name_span ON place_name (place_id, year_from, year_to);
  `);
  const place = db.prepare('INSERT INTO place VALUES (?, ?, ?, ?, ?, ?, ?)');
  const placeName = db.prepare('INSERT INTO place_name VALUES (?, ?, ?, ?, ?)');
  for (const p of load('places.json')) {
    place.run(p.id, p.name, p.lng, p.lat, p.precisionKm, p.coordStatus, p.coordSource ?? null);
    for (const n of p.names ?? []) placeName.run(p.id, n.name, n.from, n.to, n.note ?? null);
  }
  const claim = db.prepare('INSERT INTO claim (place_id, polity, overlord, division, year_from, year_to, capital, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const claimSource = db.prepare('INSERT INTO claim_source VALUES (?, ?)');
  for (const c of load('control.json')) {
    const { lastInsertRowid } = claim.run(c.placeId, c.polity, c.under ?? null, c.division ?? null, c.from, c.to, c.capital ? 1 : 0, c.note ?? null);
    for (const s of c.sourceIds) claimSource.run(lastInsertRowid, s);
  }
  const deep = load('deeptime.json');
  const stage = db.prepare('INSERT INTO deep_stage VALUES (?, ?, ?, ?)');
  const event = db.prepare('INSERT INTO deep_event VALUES (?, ?, ?)');
  for (const s of deep.stages) stage.run(s.from, s.to, s.title, s.text);
  for (const e of deep.events) event.run(e.ma, e.title, e.text);
  const era = db.prepare('INSERT INTO era VALUES (?, ?, ?, ?)');
  for (const e of load('eras.json')) era.run(e.from, e.to, e.name, e.note || null);
  // People and their appearances.
  const person = db.prepare('INSERT INTO person VALUES (?, ?, ?, ?, ?, ?)');
  const appearance = db.prepare('INSERT INTO appearance VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const people = load('people.json');
  for (const p of people) person.run(p.id, p.uid, p.name, p.gender, p.born, p.died);
  const insertEvent = db.prepare('INSERT INTO event VALUES (?, ?, ?, ?)');
  const eventSpan = new Map(); // id -> { to, lng, lat }, needed below when a journey stage links here
  for (const e of load('events.json')) {
    const [y, m, d, h, mi] = isoParts(e.date);
    const [from, to] =
      e.precision === 'minute' ? [utcMs(y, m, d, h, mi), utcMs(y, m, d, h, mi + 1)]
      : e.precision === 'hour' ? [utcMs(y, m, d, h), utcMs(y, m, d, h + 1)]
      : e.precision === 'day' ? [utcMs(y, m, d), utcMs(y, m, d + 1)]
      : e.precision === 'month' ? [utcMs(y, m, 1), utcMs(y, m + 1, 1)]
      : [utcMs(y, 0, 1), utcMs(y + 1, 0, 1)];
    insertEvent.run(e.id, from, to, JSON.stringify(e));
    eventSpan.set(e.id, { to, lng: e.lng, lat: e.lat });
    for (const id of e.personIds) appearance.run(id, from, to, e.precision, e.lng, e.lat, e.title, 'event', e.id);
  }
  // A journey stage that links to an event is usually AT that event (same spot): skip it, the
  // event's own appearance already covers the moment. But a stage can instead record where the
  // person ENDED UP because of that event — e.g. escaping one city and being next recorded in
  // another hundreds of kilometres away — and dropping that silently erases a real, often
  // dramatic, piece of the journey. Keep any stage whose place differs from its event's.
  const SAME_SPOT_DEG = 0.5; // ~50 km; well past ordinary attested-place imprecision
  for (const p of people) {
    for (const st of p.journey ?? []) {
      const linked = st.eventId ? eventSpan.get(st.eventId) : undefined;
      if (linked && Math.abs(linked.lng - st.lng) < SAME_SPOT_DEG && Math.abs(linked.lat - st.lat) < SAME_SPOT_DEG) continue;
      // Starts right after its event ends (if any), so the two never claim the same instant;
      // otherwise spans the stage's whole named year, same as any other undated stage.
      const from = linked ? linked.to : utcMs(st.year, 0, 1);
      appearance.run(p.id, from, utcMs(st.year + 1, 0, 1), 'year', st.lng, st.lat, `${st.label} · ${st.place}`, 'stage', st.id);
    }
  }
  return db;
}

/** UTC timestamp that also works for years before 100 and before 1 (Date.UTC alone does not). */
function utcMs(y, m, d, h = 0, mi = 0) {
  const dt = new Date(Date.UTC(2000, m, d, h, mi));
  dt.setUTCFullYear(y);
  return dt.getTime();
}
// A date may carry an optional recorded time of day (`T14:30`), used when precision is 'hour' or 'minute'.
function isoParts(iso) {
  const m = /^(-?[0-9]+)-([0-9]+)-([0-9]+)(?:T([0-9]+)(?::([0-9]+))?)?$/.exec(iso);
  const [, y, mo, d, h, mi] = m;
  return [Number(y), Number(mo) - 1, Number(d), h === undefined ? 0 : Number(h), mi === undefined ? 0 : Number(mi)];
}
const DAY = 86400000;
const yearOf = (ms) => new Date(ms).getUTCFullYear();
const km = (a, b) => {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const bearing = (a, b) => {
  const rad = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * rad) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lng - a.lng) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
};
// How far from a recorded appearance a person may be shown, and how long a gap may be bridged.
const LINGER_MS = 90 * DAY;
const BRIDGE_MS = 2 * 365 * DAY;
const FASTEST_KM_PER_DAY = 120;
const MODERN_YEAR = 1900;
const SAME_PLACE_KM = 5;

const CLAIM_COLUMNS = `
  c.id, c.place_id AS placeId, p.name AS place, p.lng, p.lat, p.precision_km AS precisionKm, p.coord_status AS coordStatus,
  c.polity, c.overlord AS under, c.division, c.year_from AS "from", c.year_to AS "to", c.capital, c.note,
  (SELECT group_concat(source_id) FROM claim_source WHERE claim_id = c.id) AS sources`;

export function createApi() {
  const db = build();
  const territory = db.prepare(`
    SELECT ${CLAIM_COLUMNS},
      (SELECT n.name FROM place_name n WHERE n.place_id = c.place_id AND n.year_from <= :year AND :year < n.year_to LIMIT 1) AS nameThen
    FROM claim c JOIN place p ON p.id = c.place_id
    WHERE c.year_from <= :year AND :year < c.year_to
    ORDER BY c.id`);
  // A handover is a claim that starts in the window where the place had a different holder, or none, the year before.
  const handovers = db.prepare(`
    SELECT c.year_from AS year, p.name AS place, p.lng, p.lat, prev.polity AS "from", c.polity AS "to",
      (SELECT count(*) FROM claim_source WHERE claim_id = c.id) AS works
    FROM claim c JOIN place p ON p.id = c.place_id
    LEFT JOIN claim prev ON prev.place_id = c.place_id AND prev.year_to = c.year_from
    WHERE c.year_from >= :from AND c.year_from < :to AND (prev.id IS NULL OR prev.polity <> c.polity)
      AND (prev.id IS NOT NULL OR c.year_from > (SELECT min(year_from) FROM claim))
    ORDER BY c.year_from, p.name`);
  const stages = db.prepare('SELECT ma_from AS "from", ma_to AS "to", title, body AS text FROM deep_stage ORDER BY ma_from DESC');
  const events = db.prepare('SELECT ma, title, body AS text FROM deep_event WHERE abs(ma - :ma) <= :window ORDER BY ma DESC');
  const eraAt = db.prepare('SELECT name, note, year_from AS "from", year_to AS "to" FROM era WHERE year_from <= :year AND :year < year_to');
  const allEvents = db.prepare('SELECT ma, title FROM deep_event ORDER BY ma DESC');

  const lifespan = db.prepare('SELECT id, uid, name, gender, born, died FROM person WHERE born <= :y AND :y <= died');
  const atNow = db.prepare('SELECT * FROM appearance WHERE person_id = :id AND ms_from <= :t AND :t < ms_to ORDER BY abs(:t - ms_from) LIMIT 1');
  const before = db.prepare('SELECT * FROM appearance WHERE person_id = :id AND ms_to <= :t ORDER BY ms_to DESC LIMIT 1');
  const after = db.prepare('SELECT * FROM appearance WHERE person_id = :id AND ms_from > :t ORDER BY ms_from ASC LIMIT 1');
  const pt = (r) => ({ lng: r.lng, lat: r.lat, label: r.label, kind: r.ref_kind, ref: r.ref_id });

  // Where each person is at `t`, from their recorded appearances only. Between two appearances
  // close enough in time the position is interpolated and marked as inferred; otherwise a person
  // is shown only within LINGER_MS of an appearance, never carried across a long silence.
  const tracksAt = (t) => lifespan.all({ y: yearOf(t) }).flatMap((p) => {
    const now = atNow.get({ id: p.id, t });
    const prev = before.get({ id: p.id, t });
    const next = after.get({ id: p.id, t });
    const base = { id: p.id, uid: p.uid, name: p.name, gender: p.gender };
    if (now) {
      const trail = prev && t - prev.ms_to <= BRIDGE_MS ? [pt(prev), pt(now)] : null;
      return [{ ...base, state: 'at', at: pt(now), precision: now.precision, trail }];
    }
    if (prev && next && next.ms_from - prev.ms_to <= BRIDGE_MS) {
      const span = next.ms_from - prev.ms_to;
      const f = (t - prev.ms_to) / span;
      const a = pt(prev), b = pt(next);
      const distance = km(a, b), days = Math.max(1, span / DAY);
      // Two records a few kilometres apart describe one place, not a journey: the person stays put.
      if (distance < SAME_PLACE_KM) return [{ ...base, state: 'after', at: a, precision: prev.precision, trail: null }];
      return [{
        ...base, state: 'between',
        at: { lng: a.lng + (b.lng - a.lng) * f, lat: a.lat + (b.lat - a.lat) * f, label: 'between recorded places' },
        from: a, to: b, heading: Math.round(bearing(a, b)), distanceKm: Math.round(distance), days: Math.round(days),
        implausible: yearOf(t) < MODERN_YEAR && distance / days > FASTEST_KM_PER_DAY,
        trail: [a, b], progress: Math.round(f * 100),
      }];
    }
    if (prev && t - prev.ms_to <= LINGER_MS) return [{ ...base, state: 'after', at: pt(prev), precision: prev.precision, trail: null }];
    if (next && next.ms_from - t <= LINGER_MS) return [{ ...base, state: 'before', at: pt(next), precision: next.precision, trail: null }];
    return [];
  });

  const eventsIn = db.prepare('SELECT data FROM event WHERE ms_from < :to AND ms_to > :from ORDER BY ms_from');

  const routes = {
    '/api/events': (q) => eventsIn.all({ from: Number(q.get('from')), to: Number(q.get('to')) }).map((r) => JSON.parse(r.data)),
    '/api/tracks': (q) => tracksAt(Number(q.get('ms'))),
    '/api/territory': (q) => {
      const year = Number(q.get('year'));
      // No name is shown at all unless a specific period-dated record (place_name, below)
      // actually covers this year — never the place's base/default name as a silent fallback.
      // Most places don't have that coverage yet (only Agra→Akbarabad does so far), so most
      // labels will go blank outside any dated name's range until that's filled in; that is
      // the honest state of the data, not a bug — showing the modern name as if it were
      // attested for every period would be the actual mistake.
      return territory.all({ year }).map(({ sources, capital, nameThen, ...row }) => ({
        ...row, capital: !!capital, sourceIds: sources ? sources.split(',') : [],
        nameThen: nameThen ? (nameThen !== row.place ? `${nameThen} (${row.place})` : nameThen) : null,
      }));
    },
    '/api/era': (q) => eraAt.get({ year: Number(q.get('year')) }) ?? null,
    '/api/handovers': (q) => handovers.all({ from: Number(q.get('from')), to: Number(q.get('to')) }),
    '/api/deeptime': (q) => ({ stages: stages.all(), near: events.all({ ma: Number(q.get('ma')), window: Number(q.get('window') ?? 6) }), marks: allEvents.all() }),
  };

  return (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    const handler = routes[url.pathname];
    if (!handler) return next();
    try {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(handler(url.searchParams)));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(err) }));
    }
  };
}
