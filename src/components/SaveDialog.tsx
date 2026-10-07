import { useState } from 'react';
import { formatDate, type Scale } from '../data/time';
import type { Visibility } from '../state/saved';

const OPTIONS: { id: Visibility; label: string; text: string }[] = [
  { id: 'private', label: 'Private', text: 'Only in this browser.' },
  { id: 'team', label: 'Team', text: 'Marked for sharing with a team. Sharing itself needs a server and is not built.' },
  { id: 'public', label: 'Public', text: 'Marked as public. Anyone with the link can open the map at this moment.' },
];

interface Props {
  ms: number;
  scale: Scale;
  title: string;
  link: string;
  onSave: (note: string, visibility: Visibility) => void;
  onClose: () => void;
}

/** Name a moment, say who it is for, and copy a link to it. */
export default function SaveDialog({ ms, scale, title, link, onSave, onClose }: Props) {
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [copied, setCopied] = useState(false);

  return (
    <div className="dialog" role="dialog" aria-modal="true" aria-label="Save moment" onClick={onClose}>
      <div className="dialog__card" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow">Save moment</p>
        <h2>{title}</h2>
        <p className="muted">{formatDate(ms, scale)}</p>
        <label className="dialog__field"><span>Why you are saving it</span><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note for yourself or whoever opens it" autoFocus /></label>
        <div className="dialog__field">
          <span>Who it is for</span>
          {OPTIONS.map((o) => (
            <label key={o.id} className="dialog__option"><input type="radio" name="vis" checked={visibility === o.id} onChange={() => setVisibility(o.id)} /> <strong>{o.label}</strong> <em>{o.text}</em></label>
          ))}
        </div>
        <div className="dialog__field">
          <span>Link</span>
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <button type="button" className="link" onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied(true), () => undefined)}>{copied ? 'Copied' : 'Copy link'}</button>
        </div>
        <div className="options">
          <button type="button" className="option is-on" onClick={() => onSave(note.trim(), visibility)}>Save</button>
          <button type="button" className="option" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
