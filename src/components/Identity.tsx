import type { Person } from '../data/types';

/** Everything that pins a record to exactly one human being. */
export function IdentityCard({ person }: { person: Person }) {
  const rows: [string, string | undefined][] = [
    ['Lived', `${person.born}–${person.died}`],
    ['House', person.house],
    ['Father', person.father],
    ['Mother', person.mother],
    ['Born at', person.birthPlace],
    ['Died at', person.deathPlace],
    ['Also recorded as', person.aliases.join(' · ')],
  ];
  return (
    <div className="card card--light identity">
      <div className="identity__head">
        <p className="eyebrow eyebrow--bold">Unique identity</p>
        <code>{person.uid}</code>
      </div>
      <dl className="facts">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="facts__row"><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      {person.namesakes && (
        <>
          <p className="eyebrow eyebrow--bold">Not the same person as</p>
          {person.namesakes.map((n) => (
            <p key={n.name}><strong>{n.name}</strong> ({n.life}) — {n.note}</p>
          ))}
        </>
      )}
      <p className="muted">A record is matched on name, lifespan and parentage together, never on name alone.</p>
    </div>
  );
}
