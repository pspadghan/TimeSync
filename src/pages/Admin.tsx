import { useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { TopBar } from '../components/Shell';
import { controlClaims, places } from '../data/control';
import { events } from '../data/events';
import { people } from '../data/people';
import { sources } from '../data/sources';
import { EVIDENCE_LABEL } from '../components/Evidence';
import { useAudit } from '../state/audit';

function Frame({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="app">
      <TopBar status="Administration · works on the bundled records; nothing here edits them" />
      <div className="rhead">
        <div>
          <p className="eyebrow gold">Admin</p>
          <h1>{title}</h1>
        </div>
        <nav className="rhead__side">
          <NavLink className="option" to="/admin" end>Review queue</NavLink>
          <NavLink className="option" to="/admin/people">People</NavLink>
          <NavLink className="option" to="/admin/records">Records</NavLink>
          <NavLink className="option" to="/admin/audit">Audit</NavLink>
        </nav>
      </div>
      <main className="research">
        <p className="dim">{intro}</p>
        {children}
      </main>
    </div>
  );
}

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const overlap = (a: { born: number; died: number }, b: { born: number; died: number }) => a.born <= b.died && b.born <= a.died;

/** Identity checks: namesakes, missing parentage, journeys outside the lifespan. */
export function AdminPeople() {
  const rows = useMemo(() => people.map((p) => {
    const issues: string[] = [];
    const appearances = events.filter((e) => e.personIds.includes(p.id)).length + (p.journey?.length ?? 0);
    const sameName = people.filter((o) => o.id !== p.id && (plain(o.name) === plain(p.name) || o.aliases.some((a) => plain(a) === plain(p.name))));
    sameName.forEach((o) => issues.push(overlap(p, o) ? `Shares a name with ${o.name} and lived at the same time: needs a disambiguating note.` : `Shares a name with ${o.name} (${o.born}–${o.died}); lifespans do not overlap.`));
    if (!p.father && !p.mother) issues.push('No parentage recorded: identity rests on name and dates only.');
    if (!p.namesakes?.length && people.some((o) => o.id !== p.id && plain(o.name).split(' ')[0] === plain(p.name).split(' ')[0])) issues.push('Another person shares the first name; consider listing namesakes.');
    p.journey?.forEach((s) => { if (s.year < p.born || s.year > p.died) issues.push(`Journey stage "${s.label}" (${s.year}) falls outside the lifespan.`); });
    if (appearances === 0) issues.push('Appears in no event and has no journey, so cannot be placed on the map.');
    return { p, issues, appearances };
  }), []);
  const flagged = rows.filter((r) => r.issues.length).length;
  const [only, setOnly] = useState(false);

  return (
    <Frame title="Person data management" intro={`${people.length} people, each with one permanent ID. ${flagged} need attention. Records are edited in src/data/records/people.json; this page finds what to fix.`}>
      <label className="options"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> <span className="dim">Show only people with issues</span></label>
      <div className="rgrid">
        {rows.filter((r) => !only || r.issues.length).map(({ p, issues, appearances }) => (
          <div key={p.id} className="rcard">
            <p className="eyebrow gold">{p.uid}</p>
            <h2>{p.name}</h2>
            <p className="dim">{p.born}–{p.died} · {p.role}</p>
            <p>{appearances} recorded appearance{appearances === 1 ? '' : 's'}{p.aliases.length > 0 && ` · also ${p.aliases.join(', ')}`}</p>
            {issues.length === 0 ? <p className="green">● No identity issues found.</p> : issues.map((i) => <p key={i} className="gold">△ {i}</p>)}
            <Link className="link" to={`/people/${p.id}`}>Open record</Link>
          </div>
        ))}
      </div>
    </Frame>
  );
}

type Tab = 'places' | 'events' | 'sources';

/** Places, events and sources in one place, with the checks a data steward needs. */
export function AdminRecords() {
  const [tab, setTab] = useState<Tab>('places');
  const [filter, setFilter] = useState('');
  const needle = filter.trim().toLowerCase();
  const cited = useMemo(() => {
    const n = new Map<string, number>();
    [...controlClaims.flatMap((c) => c.sourceIds), ...events.flatMap((e) => e.sourceIds), ...people.flatMap((p) => p.journey?.flatMap((s) => s.sourceIds) ?? [])].forEach((id) => n.set(id, (n.get(id) ?? 0) + 1));
    return n;
  }, []);
  const claimsAt = useMemo(() => {
    const n = new Map<string, number>();
    controlClaims.forEach((c) => n.set(c.placeId, (n.get(c.placeId) ?? 0) + 1));
    return n;
  }, []);
  const match = (...s: (string | number)[]) => !needle || s.some((v) => String(v).toLowerCase().includes(needle));

  return (
    <Frame title="Event, place and source management" intro="Every row shows how well it is supported. Filter by name; the badge columns show what still needs a reviewer.">
      <div className="options">
        {(['places', 'events', 'sources'] as Tab[]).map((t) => <button key={t} type="button" className={`option${tab === t ? ' is-on' : ''}`} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)} · {t === 'places' ? places.length : t === 'events' ? events.length : sources.length}</button>)}
        <input className="adminfilter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter" aria-label="Filter" />
      </div>
      <table className="admintable">
        {tab === 'places' && (
          <>
            <thead><tr><th>Place</th><th>Coordinates</th><th>±km</th><th>Status</th><th>Names</th><th>Claims</th></tr></thead>
            <tbody>{places.filter((p) => match(p.name, p.id)).map((p) => (
              <tr key={p.id}><td>{p.name}</td><td>{p.lat.toFixed(3)}°N {p.lng.toFixed(3)}°E</td><td>{p.precisionKm}</td><td className={p.coordStatus === 'verified' ? 'green' : 'gold'}>{p.coordStatus}</td><td>{p.names?.map((n) => n.name).join(', ') ?? '—'}</td><td>{claimsAt.get(p.id) ?? 0}</td></tr>
            ))}</tbody>
          </>
        )}
        {tab === 'events' && (
          <>
            <thead><tr><th>Event</th><th>Date</th><th>Calendar</th><th>Evidence</th><th>People</th><th>Works</th></tr></thead>
            <tbody>{[...events].sort((a, b) => a.date.localeCompare(b.date)).filter((e) => match(e.title, e.place)).map((e) => (
              <tr key={e.id}><td>{e.title}<br /><span className="dim">{e.place}</span></td><td>{e.date} · {e.precision}</td><td>{e.calendar}</td><td className={e.evidence === 'disputed' ? 'rust' : ''}>{EVIDENCE_LABEL[e.evidence]}</td><td>{e.personIds.length}</td><td className={e.sourceIds.length < 2 ? 'gold' : ''}>{e.sourceIds.length}</td></tr>
            ))}</tbody>
          </>
        )}
        {tab === 'sources' && (
          <>
            <thead><tr><th>Work</th><th>Author</th><th>Kind</th><th>Dated</th><th>Times cited</th></tr></thead>
            <tbody>{sources.filter((s) => match(s.title, s.author)).map((s) => (
              <tr key={s.id}><td>{s.title}</td><td>{s.author}</td><td>{s.kind}</td><td>{s.dated}</td><td className={cited.get(s.id) ? '' : 'rust'}>{cited.get(s.id) ?? 'never — unused'}</td></tr>
            ))}</tbody>
          </>
        )}
      </table>
    </Frame>
  );
}

/** Who approved or returned what, and when. */
export function AdminAudit() {
  const log = useAudit();
  return (
    <Frame title="Review, quality and version audit" intro="An append-only record of every decision made on a submission in this browser. Nothing is removed from it.">
      <div className="rgrid rgrid--4">
        <div className="rcard"><p className="eyebrow gold">Decisions</p><p className="rstat">{log.length}</p></div>
        <div className="rcard"><p className="eyebrow gold">Approved</p><p className="rstat">{log.filter((l) => l.decision === 'approved').length}</p></div>
        <div className="rcard"><p className="eyebrow gold">Returned</p><p className="rstat">{log.filter((l) => l.decision === 'returned').length}</p></div>
        <div className="rcard"><p className="eyebrow gold">Records</p><p className="rstat">{places.length + events.length + people.length}</p><p className="dim">places, events and people in this version</p></div>
      </div>
      {log.length === 0 && <p className="dim">No decisions yet. Approve or return a submission in the review queue and it appears here.</p>}
      <table className="admintable">
        {log.length > 0 && <thead><tr><th>When</th><th>Who</th><th>Subject</th><th>Decision</th><th>Reason</th></tr></thead>}
        <tbody>{log.map((l) => (
          <tr key={`${l.at}-${l.subject}`}><td>{new Date(l.at).toLocaleString()}</td><td>{l.who} <span className="dim">({l.role})</span></td><td>{l.kind} · {l.subject}</td><td className={l.decision === 'approved' ? 'green' : 'gold'}>{l.decision}</td><td>{l.note ?? '—'}</td></tr>
        ))}</tbody>
      </table>
    </Frame>
  );
}
