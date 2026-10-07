import { sourceById } from '../data/sources';
import type { EvidenceState } from '../data/types';

export const EVIDENCE_STATES: EvidenceState[] = ['documented', 'corroborated', 'inferred', 'disputed', 'unknown'];

export const EVIDENCE_LABEL: Record<EvidenceState, string> = {
  documented: 'Documented',
  corroborated: 'Corroborated',
  inferred: 'Inferred',
  disputed: 'Disputed',
  unknown: 'Unknown',
};

export const EVIDENCE_MEANING: Record<EvidenceState, string> = {
  documented: 'Recorded by a participant or in a surviving document.',
  corroborated: 'Reported by two or more independent sources.',
  inferred: 'Not recorded directly; deduced from what is.',
  disputed: 'Sources or scholars disagree on a material point.',
  unknown: 'No evidence; shown only so the gap is visible.',
};

const KIND_LABEL = { primary: 'Primary', 'near-contemporary': 'Near-contemporary', scholarship: 'Scholarship' };

export function EvidenceLegend({ hidden, onToggle, inline }: { hidden?: Set<EvidenceState>; onToggle?: (s: EvidenceState) => void; inline?: boolean }) {
  if (inline) {
    return (
      <span className="legend--inline" title="Event evidence: click to hide or show a grade">
        {EVIDENCE_STATES.map((s) => (
          <button key={s} type="button" className={hidden?.has(s) ? 'is-hidden' : ''} aria-pressed={!hidden?.has(s)} title={EVIDENCE_MEANING[s]} onClick={() => onToggle?.(s)}>
            <img src={`/assets/ui/markers/legend-${s}.svg`} alt="" width={18} height={6} /> {EVIDENCE_LABEL[s]}
          </button>
        ))}
      </span>
    );
  }
  return (
    <div className="legend">
      <div className="legend__head">
        <strong>Evidence legend</strong>
        <span>{onToggle ? 'Click to filter' : 'Shape + line'}</span>
      </div>
      {EVIDENCE_STATES.map((s) => (
        <button key={s} type="button" className={`legend__row${hidden?.has(s) ? ' is-hidden' : ''}`} title={EVIDENCE_MEANING[s]} disabled={!onToggle} aria-pressed={!hidden?.has(s)} onClick={() => onToggle?.(s)}>
          <img src={`/assets/ui/markers/legend-${s}.svg`} alt="" width={24} height={8} />
          <span>{EVIDENCE_LABEL[s]}</span>
        </button>
      ))}
    </div>
  );
}

export function SourceList({ ids }: { ids: string[] }) {
  return (
    <ul className="sources">
      {ids.map((id) => {
        const s = sourceById[id];
        return (
          <li key={id}>
            <span className="tag">{KIND_LABEL[s.kind]}</span>
            <p><strong>{s.title}</strong></p>
            <p>{s.author} · {s.dated}</p>
            {s.note && <p className="muted">{s.note}</p>}
          </li>
        );
      })}
    </ul>
  );
}
