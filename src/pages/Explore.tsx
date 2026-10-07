import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import HistoricalMap, { type MapMarker, type MapView, type Spot } from '../components/HistoricalMap';
import { EVIDENCE_LABEL, EVIDENCE_MEANING, EvidenceLegend, SourceList } from '../components/Evidence';
import { DeepPanel, useDeep } from '../components/Deep';
import { LeftNav, Page } from '../components/Shell';
import { Swatch, TerritoryPanel, type Brush } from '../components/Territory';
import EventProjection from '../components/EventProjection';
import SaveDialog from '../components/SaveDialog';
import TimeWorkspace from '../components/TimeWorkspace';
import { eventById } from '../data/events';
import { brushCells, formatArea, GRADE_LABEL, holderNear, polityAt, unitAt, useGrid, useRegions, useUnits, type MappedRegion, type PolityInfo } from '../data/grid';
import { personById } from '../data/people';
import { compass, describe, personMarkers } from '../data/people-view';
import { useEventsIn, useHandovers, useTracks, type Track } from '../data/api';
import { regionsAt } from '../data/regions';
import { places } from '../data/control';
import { addUnits, CALENDAR_LABEL, eventsChrono, formatDate, formatEventDate, neighbourEvent, parts, startOf, toMs, utc, yearLabel } from '../data/time';
import type { EvidenceState } from '../data/types';
import type { HistEvent } from '../data/types';
import { logActivity } from '../state/recent';
import { useCollapse } from '../state/collapse';
import { useSaved } from '../state/saved';
import { useTime } from '../state/time';

const TERRITORY_ROWS = 8;
const PROBES = 12;
const LOG_LIMIT = 500;
const NO_MARKERS: MapMarker[] = [];
// An event is said to be "at" an attested place only when it lies this close to it.
const SAME_PLACE_KM = 15;

function EventPopup({ e, territory, district, onEvidence, onSave, onProject, saved }: { e: HistEvent; territory?: string; district?: string; onEvidence: () => void; onSave: () => void; onProject: () => void; saved: boolean }) {
  const person = e.personIds.map((id) => personById[id]).find((p) => p);
  return (
    <div className="popup popup--panel">
      <div className="popup__head">
        <span className="eyebrow">Selected event</span>
        <span className="tag tag--gold">{EVIDENCE_LABEL[e.evidence]}</span>
      </div>
      {e.image && <img className="popup__image" src={e.image} alt="" />}
      {e.image && <p className="popup__credit">Illustrative reconstruction, not a historical image.</p>}
      <p className="popup__title">{e.title}</p>
      <p className="muted">{formatEventDate(e)} · {e.place}</p>
      {territory && <p className="muted">Held by: {territory}</p>}
      {district && <p className="muted">Present-day district: {district}</p>}
      <p className="muted popup__summary">{e.summary}</p>
      <div className="popup__meta">
        <span className="accent">{e.importance}</span>
        <span>{EVIDENCE_LABEL[e.evidence]}</span>
      </div>
      <p className="muted">Why this matters: {e.whyItMatters}</p>
      <div className="popup__actions">
        <button type="button" className="tag tag--gold" onClick={onProject}>Project full screen</button>
        <button type="button" className="tag tag--gold" onClick={onEvidence}>View evidence</button>
        {e.sceneId && <Link className="tag tag--gold" to={`/living/${e.sceneId}`}>Open Living History</Link>}
        {person && <Link className="tag tag--gold" to={`/people/${person.id}`}>View related person</Link>}
        <button type="button" className="tag tag--gold" onClick={onSave} disabled={saved}>{saved ? 'Saved' : 'Save moment'}</button>
      </div>
    </div>
  );
}

function EvidencePanel({ e, onBack }: { e: HistEvent; onBack: () => void }) {
  return (
    <>
      <button type="button" className="link" onClick={onBack}>‹ Events in extent</button>
      <div className="side__header">
        <p className="eyebrow">Evidence</p>
        <h2>{e.title}</h2>
        <p className="muted">{formatEventDate(e)} · {e.place}</p>
      </div>
      <div className="card card--light">
        <p className="eyebrow eyebrow--bold">{EVIDENCE_LABEL[e.evidence]}</p>
        <p>{EVIDENCE_MEANING[e.evidence]}</p>
        <p>{e.evidenceNote}</p>
      </div>
      <dl className="facts">
        <div className="facts__row"><dt>Date precision</dt><dd>To the {e.precision}</dd></div>
        <div className="facts__row"><dt>Calendar</dt><dd>{CALENDAR_LABEL[e.calendar]}</dd></div>
        <div className="facts__row"><dt>Site</dt><dd>{e.approximateSite ? 'Approximate — exact location not established' : 'Identified place'}</dd></div>
      </dl>
      <p className="eyebrow eyebrow--bold">Sources</p>
      <SourceList ids={e.sourceIds} />
      <p className="muted">Citations are at work level. Page references have not been added yet.</p>
    </>
  );
}

export default function Explore() {
  const [sideCollapsed, toggleSide] = useCollapse('side');
  const { ms, scale, setMs, deep, ma, playing, setPlaying } = useTime();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<MapView | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [polityName, setPolityName] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [brush, setBrush] = useState<Brush | null>(null);
  const [reach, setReach] = useState(true);
  const [divisions, setDivisions] = useState(false);
  /** What the map shows besides territory: events, people, or both. */
  const [layer, setLayer] = useState<'events' | 'people' | 'both'>('both');
  const [projected, setProjected] = useState<{ event: HistEvent; auto: boolean } | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  /** A group badge was tapped: the people in it, shown as a list since zooming alone cannot
   * separate people who are recorded at the literal same spot. */
  const [groupIds, setGroupIds] = useState<string[] | null>(null);
  const [mode, setMode] = useState<'list' | 'evidence'>('list');
  const [focus, setFocus] = useState<{ lng: number; lat: number; zoom?: number; key: string }>();
  const saved = useSaved();
  const { regions, update } = useRegions();
  const year = parts(ms).y;
  const grid = useGrid(year, regions, reach, divisions);
  const units = useUnits();

  const select = (e: HistEvent, fly = true) => {
    setSelectedId(e.id);
    setPolityName(null);
    setBrush(null);
    if (fly) setFocus({ lng: e.lng, lat: e.lat, key: `${e.id}-${Date.now()}` });
    logActivity({ id: `event-${e.id}`, url: `/?event=${e.id}`, kind: 'map', title: `${e.place} · historical map`, sub: `${formatEventDate(e)} · ${e.lat.toFixed(2)}° N, ${e.lng.toFixed(2)}° E` });
  };

  // Deep links: /?event=<id>, /?year=<y>, /?power=<name>, /?place=<id>, /?at=<lng>,<lat>,<zoom>.
  useEffect(() => {
    const y = params.get('year');
    const power = params.get('power');
    const spot = places.find((p) => p.id === params.get('place'));
    if (y) setMs(utc(Number(y), 6, 1));
    if (power) { setPolityName(power); setSelectedId(null); }
    if (spot) setFocus({ lng: spot.lng, lat: spot.lat, key: `${spot.id}-${Date.now()}` });
    const at = params.get('at')?.split(',').map(Number);
    if (at?.length === 3 && at.every(Number.isFinite)) setFocus({ lng: at[0], lat: at[1], zoom: at[2], key: `at-${Date.now()}` });
    if (y || power || spot || at) setParams({}, { replace: true });
    const e = eventById[params.get('event') ?? ''];
    if (!e) return;
    setMs(toMs(e.date));
    select(e);
    setMode('list');
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const [hidden, setHidden] = useState<Set<EvidenceState>>(new Set());
  const toggle = (s: EvidenceState) => setHidden((cur) => { const next = new Set(cur); if (next.has(s)) next.delete(s); else next.add(s); return next; });
  // The events in the window come from the database, which answers for exactly this stretch of time.
  const windowStart = startOf(ms, scale);
  const inWindowNow = useEventsIn(windowStart, addUnits(windowStart, scale, 1));
  const current = useMemo(() => inWindowNow.filter((e) => !hidden.has(e.evidence)), [inWindowNow, hidden]);
  const inExtent = useMemo(
    () => (view ? current.filter((e) => e.lng >= view.west && e.lng <= view.east && e.lat >= view.south && e.lat <= view.north) : current),
    [current, view],
  );
  const selected = current.find((e) => e.id === selectedId) ?? null;

  const territories = useMemo(() => {
    if (!view) return [];
    const seen = new Set<PolityInfo>(
      grid.polities.filter((p) => p.claims.some((c) => c.lng >= view.west && c.lng <= view.east && c.lat >= view.south && c.lat <= view.north)),
    );
    for (let i = 0; i < PROBES; i++) {
      for (let j = 0; j < PROBES; j++) {
        const hit = polityAt(grid, view.west + ((i + 0.5) / PROBES) * (view.east - view.west), view.south + ((j + 0.5) / PROBES) * (view.north - view.south));
        if (hit) seen.add(hit.polity);
      }
    }
    const area = (p: PolityInfo) => p.km2[0] + p.km2[1] + p.km2[2] + p.km2[3];
    return [...seen].sort((a, b) => area(b) - area(a) || b.claims.length - a.claims.length);
  }, [grid, view]);

  useEffect(() => {
    if (!selected) setMode('list');
  }, [selected]);

  // Everyone the records place inside the visible area at this moment.
  const allTracks = useTracks(ms, !deep);
  const onScreen = useMemo(
    () => (deep ? [] : allTracks.filter((t) => !view || (t.at.lng >= view.west && t.at.lng <= view.east && t.at.lat >= view.south && t.at.lat <= view.north))),
    [allTracks, view, deep],
  );
  const dots = useMemo(() => (layer === 'events' ? [] : personMarkers(onScreen, view?.zoom ?? 4)), [onScreen, view?.zoom, layer]);
  const [watching, setWatching] = useState<string | null>(null);
  const watched: Track | undefined = onScreen.find((t) => t.id === watching);
  const markers: MapMarker[] = useMemo(() => {
    const eventMarkers = current.map((e) => ({
      id: e.id, lng: e.lng, lat: e.lat, title: `${e.title} · ${formatEventDate(e)}`, state: e.evidence,
      category: e.category, year: parts(toMs(e.date)).y,
    }));
    return layer === 'people' ? [] : eventMarkers;
  }, [current, layer]);

  const from = scale === 'century' ? Math.floor(year / 100) * 100 : year;
  const changed = useHandovers(from, from + (scale === 'century' ? 100 : 1));
  const deepData = useDeep(deep, ma);
  const pulses = useMemo(() => changed.filter((h) => h.lng !== undefined).map((h) => ({ lng: h.lng!, lat: h.lat! })), [changed]);
  // Coming out of deep time, bring the camera back to the subcontinent.
  const wasDeep = useRef(deep);
  useEffect(() => {
    if (wasDeep.current && !deep) setFocus({ lng: 79.5, lat: 21.5, zoom: 4.1, key: `home-${Date.now()}` });
    wasDeep.current = deep;
  }, [deep]);
  // In deep time the camera keeps the Indian landmass in view as it moves.
  const deepFocus = useMemo(() => (deepData.view ? { lng: deepData.view.at[0], lat: deepData.view.at[1], zoom: 2.1, key: `deep-${ma}` } : undefined), [deepData.view, ma]);
  const prev = neighbourEvent(ms, scale, -1);
  const next = neighbourEvent(ms, scale, 1);
  const windowLabel = formatDate(ms, scale);
  const jump = (e: HistEvent) => {
    setMs(toMs(e.date));
    select(e);
  };

  // How much of the coloured land rests on a record, and how much is only filled by nearness.
  const coverage = useMemo(() => {
    const sum = (k: number) => grid.polities.reduce((n, p) => n + p.km2[k], 0);
    const firm = sum(0) + sum(1) + sum(2), nearest = sum(3);
    return firm + nearest > 0 ? Math.round((firm / (firm + nearest)) * 100) : null;
  }, [grid]);
  // While playing, keep a running record of everything that has gone by, so nothing shown
  // for a moment at high speed is lost.
  const [log, setLog] = useState<{ key: string; when: string; text: string }[]>([]);
  useEffect(() => {
    if (!playing || deep) return;
    const fresh = [
      ...changed.map((h) => ({ key: `h-${h.year}-${h.place}-${h.to}`, when: yearLabel(h.year), text: `${h.place}: ${h.from ?? 'first recorded'} → ${h.to}` })),
      ...current.map((e) => ({ key: `e-${e.id}`, when: formatEventDate(e), text: `${e.title} · ${e.place}` })),
    ];
    if (fresh.length) setLog((old) => [...fresh.filter((f) => !old.some((o) => o.key === f.key)).reverse(), ...old].slice(0, LOG_LIMIT));
  }, [changed, current, playing, deep]);
  // While playing, an event with a date lands on the map and is projected over the whole screen.
  const lastProjected = useRef('');
  useEffect(() => {
    if (deep || layer === 'people') return;
    const live = current.find((e) => e.precision === 'day' && ms >= toMs(e.date) && ms < toMs(e.date) + 86400000);
    if (!live) { lastProjected.current = ''; return; }
    if (!playing || live.id === lastProjected.current) return;
    lastProjected.current = live.id;
    setPlaying(false);
    setProjected({ event: live, auto: true });
  }, [current, ms, playing, deep, layer, setPlaying]);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const share = () => {
    const at = view ? `&at=${((view.west + view.east) / 2).toFixed(3)},${((view.south + view.north) / 2).toFixed(3)},${view.zoom.toFixed(1)}` : '';
    navigator.clipboard?.writeText(`${window.location.origin}/?year=${year}${at}`).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }, () => undefined);
  };
  const myRegions = regions.filter((r) => r.polity === polityName);
  const saveRegion = (r: MappedRegion) => update(regions.some((x) => x.id === r.id) ? regions.map((x) => (x.id === r.id ? r : x)) : [...regions, r]);
  const paint = (lng: number, lat: number) => {
    if (!brush || !polityName) return;
    const target = myRegions.find((r) => year >= r.from && year < r.to) ?? { id: `${polityName}-${Date.now()}`, polity: polityName, from: year, to: year + 1, sources: [], cells: [] };
    const cells = new Set(target.cells);
    for (const c of brushCells(lng, lat, brush.radius)) {
      if (brush.mode === 'add') cells.add(c);
      else cells.delete(c);
    }
    // Strokes over open sea touch no land cells; do not record an empty region for them.
    if (cells.size || target.cells.length) saveRegion({ ...target, cells: [...cells] });
  };
  const openPolity = (name: string | null) => {
    setPolityName(name);
    setBrush(null);
    if (name) { setSelectedId(null); setGroupIds(null); }
  };

  return (
    <Page>
      <div className="mapbar">
        {deep ? (
          <p><strong>{ma === 0 ? 'Present-day continents' : `${ma} million years ago`}</strong> <span className="dim">· the Indian landmass is gold; the dashed line is where it has been</span></p>
        ) : (
          <>
            <div className="seg" role="group" aria-label="What the map shows">
              {([['events', 'Events'], ['people', 'People'], ['both', 'Both']] as const).map(([id, label]) => (
                <button key={id} type="button" className={layer === id ? 'is-on' : ''} aria-pressed={layer === id} onClick={() => setLayer(id)}>{label}</button>
              ))}
            </div>
            <span className="mapbar__shapes" title="The shape says what kind of thing it is; colour says which">
              <b className="shape-dot" /> place <b className="shape-diamond" /> event <b className="shape-person">👤</b> person
            </span>
            <span className="mapbar__key" title="Colour shows who held the land">
              <i style={{ background: '#e49125' }} /> Indian dynasties and states
              <i style={{ background: '#37be7a' }} /> Sultanates and Muslim-ruled states
              <i style={{ background: '#375681' }} /> European powers
            </span>
            {layer !== 'people' && <EvidenceLegend hidden={hidden} onToggle={toggle} inline />}
            <span className="mapbar__ticker" aria-live="polite">
              <strong>{windowLabel}</strong>
              {changed.slice(0, 2).map((h) => <span key={`${h.year}-${h.place}`}> · {h.place} → {h.to}</span>)}
              {changed.length > 2 && <span className="dim"> · +{changed.length - 2}</span>}
            </span>
            <span className="mapbar__tools">
              <button type="button" className={reach ? 'is-on' : ''} onClick={() => setReach(!reach)} aria-pressed={reach}>Areas</button>
              <button type="button" className={divisions ? 'is-on' : ''} onClick={() => setDivisions(!divisions)} aria-pressed={divisions} title="Show the provinces inside each power, where they are recorded">Divisions</button>
              <button type="button" className={copied ? 'is-on' : ''} onClick={share} title="Copy a link that opens the map on this year and view">{copied ? 'Link copied' : 'Copy link'}</button>
            </span>
          </>
        )}
      </div>
      <div className="workspace">
        <LeftNav />
        <HistoricalMap
          markers={deep ? NO_MARKERS : markers}
          people={deep ? undefined : dots}
          watchingId={watching}
          onPerson={(id) => { setWatching(id); setSelectedId(null); setPolityName(null); setSpot(null); setGroupIds(null); }}
          onGroup={(ids) => { setGroupIds(ids); setWatching(null); setSelectedId(null); setPolityName(null); setSpot(null); }}
          deep={deepData.view}
          pulses={deep ? undefined : pulses}
          grid={grid}
          selectedPolity={polityName}
          onPolityClick={deep ? undefined : (name) => { if (brush || !name) openPolity(name); }}
          onSpot={deep || brush ? undefined : (s) => { setSpot(s); setGroupIds(null); }}
          onBrush={brush ? paint : null}
          selectedId={selected?.id}
          onSelect={(id) => { setSelectedId(id); if (id) setGroupIds(null); }}
          focus={deep ? deepFocus : focus}
          onViewChange={setView}
          caption={deep ? `${ma} million years ago · plate reconstruction` : `Map date ${yearLabel(year)}`}
        >
          {!deep && grid.polities.length === 0 && (
            <div className="map__notice" role="status">
              <p className="map__notice-title">No reconstructed territory at {windowLabel}</p>
              <p className="map__notice-body">
                Present-day coastline and rivers stay visible as context. No political claim in the records covers this
                date — not a loading problem, the records themselves don't reach here yet.
              </p>
            </div>
          )}
        </HistoricalMap>

        <button type="button" className="side__tab" onClick={toggleSide} title={sideCollapsed ? 'Show the detail panel' : 'Hide the detail panel'} aria-expanded={!sideCollapsed}>
          {sideCollapsed ? '‹' : '›'}
        </button>
        <aside className={`side${sideCollapsed ? ' is-collapsed' : ''}`}>
          {deep ? (
            <DeepPanel ma={ma} deep={deepData} />
          ) : groupIds && !polityName ? (
            <>
              <button type="button" className="link" onClick={() => setGroupIds(null)}>‹ Events in extent</button>
              <div className="side__header">
                <p className="eyebrow">{groupIds.length} people, one spot</p>
                <h2>Who's here</h2>
                <p className="muted">Recorded close enough together that the map shows them as one badge. Pick one to follow.</p>
              </div>
              {onScreen.filter((t) => groupIds.includes(t.id)).map((t) => (
                <button key={t.id} type="button" className="card" onClick={() => { setWatching(t.id); setGroupIds(null); }}>
                  <strong>{t.name}</strong>
                  <span className="muted">{describe(t)}</span>
                </button>
              ))}
            </>
          ) : watched && !polityName ? (
            <>
              <button type="button" className="link" onClick={() => setWatching(null)}>‹ Events in extent</button>
              <div className="side__header">
                <p className="eyebrow">{watched.uid}</p>
                <h2>{watched.name}</h2>
                <p className="muted">{describe(watched)}</p>
              </div>
              <div className="card card--light">
                <p className="eyebrow eyebrow--bold">{watched.state === 'at' ? 'Recorded' : watched.state === 'between' ? 'Inferred position' : 'Last or next record'}</p>
                {watched.state === 'between' ? (
                  <>
                    <p>Between <strong>{watched.from!.label}</strong> and <strong>{watched.to!.label}</strong>, heading {compass(watched.heading!)}.</p>
                    <p className="muted">{watched.distanceKm} km over {watched.days} days. The position shown is a straight-line estimate between two recorded places; no source says where the person was in between.</p>
                    {watched.implausible && <p className="rust">This pace is faster than travel of the time allowed, so the two records may not describe one journey.</p>}
                  </>
                ) : (
                  <p>{watched.at.label}{watched.precision && watched.precision !== 'day' ? ` · dated to the ${watched.precision} only` : ''}</p>
                )}
              </div>
              {(() => {
                const here = onScreen.filter((t) => t.id !== watched.id && Math.abs(t.at.lng - watched.at.lng) < 0.3 && Math.abs(t.at.lat - watched.at.lat) < 0.3);
                return here.length > 0 && (
                  <>
                    <p className="eyebrow eyebrow--bold">Also here</p>
                    {here.map((t) => <button key={t.id} type="button" className="card" onClick={() => setWatching(t.id)}><strong>{t.name}</strong><span className="muted">{describe(t)}</span></button>)}
                  </>
                );
              })()}
              <Link className="link" to={`/people/${watched.id}`}>Open the full record for {watched.name}</Link>
            </>
          ) : spot && !polityName && !selected ? (
            <>
              <button type="button" className="link" onClick={() => setSpot(null)}>‹ Events in extent</button>
              <div className="side__header">
                <p className="eyebrow">This spot in {yearLabel(year)}</p>
                <h2>{spot.district ?? 'Outside the mapped area'}</h2>
                <p className="muted">{Math.abs(spot.lat).toFixed(4)}°{spot.lat < 0 ? 'S' : 'N'} {Math.abs(spot.lng).toFixed(4)}°{spot.lng < 0 ? 'W' : 'E'}</p>
              </div>
              {(() => {
                const hit = polityAt(grid, spot.lng, spot.lat);
                const here = spot.district && spot.country ? regionsAt(spot.country, spot.district, year) : [];
                const division = hit?.polity.claims.find((c) => c.division && unitAt(units, c.lng, c.lat) === spot.district)?.division;
                return (
                  <>
                    <p className="eyebrow eyebrow--bold">As it stood in {yearLabel(year)}</p>
                    <ol className="ladder">
                      <li><span>Held by</span>{hit ? <button type="button" className="link" onClick={() => { setSpot(null); openPolity(hit.polity.name); }}>{hit.polity.power}</button> : 'No record'}{hit && <em>{GRADE_LABEL[hit.grade]}</em>}</li>
                      {division && <li><span>Province</span>{division}</li>}
                      {here.map((r) => <li key={r.id}><span>{r.kind}</span>{r.name}<em>{r.parent} · {r.from}–{r.to}</em></li>)}
                      {!division && here.length === 0 && <li><span>Smaller regions</span>None recorded yet for this year<em>The present-day boundaries below stand in until they are.</em></li>}
                    </ol>
                    <p className="eyebrow eyebrow--bold">Present-day boundaries</p>
                    <ol className="ladder">
                      {spot.state && <li><span>State</span>{spot.state}</li>}
                      {spot.district && <li><span>District</span>{spot.district}</li>}
                      <li><span>Taluka</span>{spot.taluka ?? (view && view.zoom < 7 ? 'Zoom in to see talukas' : 'Not available here')}</li>
                      <li><span>Village</span>Boundaries not available as open data</li>
                    </ol>
                    <p className="muted">The district outlined on the map is today’s. A person or event placed here on any date can be tied to it now, and to a period region as soon as one is recorded.</p>
                  </>
                );
              })()}
            </>
          ) : polityName ? (
            <TerritoryPanel
              name={polityName}
              info={grid.polities.find((p) => p.name === polityName)}
              year={year}
              regions={myRegions}
              brush={brush}
              onBrush={setBrush}
              onRegion={saveRegion}
              onDeleteRegion={(id) => update(regions.filter((r) => r.id !== id))}
              onBack={() => openPolity(null)}
            />
          ) : mode === 'evidence' && selected ? (
            <EvidencePanel e={selected} onBack={() => setMode('list')} />
          ) : selected ? (
            <>
              <button type="button" className="link" onClick={() => setSelectedId(null)}>‹ Events in extent</button>
              <EventPopup
                e={selected}
                territory={(() => {
                  const region = polityAt(grid, selected.lng, selected.lat);
                  if (region) return `${region.polity.name} (${GRADE_LABEL[region.grade]})`;
                  const near = holderNear(grid, selected.lng, selected.lat, SAME_PLACE_KM);
                  return near && `${near.name} (attested place)`;
                })()}
                district={unitAt(units, selected.lng, selected.lat)}
                onEvidence={() => setMode('evidence')}
                onSave={() => setSaving(true)}
                onProject={() => setProjected({ event: selected, auto: false })}
                saved={saved.items.some((s) => s.eventId === selected.id)}
              />
            </>
          ) : (
            <>
              <div className="side__header">
                <p className="eyebrow">Events in current map extent</p>
                <h2>{windowLabel}</h2>
                <p className="muted">Recorded events inside the visible map area during this {scale}. Each carries its evidence state and sources.</p>
              </div>
              <div className="side__count">
                <strong>{inExtent.length} {inExtent.length === 1 ? 'event' : 'events'} in extent</strong>
                <span>{current.length - inExtent.length > 0 ? `${current.length - inExtent.length} outside view` : 'Sourced'}</span>
              </div>
              <div className="list">
                {inExtent.map((e) => (
                  <button key={e.id} type="button" className={`card${e.id === selectedId ? ' is-selected' : ''}`} onClick={() => select(e)}>
                    <strong>{e.title}</strong>
                    <span className="muted">{e.place} · {formatEventDate(e)}</span>
                    <span className="chips">
                      <span className={`chip${e.importance === 'High' ? ' chip--strong' : ''}`}>{e.importance}</span>
                      <span className="chip">{EVIDENCE_LABEL[e.evidence]}</span>
                    </span>
                  </button>
                ))}
                {inExtent.length === 0 && (
                  <div className="list__empty">
                    <p><strong>No events entered here for {windowLabel}.</strong></p>
                    <p className="muted">Events and territory claims are entered for the subcontinent, 1500–1800 ({eventsChrono.length} events so far).</p>
                    {prev && <button type="button" className="link" onClick={() => jump(prev)}>‹ {formatEventDate(prev)} · {prev.title}</button>}
                    {next && <button type="button" className="link" onClick={() => jump(next)}>{formatEventDate(next)} · {next.title} ›</button>}
                  </div>
                )}
              </div>
              <div className="side__count">
                <strong>People on screen</strong>
                <span>{onScreen.length}</span>
              </div>
              <div className="territories">
                {onScreen.length === 0 && <p className="muted">No recorded person is placed inside this view at {windowLabel}. People appear only within 90 days of a recorded appearance.</p>}
                {onScreen.map((t) => (
                  <button key={t.id} type="button" onClick={() => { setWatching(t.id); setFocus({ lng: t.at.lng, lat: t.at.lat, key: `${t.id}-${Date.now()}` }); }}>
                    <i className="swatch" style={{ background: t.state === 'at' ? '#d6a744' : '#aaa997' }} />
                    <span>{t.name}<em> · {describe(t)}</em></span>
                    <span className="muted">{t.state === 'between' ? `→ ${compass(t.heading!)}` : ''}</span>
                  </button>
                ))}
              </div>
              {log.length > 0 && (
                <>
                  <div className="side__count">
                    <strong>Playback record · {log.length} shown</strong>
                    <button type="button" className="link" onClick={() => setLog([])}>Clear</button>
                  </div>
                  <ul className="changes changes--log">
                    {log.map((l) => <li key={l.key}><b>{l.when}</b> {l.text}</li>)}
                  </ul>
                </>
              )}
              <div className="side__count">
                <strong>Changed hands in {scale === 'century' ? windowLabel : yearLabel(year)}</strong>
                <span>{changed.length} {changed.length === 1 ? 'place' : 'places'}</span>
              </div>
              <ul className="changes">
                {changed.length === 0 && <li className="muted">No change of holder recorded.</li>}
                {changed.map((h) => (
                  <li key={`${h.year}-${h.place}`}><b>{h.year}</b> {h.place}: {h.from ?? 'first recorded'} → <button type="button" className="link" onClick={() => openPolity(h.to)}>{h.to}</button></li>
                ))}
              </ul>
              <div className="side__count">
                <strong>Who held this area</strong>
                <span>{territories.length} in view</span>
              </div>
              {coverage !== null && <p className="muted coverage">{coverage}% of the coloured land rests on a record or an attested place; {100 - coverage}% is filled by the nearest attested place and drawn palest.</p>}
              <div className="territories">
                {territories.slice(0, TERRITORY_ROWS).map((p) => (
                  <button key={p.name} type="button" onClick={() => openPolity(p.name)}>
                    <Swatch k={p.k} />
                    <span>{p.name}{p.under && <em> · under {p.under}</em>}</span>
                    <span className="muted">{p.claims.length} {p.claims.length === 1 ? 'place' : 'places'}{` · ${formatArea(p.km2[0] + p.km2[1] + p.km2[2] + p.km2[3])}`}</span>
                  </button>
                ))}
                {territories.length === 0 && <p className="muted">No sourced claim covers this area in {yearLabel(year)}.</p>}
                {territories.length > TERRITORY_ROWS && <p className="muted">Largest {TERRITORY_ROWS} shown. Zoom in, or click any coloured area.</p>}
              </div>
              <form className="newterritory" onSubmit={(ev) => { ev.preventDefault(); if (newName.trim()) { openPolity(newName.trim()); setBrush({ mode: 'add', radius: 3 }); setNewName(''); } }}>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name a power to map from sources" aria-label="Name a power to map from sources" />
                <button type="submit" className="option">Map it</button>
              </form>
            </>
          )}
        </aside>
      </div>
      <TimeWorkspace />
      {projected && (
        <EventProjection
          event={projected.event}
          onContinue={projected.auto ? () => { setProjected(null); setPlaying(true); } : undefined}
          onClose={() => setProjected(null)}
        />
      )}
      {saving && selected && (
        <SaveDialog
          ms={toMs(selected.date)}
          scale={scale}
          title={selected.title}
          link={`${window.location.origin}/?event=${selected.id}`}
          onSave={(note, visibility) => { saved.save({ ms: toMs(selected.date), scale, eventId: selected.id, note, visibility }); setSaving(false); }}
          onClose={() => setSaving(false)}
        />
      )}
    </Page>
  );
}
