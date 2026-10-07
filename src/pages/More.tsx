import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import HistoricalMap from '../components/HistoricalMap';
import { LeftNav, Page } from '../components/Shell';
import { Swatch } from '../components/Territory';
import { consensus, controlClaims, places } from '../data/control';
import { countries } from '../data/countries';
import { events } from '../data/events';
import { colourOf, PALETTE, useGrid, useRegions } from '../data/grid';
import { people } from '../data/people';
import { formatEventDate, MAX_YEAR, MIN_YEAR, parts, yearLabel } from '../data/time';
import { useTime } from '../state/time';

const FIRST = 1500;
const LAST = 1800;
const holderAt = (placeId: string, year: number) => controlClaims.find((c) => c.placeId === placeId && year >= c.from && year < c.to);

function YearInput({ label, value, onChange }: { label: string; value: number; onChange: (y: number) => void }) {
  return (
    <label className="yearinput">
      <span>{label}</span>
      <input type="number" min={MIN_YEAR} max={MAX_YEAR} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <input type="range" min={FIRST} max={LAST} value={Math.min(LAST, Math.max(FIRST, value))} onChange={(e) => onChange(Number(e.target.value))} aria-label={`${label} slider`} />
    </label>
  );
}

/** Two dates side by side, with every recorded change of holder between them. */
export function ComparePage() {
  const { ms } = useTime();
  const { regions } = useRegions();
  const [a, setA] = useState(() => Math.min(LAST - 50, Math.max(FIRST, parts(ms).y)));
  const [b, setB] = useState(() => Math.min(LAST, Math.max(FIRST, parts(ms).y) + 50));
  const [focus, setFocus] = useState<{ lng: number; lat: number; zoom: number; key: string }>();
  const gridA = useGrid(a, regions);
  const gridB = useGrid(b, regions);
  const changes = useMemo(
    () => places
      .map((p) => ({ place: p, before: holderAt(p.id, a), after: holderAt(p.id, b) }))
      .filter((c) => c.before?.polity !== c.after?.polity)
      .sort((x, y) => x.place.name.localeCompare(y.place.name)),
    [a, b],
  );
  const steady = places.filter((p) => holderAt(p.id, a) && holderAt(p.id, a)?.polity === holderAt(p.id, b)?.polity).length;

  return (
    <Page status="Date-to-date comparison · attested places only">
      <div className="subbar">
        <div className="options">
          <YearInput label="Earlier date" value={a} onChange={setA} />
          <YearInput label="Later date" value={b} onChange={setB} />
          <Link className="link" to="/compare/modern">Historical vs modern instead ›</Link>
        </div>
        <p className="dim">{changes.length} places changed holder · {steady} did not</p>
      </div>
      <div className="workspace">
        <LeftNav />
        <div className="compare">
          <HistoricalMap markers={[]} grid={gridA} focus={focus} caption={`Map date ${yearLabel(a)}`}>
            <div className="map__status"><span className="tag">{yearLabel(a)}</span></div>
          </HistoricalMap>
          <HistoricalMap markers={[]} grid={gridB} focus={focus} caption={`Map date ${yearLabel(b)}`}>
            <div className="map__status"><span className="tag">{yearLabel(b)}</span></div>
          </HistoricalMap>
        </div>
        <aside className="side">
          <div className="side__header">
            <p className="eyebrow">What changed</p>
            <h2>{yearLabel(a)} → {yearLabel(b)}</h2>
            <p className="muted">Places whose recorded holder differs between the two dates. Select one to move both maps to it.</p>
          </div>
          {changes.length === 0 && <p className="muted">No recorded change of holder between these dates.</p>}
          {changes.map(({ place, before, after }) => (
            <button key={place.id} type="button" className="card" onClick={() => setFocus({ lng: place.lng, lat: place.lat, zoom: 6, key: `${place.id}-${Date.now()}` })}>
              <strong>{place.name}</strong>
              <span>{before ? <><Swatch k={colourOf(before.under ?? before.polity)} /> {before.polity}</> : 'No holder entered'}</span>
              <span>→ {after ? <><Swatch k={colourOf(after.under ?? after.polity)} /> {after.polity}</> : 'No holder entered'}</span>
              {after && <span className="muted">{consensus(after.sourceIds.length)}</span>}
            </button>
          ))}
        </aside>
      </div>
    </Page>
  );
}

function Frame({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <Page>
      <div className="workspace">
        <LeftNav />
        <main className="directory">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="muted directory__intro">{intro}</p>
          {children}
        </main>
      </div>
    </Page>
  );
}

/** Every power in the records, with the years each of its places was held. */
export function KingdomsPage() {
  const powers = useMemo(() => {
    const by = new Map<string, typeof controlClaims>();
    controlClaims.forEach((c) => by.set(c.polity, [...(by.get(c.polity) ?? []), c]));
    return [...by.entries()]
      .map(([name, claims]) => ({ name, claims, from: Math.min(...claims.map((c) => c.from)), to: Math.max(...claims.map((c) => c.to)) }))
      .sort((x, y) => y.claims.length - x.claims.length || x.from - y.from);
  }, []);
  const pct = (y: number) => `${((Math.min(LAST, Math.max(FIRST, y)) - FIRST) / (LAST - FIRST)) * 100}%`;

  return (
    <Frame eyebrow="Kingdom and timeframe explorer" title="Powers on record, 1500–1800" intro="Each bar is one attested place and the years the sources give for it. A power’s extent is exactly what is listed here, nothing more.">
      <div className="kingdoms">
        <div className="kingdoms__axis">{[1500, 1550, 1600, 1650, 1700, 1750, 1800].map((y) => <span key={y} style={{ left: pct(y) }}>{y}</span>)}</div>
        {powers.map((p) => (
          <section key={p.name} className="kingdom">
            <header>
              <Swatch k={colourOf(p.claims[0].under ?? p.name)} />
              <strong>{p.name}</strong>
              <span className="muted">{p.from}–{p.to > LAST ? 'after 1800' : p.to} · {new Set(p.claims.map((c) => c.placeId)).size} places</span>
              <Link className="link" to={`/?power=${encodeURIComponent(p.name)}&year=${Math.max(p.from, FIRST)}`}>Show on map</Link>
            </header>
            {p.claims.map((c) => (
              <div key={`${c.placeId}-${c.from}`} className="kingdom__row" title={`${c.place} · ${c.from}–${c.to > LAST ? 'after 1800' : c.to} · ${consensus(c.sourceIds.length)}`}>
                <span>{c.place}</span>
                <div><i style={{ left: pct(c.from), right: `calc(100% - ${pct(c.to)})`, background: PALETTE[colourOf(c.under ?? c.polity)] }} /></div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Frame>
  );
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get('q') ?? '';
  const needle = q.trim().toLowerCase();
  const hit = (s: string) => needle.length > 0 && s.toLowerCase().includes(needle);
  const year = /^-?\d{1,4}$/.test(needle) ? Number(needle) : null;
  const powers = [...new Set(controlClaims.map((c) => c.polity))];
  const groups = [
    { title: 'People', rows: people.filter((p) => hit(p.name) || p.aliases.some(hit) || hit(p.uid)).map((p) => ({ key: p.id, title: p.name, sub: `${p.uid} · ${p.born}–${p.died} · ${p.role}`, to: `/people/${p.id}` })) },
    { title: 'Events', rows: events.filter((e) => hit(e.title) || hit(e.place) || (year !== null && e.date.startsWith(String(year)))).map((e) => ({ key: e.id, title: e.title, sub: `${formatEventDate(e)} · ${e.place}`, to: `/?event=${e.id}` })) },
    { title: 'Places', rows: places.filter((p) => hit(p.name)).map((p) => ({ key: p.id, title: p.name, sub: `${p.lat.toFixed(3)}°N ${p.lng.toFixed(3)}°E · coordinates ${p.coordStatus}`, to: `/?place=${p.id}` })) },
    { title: 'Countries · present-day names, for finding your way', rows: countries.filter((c) => hit(c.name)).map((c) => ({ key: c.name, title: c.name, sub: 'Move the map here', to: `/?at=${c.lng.toFixed(2)},${c.lat.toFixed(2)},${c.zoom.toFixed(1)}` })) },
    { title: 'Powers', rows: powers.filter(hit).map((name) => ({ key: name, title: name, sub: `${controlClaims.filter((c) => c.polity === name).length} claims on record`, to: `/?power=${encodeURIComponent(name)}` })) },
  ];
  const total = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <Frame eyebrow="Search and date / place jump" title="Find a person, place, event or year" intro="Search covers names, alternate names, IDs and years. A year on its own also offers a jump straight to that date.">
      <form className="searchform" onSubmit={(e) => e.preventDefault()}>
        <input autoFocus value={q} onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })} placeholder="Try “Agra”, “Shivaji”, “India”, “CHR-P-0004” or “1666”" aria-label="Search" />
      </form>
      {year !== null && year >= MIN_YEAR && year <= MAX_YEAR && <button type="button" className="card" onClick={() => navigate(`/?year=${year}`)}><strong>Jump the map to {yearLabel(year)}</strong><span className="muted">Opens Explore with the timeline on this year</span></button>}
      {needle && total === 0 && year === null && <p>Nothing in the records matches “{q}”.</p>}
      {groups.filter((g) => g.rows.length).map((g) => (
        <section key={g.title}>
          <p className="eyebrow eyebrow--bold">{g.title} · {g.rows.length}</p>
          <div className="grid">
            {g.rows.map((r) => <Link key={r.key} className="card" to={r.to}><strong>{r.title}</strong><span className="muted">{r.sub}</span></Link>)}
          </div>
        </section>
      ))}
    </Frame>
  );
}
