import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { TopBar } from '../components/Shell';
import { consensus, controlClaims, places, SETTLED_AT } from '../data/control';
import { sourceById } from '../data/sources';
import { citation, targetByKey, targets, useContributions, validate, type SourceContribution, type Status } from '../state/contributions';
import { logDecision } from '../state/audit';
import { check, PROPOSAL_TYPES, sourceLines, useProposals, type Proposal, type ProposalType } from '../state/proposals';

const KIND = { primary: 'Primary', 'near-contemporary': 'Near-contemporary', scholarship: 'Modern scholarship' };
const STATUS: Record<Status, string> = { draft: 'Draft', submitted: 'Awaiting review', approved: 'Approved', returned: 'Returned for changes' };

const TYPES: { title: string; evidence: string; review: string; need: string; to?: string }[] = [
  { title: 'Add source', evidence: 'Citation + page + excerpt', review: 'Standard review', need: 'Linked claim required', to: '/research/source' },
  { title: 'Compare sources', evidence: 'Works already cited for one claim', review: 'No review needed', need: 'Read only', to: '/research/compare' },
  { title: 'Map a region', evidence: 'Drawn area + years + supporting works', review: 'Spatial review', need: 'Geo + time required', to: '/' },
  { title: 'Correct claim', evidence: '2 supporting sources + reasoning', review: 'Senior review', need: 'Geo + time required', to: '/research/propose?type=correction' },
  { title: 'Suggest person', evidence: 'Identity evidence + names', review: 'Identity review', need: 'Time required', to: '/research/propose?type=person' },
  { title: 'Add event', evidence: 'Primary or corroborated source', review: 'Event review', need: 'Geo + time required', to: '/research/propose?type=event' },
  { title: 'Add place', evidence: 'Historical name + coordinate evidence', review: 'Spatial review', need: 'Geo required', to: '/research/propose?type=place' },
  { title: 'Propose route', evidence: 'Stage evidence + route rationale', review: 'Spatial review', need: 'Geo + time required', to: '/research/propose?type=route' },
  { title: 'Merge duplicate', evidence: 'Matching evidence + retained identity', review: 'Data steward review', need: 'Geo/time inherited', to: '/research/propose?type=merge' },
];

function Frame({ eyebrow, title, context, actions, children }: { eyebrow: string; title: string; context?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="app">
      <TopBar status="Research workspace · kept in this browser · no sign-in yet" />
      <div className="rhead">
        <div>
          <p className="eyebrow gold">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <div className="rhead__side">
          {context && <p className="dim">{context}</p>}
          {actions}
        </div>
      </div>
      <main className="research">{children}</main>
    </div>
  );
}

export function ResearchHome() {
  const { items, remove } = useContributions();
  const proposals = useProposals();
  return (
    <Frame eyebrow="Researcher" title="Choose a contribution type" context={`${items.length} contribution${items.length === 1 ? '' : 's'} in this browser`} actions={<Link className="option" to="/admin">Review queue</Link>}>
      <div className="rgrid">
        {TYPES.map((t) => {
          const body = (
            <>
              <h2>{t.title}</h2>
              <p>◆ Evidence · {t.evidence}</p>
              <p className="dim">◷ {t.review}</p>
              <span className={`tag ${t.to ? 'tag--gold' : ''}`}>{t.to ? t.need : 'Not built yet'}</span>
            </>
          );
          return t.to ? <Link key={t.title} className="rcard is-link" to={t.to}>{body}</Link> : <div key={t.title} className="rcard is-off">{body}</div>;
        })}
      </div>

      <h2 className="rsection">Your contributions</h2>
      {items.length + proposals.items.length === 0 && <p className="dim">Nothing yet. Add a source to move a claim toward the {SETTLED_AT}-work threshold.</p>}
      <div className="rgrid">
        {proposals.items.map((p) => (
          <div key={p.id} className="rcard">
            <h2>{PROPOSAL_TYPES[p.type].title} · {p.subject || 'Untitled'}</h2>
            <p>{p.change}</p>
            <span className={`tag ${p.status === 'approved' ? 'tag--green' : 'tag--gold'}`}>{STATUS[p.status]}</span>
            {p.reviewNote && <p className="rust">Reviewer: {p.reviewNote}</p>}
            <div className="options">
              {p.status !== 'approved' && <Link className="option" to={`/research/propose?type=${p.type}&id=${p.id}`}>Edit</Link>}
              <button type="button" className="option" onClick={() => proposals.remove(p.id)}>Delete</button>
            </div>
          </div>
        ))}
        {items.map((c) => (
          <div key={c.id} className="rcard">
            <h2>{c.title || 'Untitled source'}</h2>
            <p>{targetByKey.get(c.targetKey)?.label ?? 'Not linked to a claim'}</p>
            <span className={`tag ${c.status === 'approved' ? 'tag--green' : 'tag--gold'}`}>{STATUS[c.status]}</span>
            {c.reviewNote && <p className="rust">Reviewer: {c.reviewNote}</p>}
            <div className="options">
              {c.status !== 'approved' && <Link className="option" to={`/research/source?id=${c.id}`}>Edit</Link>}
              <button type="button" className="option" onClick={() => remove(c.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

const EMPTY: Omit<SourceContribution, 'id' | 'status' | 'savedAt'> = {
  targetKey: '', sourceType: '', title: '', author: '', publication: '', page: '', language: '', translation: '', excerpt: '', digitizedCopy: '', rights: '', link: '',
};

const FIELDS: { key: keyof typeof EMPTY; label: string; hint: string; long?: boolean }[] = [
  { key: 'sourceType', label: 'Source type', hint: 'Court chronicle, letter, inscription, traveller’s account…' },
  { key: 'title', label: 'Title', hint: 'Title of the work or document' },
  { key: 'author', label: 'Author / archive', hint: 'Who wrote it, or which archive holds it' },
  { key: 'publication', label: 'Publication / date', hint: 'Edition, manuscript date or year of publication' },
  { key: 'page', label: 'Page', hint: 'Page or folio where the passage is found' },
  { key: 'language', label: 'Original language', hint: 'Persian, Marathi, Portuguese…' },
  { key: 'translation', label: 'Translation', hint: 'Translator and edition, if you used one' },
  { key: 'excerpt', label: 'Original excerpt', hint: 'The passage that supports the claim, as written', long: true },
  { key: 'digitizedCopy', label: 'Digitized copy', hint: 'Shelfmark or scan reference' },
  { key: 'rights', label: 'Rights', hint: 'Public domain, by permission, restricted…' },
  { key: 'link', label: 'External link', hint: 'Stable address of the catalogue record or scan' },
];

export function AddSource() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { items, save } = useContributions();
  const existing = items.find((c) => c.id === params.get('id'));
  const [form, setForm] = useState<SourceContribution>(() => existing ?? { ...EMPTY, targetKey: params.get('target') ?? '', id: `src-${Date.now()}`, status: 'draft', savedAt: 0 });
  const target = targetByKey.get(form.targetKey);
  const warnings = validate(form);
  const blocked = warnings.some((w) => w.blocking);
  const store = (status: Status) => {
    save({ ...form, status, reviewNote: undefined });
    navigate('/research');
  };

  return (
    <Frame
      eyebrow="Researcher"
      title="Add evidence or source"
      context="Structured submission"
      actions={<><button type="button" className="option" onClick={() => store('draft')}>Save draft</button><button type="button" className="option is-on" disabled={blocked} onClick={() => store('submitted')}>Submit for review</button></>}
    >
      <div className="rsplit">
        <form className="rform" onSubmit={(e) => e.preventDefault()}>
          <label>
            <span>Claim supported</span>
            <select value={form.targetKey} onChange={(e) => setForm({ ...form, targetKey: e.target.value })}>
              <option value="">Choose the claim or event this source supports</option>
              {(['Territory claim', 'Event'] as const).map((kind) => (
                <optgroup key={kind} label={kind}>
                  {targets.filter((t) => t.kind === kind).map((t) => <option key={t.key} value={t.key}>{t.label} · {t.when}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          {FIELDS.map((f) => (
            <label key={f.key}>
              <span>{f.label}</span>
              {f.long
                ? <textarea rows={3} value={form[f.key]} placeholder={f.hint} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                : <input value={form[f.key]} placeholder={f.hint} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />}
            </label>
          ))}
        </form>

        <div className="rstack">
          <div className="rcard">
            <h2>Citation preview</h2>
            <p className="rcite">{citation(form)}</p>
          </div>
          <div className="rcard">
            <h2>Map / date association</h2>
            {target ? (
              <>
                <p>⌖ {target.where}</p>
                <p>◷ {target.when}</p>
                <p className="dim">Taken from the linked {target.kind.toLowerCase()}, so the source cannot be attached to the wrong place or date.</p>
                <p>{consensus(target.sourceIds.length)} before this submission</p>
              </>
            ) : <p className="dim">Link a claim to see where and when this source applies.</p>}
          </div>
          <div className="rcard">
            <h2>Validation warnings</h2>
            {warnings.length === 0 && <p className="green">● Nothing missing.</p>}
            {warnings.map((w) => <p key={w.text} className={w.blocking ? 'rust' : 'gold'}>△ {w.text}{w.blocking && ' Required before submitting.'}</p>)}
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** One form for every kind of proposal: what should change, why, and on what evidence. */
export function Propose() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { items, save } = useProposals();
  const type = (params.get('type') && params.get('type')! in PROPOSAL_TYPES ? params.get('type') : 'correction') as ProposalType;
  const kind = PROPOSAL_TYPES[type];
  const [form, setForm] = useState<Proposal>(() => items.find((p) => p.id === params.get('id')) ?? { id: `prop-${Date.now()}`, type, status: 'draft', savedAt: 0, subject: '', change: '', reasoning: '', sources: '' });
  const problems = check(form);
  const blocked = problems.some((p) => p.blocking);
  const store = (status: Status) => {
    save({ ...form, type, status, reviewNote: undefined });
    navigate('/research');
  };
  const set = (key: 'subject' | 'change' | 'reasoning' | 'sources') => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  return (
    <Frame
      eyebrow="Researcher"
      title={kind.title}
      context={kind.review}
      actions={<><button type="button" className="option" onClick={() => store('draft')}>Save draft</button><button type="button" className="option is-on" disabled={blocked} onClick={() => store('submitted')}>Submit for review</button></>}
    >
      <div className="rsplit">
        <form className="rform" onSubmit={(e) => e.preventDefault()}>
          <label><span>Subject</span><input value={form.subject} onChange={set('subject')} placeholder="The record, person, place or event this concerns" /></label>
          <label><span>Proposed change</span><textarea rows={4} value={form.change} onChange={set('change')} placeholder={kind.ask} /></label>
          <label><span>Reasoning</span><textarea rows={4} value={form.reasoning} onChange={set('reasoning')} placeholder="How the sources support this, and what they do not establish" /></label>
          <label><span>Supporting works · one per line, with page or folio</span><textarea rows={4} value={form.sources} onChange={set('sources')} placeholder="Author, title, edition, page" /></label>
        </form>
        <div className="rstack">
          <div className="rcard">
            <h2>What a reviewer will check</h2>
            <p>{kind.ask}</p>
            <p className="dim">◷ {kind.review} · needs at least {kind.minSources} supporting {kind.minSources === 1 ? 'work' : 'works'}</p>
            <p>{consensus(sourceLines(form).length)}</p>
          </div>
          <div className="rcard">
            <h2>Validation warnings</h2>
            {problems.length === 0 && <p className="green">● Nothing missing.</p>}
            {problems.map((w) => <p key={w.text} className={w.blocking ? 'rust' : 'gold'}>△ {w.text}{w.blocking && ' Required before submitting.'}</p>)}
          </div>
          <p className="dim">An approved proposal is recorded as accepted. It changes the map only once it has been entered into the records.</p>
        </div>
      </div>
    </Frame>
  );
}

export function CompareSources() {
  const [params, setParams] = useSearchParams();
  const { items } = useContributions();
  const key = params.get('target') ?? targets.find((t) => t.sourceIds.length >= 3)?.key ?? targets[0].key;
  const target = targetByKey.get(key)!;
  const added = items.filter((c) => c.targetKey === key && c.status !== 'draft');
  const approved = added.filter((c) => c.status === 'approved').length;
  const early = target.sourceIds.filter((id) => sourceById[id].kind !== 'scholarship').length;

  return (
    <Frame eyebrow="Researcher" title="Source comparison" context={`${target.sourceIds.length + added.length} references linked to this ${target.kind.toLowerCase()}`} actions={<Link className="option is-on" to={`/research/source?target=${encodeURIComponent(key)}`}>Add a source for this</Link>}>
      <label className="rpick">
        <span>Compare the works cited for</span>
        <select value={key} onChange={(e) => setParams({ target: e.target.value })}>
          {(['Territory claim', 'Event'] as const).map((kind) => (
            <optgroup key={kind} label={kind}>
              {targets.filter((t) => t.kind === kind).map((t) => <option key={t.key} value={t.key}>{t.label} · {t.when} · {t.sourceIds.length} works</option>)}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="rgrid">
        {target.sourceIds.map((id, i) => {
          const s = sourceById[id];
          return (
            <div key={id} className="rcard">
              <h2>Reference {String.fromCharCode(65 + i)} · {s.title}</h2>
              <span className="tag tag--green">● Cited for: {target.when} / {target.where.split(' · ')[0]}</span>
              <dl className="rdl">
                <dt>Provenance</dt><dd>{KIND[s.kind]} · {s.author} · {s.dated}</dd>
                <dt>Reliability context</dt><dd>{s.note ?? 'No note recorded.'}</dd>
                <dt>Page / excerpt</dt><dd className="rust">Not yet entered. This is a work-level citation.</dd>
              </dl>
            </div>
          );
        })}
        {added.map((c) => (
          <div key={c.id} className="rcard">
            <h2>Submitted · {c.title}</h2>
            <span className={`tag ${c.status === 'approved' ? 'tag--green' : 'tag--gold'}`}>{STATUS[c.status]}</span>
            <dl className="rdl">
              <dt>Provenance</dt><dd>{[c.sourceType, c.author, c.publication].filter(Boolean).join(' · ')}</dd>
              <dt>Page</dt><dd>{c.page || '—'}</dd>
              <dt>Original excerpt</dt><dd>{c.excerpt || '—'}</dd>
              <dt>Translation</dt><dd>{c.translation || '—'}</dd>
              <dt>Rights</dt><dd>{c.rights || '—'}</dd>
            </dl>
          </div>
        ))}
      </div>

      <div className="rcard">
        <h2>Agreement and contradiction</h2>
        <p className="green">● {target.sourceIds.length + approved} approved work{target.sourceIds.length + approved === 1 ? '' : 's'} cited for this statement; {early} written in or near the period.</p>
        <p className={target.sourceIds.length + approved >= SETTLED_AT ? 'green' : 'gold'}>◆ {consensus(target.sourceIds.length + approved)}. {Math.max(0, SETTLED_AT - target.sourceIds.length - approved)} more needed to treat it as settled.</p>
        <p className="rust">≠ Wording has not been compared: the built-in works are cited without page or excerpt, so real agreement between them is still to be checked.</p>
      </div>
    </Frame>
  );
}

export function AdminReview() {
  const { items, save } = useContributions();
  const proposals = useProposals();
  const waiting = proposals.items.filter((p) => p.status === 'submitted');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const queue = items.filter((c) => c.status === 'submitted');
  const stats = useMemo(() => {
    const approvedFor = (key: string) => items.filter((c) => c.targetKey === key && c.status === 'approved').length;
    const totals = targets.filter((t) => t.kind === 'Territory claim').map((t) => t.sourceIds.length + approvedFor(t.key));
    return [
      { label: 'Territory claims', value: controlClaims.length, detail: `${totals.filter((n) => n >= SETTLED_AT).length} settled (${SETTLED_AT}+ works)` },
      { label: 'Single-source claims', value: totals.filter((n) => n === 1).length, detail: 'Most in need of a second work' },
      { label: 'Coordinates verified', value: `${places.filter((p) => p.coordStatus === 'verified').length} / ${places.length}`, detail: 'Each place needs a survey or gazetteer reference' },
      { label: 'Awaiting review', value: queue.length, detail: `${items.filter((c) => c.status === 'approved').length} approved so far` },
    ];
  }, [items, queue.length]);
  const decide = (c: SourceContribution, status: Status) => {
    logDecision({ kind: 'source', subject: c.title, decision: status === 'approved' ? 'approved' : 'returned', note: notes[c.id]?.trim() || undefined });
    save({ ...c, status, reviewNote: notes[c.id]?.trim() || undefined });
  };
  const decideProposal = (p: Proposal, status: Status) => {
    logDecision({ kind: 'proposal', subject: `${PROPOSAL_TYPES[p.type].title} · ${p.subject}`, decision: status === 'approved' ? 'approved' : 'returned', note: notes[p.id]?.trim() || undefined });
    proposals.save({ ...p, status, reviewNote: notes[p.id]?.trim() || undefined });
  };

  return (
    <Frame eyebrow="Admin" title="Evidence operations" context="Review queue and data quality" actions={<><Link className="option" to="/admin/people">People</Link><Link className="option" to="/admin/records">Records</Link><Link className="option" to="/admin/audit">Audit</Link><Link className="option" to="/research">Research workspace</Link></>}>
      <div className="rgrid rgrid--4">
        {stats.map((s) => (
          <div key={s.label} className="rcard">
            <p className="eyebrow gold">{s.label}</p>
            <p className="rstat">{s.value}</p>
            <p className="dim">{s.detail}</p>
          </div>
        ))}
      </div>

      <h2 className="rsection">Review queue</h2>
      {queue.length + waiting.length === 0 && <p className="dim">No submissions are waiting.</p>}
      {waiting.map((p) => (
        <div key={p.id} className="rcard rreview">
          <div>
            <h2>{PROPOSAL_TYPES[p.type].title} · {p.subject}</h2>
            <p>{p.change}</p>
            {p.reasoning && <p className="dim">Reasoning: {p.reasoning}</p>}
            {sourceLines(p).map((s) => <p key={s} className="rcite">{s}</p>)}
            {check(p).map((w) => <p key={w.text} className="gold">△ {w.text}</p>)}
          </div>
          <div className="rstack">
            <textarea rows={3} placeholder="Reason for the decision (shown to the researcher)" value={notes[p.id] ?? ''} onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })} />
            <div className="options">
              <button type="button" className="option is-on" onClick={() => decideProposal(p, 'approved')}>Approve</button>
              <button type="button" className="option" onClick={() => decideProposal(p, 'returned')}>Return for changes</button>
            </div>
          </div>
        </div>
      ))}
      {queue.map((c) => {
        const target = targetByKey.get(c.targetKey);
        const warnings = validate(c);
        return (
          <div key={c.id} className="rcard rreview">
            <div>
              <h2>{c.title}</h2>
              <p className="rcite">{citation(c)}</p>
              <p>Supports: {target?.label} · {target?.when}</p>
              <p className="dim">Now: {consensus(target?.sourceIds.length ?? 0)} · approving adds one work</p>
              {c.excerpt && <p className="rquote">“{c.excerpt}”</p>}
              {warnings.map((w) => <p key={w.text} className="gold">△ {w.text}</p>)}
            </div>
            <div className="rstack">
              <textarea rows={3} placeholder="Reason for the decision (shown to the researcher)" value={notes[c.id] ?? ''} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} />
              <div className="options">
                <button type="button" className="option is-on" onClick={() => decide(c, 'approved')}>Approve</button>
                <button type="button" className="option" onClick={() => decide(c, 'returned')}>Return for changes</button>
              </div>
            </div>
          </div>
        );
      })}
    </Frame>
  );
}
