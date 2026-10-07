import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import HistoricalMap, { type MapMarker } from '../components/HistoricalMap';
import { EVIDENCE_LABEL, EVIDENCE_STATES, SourceList } from '../components/Evidence';
import { IdentityCard } from '../components/Identity';
import { LeftNav, Page } from '../components/Shell';
import { polityAt, unitAt, useGrid, useRegions, useUnits } from '../data/grid';
import { presenceAt } from '../data/presence';
import { eventById } from '../data/events';
import { sourceById } from '../data/sources';
import { parts, yearLabel as formatYear } from '../data/time';
import type { JourneyStage, Person } from '../data/types';
import { logActivity } from '../state/recent';
import { useTime } from '../state/time';

const yearLabel = (s: JourneyStage) => `${s.approxYear ? '~ ' : ''}${s.year}`;
const isEarly = (id: string) => sourceById[id].kind !== 'scholarship';

/** Stage-by-source grid: which works attest which stage, so agreement and gaps are visible at a glance. */
function Concordance({ person, index, onPick }: { person: Person; index: number; onPick: (i: number) => void }) {
  const stages = person.journey!;
  const cols = useMemo(() => [...new Set(stages.flatMap((s) => s.sourceIds))].sort((a, b) => Number(isEarly(b)) - Number(isEarly(a))), [stages]);
  const span = person.died - person.born;
  return (
    <main className="concord">
      <p className="eyebrow">Timeline · {person.born}–{person.died}</p>
      <div className="lifeline">
        {stages.map((s, i) => (
          <button key={s.id} type="button" className={`lifeline__dot is-${s.evidence}${i === index ? ' is-on' : ''}`} style={{ left: `${((s.year - person.born) / span) * 100}%` }} title={`${yearLabel(s)} · ${s.place} · ${s.label}`} onClick={() => onPick(i)}>
            {i + 1}
          </button>
        ))}
        <span className="lifeline__end">{person.born}</span>
        <span className="lifeline__end lifeline__end--right">{person.died}</span>
      </div>

      <p className="eyebrow">Where the references agree</p>
      <p className="muted">A filled mark means the work is cited for that stage. Works written in or near the person’s lifetime come first; “early” counts those.</p>
      <div className="concord__scroll">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Year</th><th>Place</th><th>Stage</th><th>Presence</th><th>Route to here</th>
              {cols.map((id) => <th key={id} className="concord__src" title={`${sourceById[id].author} · ${sourceById[id].dated}`}><span>{sourceById[id].title}</span></th>)}
              <th>Cited</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s, i) => (
              <tr key={s.id} className={i === index ? 'is-on' : ''} onClick={() => onPick(i)}>
                <td>{i + 1}</td>
                <td>{yearLabel(s)}</td>
                <td>{s.place}</td>
                <td>{s.label}</td>
                <td>{EVIDENCE_LABEL[s.evidence]}</td>
                <td>{i === 0 ? '—' : EVIDENCE_LABEL[s.routeEvidence]}</td>
                {cols.map((id) => <td key={id} className="concord__mark">{s.sourceIds.includes(id) ? (isEarly(id) ? '●' : '○') : ''}</td>)}
                <td>{s.sourceIds.length} · {s.sourceIds.filter(isEarly).length} early</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">● primary or near-contemporary work · ○ modern scholarship. Citations are at work level; page references are still to be added.</p>
    </main>
  );
}

export default function Journey({ person }: { person: Person }) {
  const stages = person.journey!;
  const { ms } = useTime();
  const [index, setIndex] = useState(() => Math.max(0, stages.findIndex((s) => s.eventId === 'agra-1666')));
  const [phase, setPhase] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'refs'>('map');
  const [focus, setFocus] = useState<{ lng: number; lat: number; zoom?: number; key: string }>();
  const stage = stages[index];
  const { regions } = useRegions();
  const grid = useGrid(stage.year, regions);
  const district = unitAt(useUnits(), stage.lng, stage.lat);
  const playheadYear = parts(ms).y;
  const presence = presenceAt(person, playheadYear);

  useEffect(() => {
    logActivity({ id: `person-${person.id}`, url: `/people/${person.id}`, kind: 'person', title: `${person.name} · journey`, sub: `${stages.length} stages · ${person.born}–${person.died}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.id]);

  const go = (i: number) => {
    const s = stages[i];
    setIndex(i);
    setFocus({ lng: s.lng, lat: s.lat, key: `${s.id}-${Date.now()}` });
  };
  const pickPhase = (p: string | null) => {
    setPhase(p);
    const first = p ? stages.findIndex((s) => s.phase === p) : -1;
    if (first >= 0) go(first);
  };
  const atPlayhead = () => {
    const y = parts(ms).y;
    const i = stages.reduce((best, s, n) => (s.year <= y ? n : best), 0);
    setPhase(null);
    go(i);
  };

  // The numbered diamonds mark every OTHER stage, as waypoints on the route; the gliding
  // person pin already marks the current one, so it is left out here rather than stacking
  // a diamond and a pin on the same spot.
  const markers: MapMarker[] = useMemo(
    () => stages.map((s, i) => ({
      id: s.id, lng: s.lng, lat: s.lat, badge: String(i + 1), state: s.evidence,
      title: yearLabel(s), lines: [s.place, s.label], dim: !!phase && s.phase !== phase,
      category: (s.eventId ? eventById[s.eventId]?.category : undefined), year: s.year,
    })).filter((_, i) => i !== index),
    [stages, phase, index],
  );
  const coverage = useMemo(() => {
    const segs = stages.slice(1);
    return EVIDENCE_STATES
      .map((st) => ({ st, n: segs.filter((s) => s.routeEvidence === st).length }))
      .filter((c) => c.n > 0)
      .map((c) => `${EVIDENCE_LABEL[c.st]} ${Math.round((c.n / segs.length) * 100)}%`)
      .join(' · ');
  }, [stages]);

  const event = stage.eventId ? eventById[stage.eventId] : undefined;
  const territory = polityAt(grid, stage.lng, stage.lat)?.polity.name;

  return (
    <Page status={`${person.name} · ${person.uid} · life journey · year-level precision`}>
      <div className="subbar">
        <div className="options">
          <button type="button" className={`option${view === 'map' ? ' is-on' : ''}`} onClick={() => setView('map')}>Map</button>
          <button type="button" className={`option${view === 'refs' ? ' is-on' : ''}`} onClick={() => setView('refs')}>Timeline &amp; references</button>
          <button type="button" className="option" onClick={atPlayhead} title={`Show where the journey stood in ${parts(ms).y}`}>Selected date</button>
          <button type="button" className={`option${phase ? '' : ' is-on'}`} onClick={() => pickPhase(null)}>Lifetime</button>
        </div>
        <div className="options">
          {person.phases!.map((p) => (
            <button key={p} type="button" className={`option${p === phase ? ' is-on' : ''}`} onClick={() => pickPhase(p)}>{p}</button>
          ))}
        </div>
      </div>
      <div className="workspace">
        <LeftNav />
        {view === 'refs' ? (
          <Concordance person={person} index={index} onPick={setIndex} />
        ) : (
          <HistoricalMap
            markers={markers}
            people={[{ kind: 'person', id: person.id, name: person.name, lng: stage.lng, lat: stage.lat, color: '#ffd23f', firm: true, gender: person.gender }]}
            watchingId={person.id}
            grid={grid}
            selectedId={stage.id}
            onSelect={(id) => { const i = stages.findIndex((s) => s.id === id); if (i >= 0) setIndex(i); }}
            focus={focus}
            caption={`territory as of ${formatYear(stage.year)}`}
          />
        )}

        <aside className="side">
          <p className="eyebrow">Person journey</p>
          <h2 className="side__name">{person.name}</h2>
          <p className="accent side__life">{person.role} · {person.born}–{person.died}</p>
          <IdentityCard person={person} />
          <div className="card card--light">
            <p className="eyebrow eyebrow--bold">Route evidence coverage</p>
            <p>{coverage}</p>
          </div>
          <div className="card card--light">
            <p className="eyebrow eyebrow--bold">Where in {formatYear(playheadYear)} · timeline date</p>
            <p>{presence ? presence.text : `Outside this person’s lifetime (${person.born}–${person.died}).`}</p>
            {presence && presence.kind !== 'attested' && <p className="muted">This is the most probable position between two recorded moments, not a recorded fact.</p>}
          </div>
          <p className="eyebrow eyebrow--bold">Selected stage summary</p>
          <div className="card card--light">
            <strong>{stage.label}</strong>
            <span className="muted">{yearLabel(stage)} · {stage.place} · {stage.phase}</span>
            <span>{stage.summary}</span>
            {territory && <span className="muted">Held in {stage.year} by: {territory}</span>}
            {district && <span className="muted">Present-day district: {district}</span>}
            {index > 0 && <span className="muted">Route here: {EVIDENCE_LABEL[stage.routeEvidence].toLowerCase()}. {stage.routeNote}</span>}
          </div>
          <p className="eyebrow eyebrow--bold">Navigation</p>
          <div className="options">
            <button type="button" className="option" disabled={index === 0} onClick={() => go(index - 1)}>Previous stage</button>
            <button type="button" className="option" disabled={index === stages.length - 1} onClick={() => go(index + 1)}>Next stage</button>
          </div>
          {event && (
            <div className="options">
              <Link className="option is-on" to={`/?event=${event.id}`}>Open this stage on the map</Link>
              {event.sceneId && <Link className="option" to={`/living/${event.sceneId}`}>Walk this moment</Link>}
            </div>
          )}
          <p className="eyebrow eyebrow--bold">References for this stage</p>
          <SourceList ids={stage.sourceIds} />
        </aside>
      </div>
    </Page>
  );
}
