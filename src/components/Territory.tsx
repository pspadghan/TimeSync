import { consensus, controlClaims } from '../data/control';
import { formatArea, PALETTE, SIZE, type MappedRegion, type PolityInfo } from '../data/grid';
import { Link } from 'react-router-dom';
import { sourceById } from '../data/sources';
import { claimKey, useContributions } from '../state/contributions';

export interface Brush {
  mode: 'add' | 'remove';
  radius: number;
}

export function Swatch({ k }: { k: number }) {
  return <i className="swatch" style={{ background: PALETTE[k] }} />;
}

const BRUSHES = [{ label: 'Fine', radius: 1 }, { label: 'Medium', radius: 3 }, { label: 'Broad', radius: 6 }];
const LAST_YEAR = 1801;

/** Gains and losses of attested places for one power, in date order. */
function changes(name: string) {
  const holderAt = (place: string, year: number) => controlClaims.find((c) => c.place === place && c.from <= year && year < c.to)?.polity;
  return controlClaims
    .filter((c) => c.polity === name)
    .flatMap((c) => {
      const before = holderAt(c.place, c.from - 1);
      const after = holderAt(c.place, c.to);
      return [
        before !== name ? { year: c.from, text: `${c.place} ${before ? `taken from ${before}` : 'first recorded as held'}`, n: c.sourceIds.length } : null,
        c.to < LAST_YEAR && after !== name ? { year: c.to, text: after ? `${c.place} lost to ${after}` : `${c.place}: no claim entered from this year on (a gap in entry, not a recorded loss)`, n: c.sourceIds.length } : null,
      ];
    })
    .filter((x): x is { year: number; text: string; n: number } => !!x)
    .sort((a, b) => a.year - b.year);
}

interface Props {
  name: string;
  info?: PolityInfo;
  year: number;
  /** All drawn regions for this power, in force or not. */
  regions: MappedRegion[];
  brush: Brush | null;
  onBrush: (b: Brush | null) => void;
  onRegion: (r: MappedRegion) => void;
  onDeleteRegion: (id: string) => void;
  onBack: () => void;
}

export function TerritoryPanel({ name, info, year, regions, brush, onBrush, onRegion, onDeleteRegion, onBack }: Props) {
  const [attested, inferred, mapped, nearest] = info?.km2 ?? [0, 0, 0, 0];
  const log = changes(info?.power ?? name);
  const isDivision = !!info && info.power !== name;
  const { items } = useContributions();
  const added = (key: string, status: string) => items.filter((c) => c.targetKey === key && c.status === status).length;
  return (
    <>
      <button type="button" className="link" onClick={onBack}>‹ Events in extent</button>
      <div className="side__header">
        <p className="eyebrow">Territory · {year}</p>
        <h2>{info && <Swatch k={info.k} />} {name}</h2>
        {isDivision && <p className="accent">Division of the {info.power}</p>}
        {info?.under && <p className="muted">Acknowledged {info.under} as overlord.</p>}
      </div>

      <dl className="facts">
        <div className="facts__row"><dt>Places attested</dt><dd>{info?.claims.length ?? 0} in {year}, each at its own coordinates</dd></div>
        <div className="facts__row"><dt>Area mapped</dt><dd>{mapped ? formatArea(mapped) : 'None yet'} · from regions with their own sources</dd></div>
        {attested > 0 && <div className="facts__row"><dt>Area recorded</dt><dd>{formatArea(attested)} · districts assigned to it by dated record</dd></div>}
        {nearest > 0 && <div className="facts__row"><dt>Area by nearness</dt><dd>{formatArea(nearest)} · districts with no record, given to the power with the nearest attested place</dd></div>}
        {inferred > 0 && <div className="facts__row"><dt>Area enclosed</dt><dd>{formatArea(inferred)} · whole districts enclosed by its attested places</dd></div>}
      </dl>
      <p className="muted">A dot is a place a source names as held by this power. The pale area is the set of present-day districts those places enclose in this year. Its edges are real district boundaries; which districts belong is worked out from the attested places, not taken from a source. It changes whenever a place is gained or lost.</p>

      <p className="eyebrow eyebrow--bold">Places held in {year}</p>
      {!info?.claims.length && <p className="muted">None entered for this year.</p>}
      {info?.claims.map((c) => (
        <div key={c.place} className="card card--light">
          <strong>{c.capital && '★ '}{c.nameThen ?? c.place} · {c.from}–{c.to >= LAST_YEAR ? 'after 1800' : c.to}</strong>
          {c.capital && <span className="accent">Seat of government</span>}
          <span className="chips">
            <span className={`chip${c.sourceIds.length >= 2 ? ' chip--strong' : ''}`}>{consensus(c.sourceIds.length + added(claimKey(c), 'approved'))}</span>
            {added(claimKey(c), 'submitted') > 0 && <span className="chip">{added(claimKey(c), 'submitted')} awaiting review</span>}
          </span>
          <span className="muted">{c.sourceIds.map((id) => sourceById[id].title).join(' · ')}</span>
          {c.note && <span>{c.note}</span>}
          <span className="chips">
            <Link className="link" to={`/research/compare?target=${encodeURIComponent(claimKey(c))}`}>Compare sources</Link>
            <Link className="link" to={`/research/source?target=${encodeURIComponent(claimKey(c))}`}>Add a source</Link>
          </span>
          <span className="muted">Coordinates {c.lat.toFixed(3)}°N {c.lng.toFixed(3)}°E · ±{c.precisionKm} km · {c.coordStatus === 'verified' ? 'verified' : 'not yet verified'}</span>
        </div>
      ))}

      <p className="eyebrow eyebrow--bold">Changes on record{isDivision && ` · ${info.power}`}</p>
      {log.length === 0 && <p className="muted">No change of holder recorded.</p>}
      <ul className="changes">
        {log.map((c) => (
          <li key={`${c.year}-${c.text}`} className={c.year <= year ? '' : 'is-future'}><b>{c.year}</b> {c.text} <span className="muted">· {c.n} {c.n === 1 ? 'work' : 'works'}</span></li>
        ))}
      </ul>

      <p className="eyebrow eyebrow--bold">Map a region from sources</p>
      <p className="muted">Draw the area on the map, then record the years and the works that support it. One cell is about {Math.round(40075 / SIZE)} km wide at the equator.</p>
      <div className="options">
        <button type="button" className={`option${brush?.mode === 'add' ? ' is-on' : ''}`} onClick={() => onBrush({ mode: 'add', radius: brush?.radius ?? 3 })}>Expand</button>
        <button type="button" className={`option${brush?.mode === 'remove' ? ' is-on' : ''}`} onClick={() => onBrush({ mode: 'remove', radius: brush?.radius ?? 3 })}>Reduce</button>
        {brush && BRUSHES.map((b) => (
          <button key={b.label} type="button" className={`option${brush.radius === b.radius ? ' is-on' : ''}`} onClick={() => onBrush({ ...brush, radius: b.radius })}>{b.label}</button>
        ))}
        {brush && <button type="button" className="option" onClick={() => onBrush(null)}>Done</button>}
      </div>
      {brush && <p className="accent">Drag on the map to {brush.mode === 'add' ? 'add' : 'remove'} cells. Panning is off until you choose Done.</p>}
      {regions.map((r) => (
        <div key={r.id} className="card card--light region">
          <strong>{r.cells.length.toLocaleString('en-US')} cells drawn</strong>
          <label>From <input type="number" value={r.from} onChange={(e) => onRegion({ ...r, from: Number(e.target.value) })} /></label>
          <label>Until <input type="number" value={r.to} onChange={(e) => onRegion({ ...r, to: Number(e.target.value) })} /></label>
          <label className="region__sources">Supporting works, one per line
            <textarea rows={3} value={r.sources.join('\n')} onChange={(e) => onRegion({ ...r, sources: e.target.value.split('\n') })} placeholder="Author, title, page" />
          </label>
          <span className="chips">
            <span className="chip chip--strong">{consensus(r.sources.filter((s) => s.trim()).length)}</span>
            <button type="button" className="link" onClick={() => onDeleteRegion(r.id)}>Delete region</button>
          </span>
        </div>
      ))}
    </>
  );
}
