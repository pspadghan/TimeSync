import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EVIDENCE_LABEL, SourceList } from '../components/Evidence';
import { IdentityCard } from '../components/Identity';
import { LeftNav, Page } from '../components/Shell';
import { eventById, events } from '../data/events';
import { people, personById } from '../data/people';
import { sources } from '../data/sources';
import { eventsChrono, formatDate, formatEventDate } from '../data/time';
import type { HistEvent } from '../data/types';
import { useSaved } from '../state/saved';
import Journey from './Journey';

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

function EventRow({ e }: { e: HistEvent }) {
  return (
    <Link className="card" to={`/?event=${e.id}`}>
      <strong>{e.title}</strong>
      <span className="muted">{formatEventDate(e)} · {e.place}</span>
      <span className="chips">
        <span className={`chip${e.importance === 'High' ? ' chip--strong' : ''}`}>{e.importance}</span>
        <span className="chip">{EVIDENCE_LABEL[e.evidence]}</span>
      </span>
    </Link>
  );
}

export function EventsPage() {
  return (
    <Frame eyebrow="Events" title="Chronology, 1500–1800" intro={`${events.length} events are entered so far. Open one to see it on the map at its date.`}>
      <div className="grid">{eventsChrono.map((e) => <EventRow key={e.id} e={e} />)}</div>
    </Frame>
  );
}

export function PlacesPage() {
  const byPlace = new Map<string, HistEvent[]>();
  eventsChrono.forEach((e) => byPlace.set(e.place, [...(byPlace.get(e.place) ?? []), e]));
  const places = [...byPlace.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return (
    <Frame eyebrow="Places" title="Places with recorded events" intro="Place names are those used in the cited works, with the modern name where it differs.">
      <div className="grid">
        {places.map(([place, list]) => (
          <div key={place} className="card card--light">
            <strong>{place}</strong>
            {list.map((e) => <Link key={e.id} className="link" to={`/?event=${e.id}`}>{formatEventDate(e)} · {e.title}</Link>)}
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function PeoplePage() {
  return (
    <Frame eyebrow="People" title="People in the chronology" intro="Each person has one permanent ID, fixed by name, lifespan and parentage together. A full life journey is mapped for Chhatrapati Shivaji Maharaj; the others link to the events they appear in.">
      <div className="grid">
        {people.map((p) => (
          <Link key={p.id} className="card" to={`/people/${p.id}`}>
            <strong>{p.name}</strong>
            <span className="muted">{p.role} · {p.born}–{p.died}</span>
            <span>{p.summary}</span>
            {p.namesakes && <span className="muted">Not {p.namesakes.map((n) => `${n.name} (${n.life})`).join(' or ')}</span>}
            <span className="chips"><code>{p.uid}</code><span className={`chip${p.journey ? ' chip--strong' : ''}`}>{p.journey ? `Journey · ${p.journey.length} stages` : 'Events only'}</span></span>
          </Link>
        ))}
      </div>
    </Frame>
  );
}

export function PersonPage() {
  const { id = '' } = useParams();
  const person = personById[id];
  if (!person) return <Frame eyebrow="People" title="No such person" intro="That person is not in the dataset."><Link className="link" to="/people">‹ All people</Link></Frame>;
  if (person.journey) return <Journey person={person} />;
  const related = eventsChrono.filter((e) => e.personIds.includes(person.id));
  return (
    <Frame eyebrow="Person" title={person.name} intro={`${person.role} · ${person.born}–${person.died}. ${person.summary}`}>
      <div className="directory__narrow"><IdentityCard person={person} /></div>
      <p className="eyebrow eyebrow--bold">Events · journey not yet mapped</p>
      <div className="grid">{related.map((e) => <EventRow key={e.id} e={e} />)}</div>
    </Frame>
  );
}

export function SourcesPage() {
  return (
    <Frame eyebrow="Sources" title="Works cited" intro="Every event points to at least one of these. Citations are at work level; page references are still to be added.">
      <SourceList ids={sources.map((s) => s.id)} />
    </Frame>
  );
}

export function SavedPage() {
  const { items, remove } = useSaved();
  return (
    <Frame eyebrow="Saved" title="Saved moments" intro="Kept in this browser only.">
      {items.length === 0 && <p>Nothing saved yet. Open an event on the map and choose “Save moment”.</p>}
      <div className="grid">
        {items.map((s) => {
          const e = s.eventId ? eventById[s.eventId] : undefined;
          return (
            <div key={s.id} className="card card--light">
              <strong>{e?.title ?? formatDate(s.ms, s.scale)}</strong>
              <span className="muted">{e ? `${formatEventDate(e)} · ${e.place}` : 'Map moment'}{s.visibility && ` · ${s.visibility}`}</span>
              {s.note && <span>{s.note}</span>}
              <span className="chips">
                {e ? <Link className="link" to={`/?event=${e.id}`}>Open on map</Link> : <Link className="link" to={`/?year=${new Date(s.ms).getUTCFullYear()}`}>Open on map</Link>}
                <button type="button" className="link" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/?${e ? `event=${e.id}` : `year=${new Date(s.ms).getUTCFullYear()}`}`)}>Copy link</button>
                <button type="button" className="link" onClick={() => remove(s.id)}>Remove</button>
              </span>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}
