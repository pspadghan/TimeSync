import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { personById } from '../data/people';
import { CALENDAR_LABEL, formatEventDate } from '../data/time';
import type { HistEvent } from '../data/types';
import { EVIDENCE_LABEL, EVIDENCE_MEANING } from './Evidence';

interface Props {
  event: HistEvent;
  /** Resume playback from this moment; omitted when the event was opened by hand. */
  onContinue?: () => void;
  onClose: () => void;
}

/** A live event, projected over the whole screen: what happened, where, who was there, and how firmly it is known. */
export default function EventProjection({ event: e, onContinue, onClose }: Props) {
  useEffect(() => {
    const key = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  return (
    <div className="projection" role="dialog" aria-modal="true" aria-label={e.title}>
      {e.image && <img className="projection__image" src={e.image} alt="" />}
      <div className="projection__body">
        <p className="eyebrow">{formatEventDate(e)} · {e.place}</p>
        <h1>{e.title}</h1>
        <p className="projection__lead">{e.summary}</p>
        <p className="projection__why">{e.whyItMatters}</p>
        <div className="projection__meta">
          <span className="tag tag--gold" title={EVIDENCE_MEANING[e.evidence]}>{EVIDENCE_LABEL[e.evidence]}</span>
          <span className="tag">{CALENDAR_LABEL[e.calendar]}</span>
          {e.image && <span className="tag">Illustrative reconstruction, not a historical image</span>}
        </div>
        <p className="projection__note">{e.evidenceNote}</p>
        {e.personIds.length > 0 && (
          <p className="projection__people">Present: {e.personIds.map((id) => personById[id]?.name).filter(Boolean).join(' · ')}</p>
        )}
        <div className="options">
          {onContinue && <button type="button" className="playbtn" onClick={onContinue}>▶ Continue</button>}
          {e.sceneId && <Link className="option is-on" to={`/living/${e.sceneId}`}>Enter Living History</Link>}
          <button type="button" className="option" onClick={onClose}>{onContinue ? 'Stay paused' : 'Close'}</button>
        </div>
      </div>
    </div>
  );
}
