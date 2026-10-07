import { Link } from 'react-router-dom';
import { EVIDENCE_LABEL, EVIDENCE_MEANING, EVIDENCE_STATES } from '../components/Evidence';
import { LeftNav, Page } from '../components/Shell';
import { places } from '../data/control';
import { sources } from '../data/sources';
import { MAX_YEAR, MIN_YEAR, yearLabel } from '../data/time';

const KIND_LABEL = { primary: 'Primary', 'near-contemporary': 'Near-contemporary', scholarship: 'Scholarship' } as const;

/**
 * "About this map" — adapted from the Figma mockup's "Map attribution and methodology" state,
 * but with its content replaced throughout: the mockup shows fabricated specifics (a version
 * number, publish dates, per-source "Public domain"/"research use" licenses) that nothing in
 * this app's data actually tracks — sources.json has no rights field. What's real and shown
 * here instead: the actual evidence-state legend already used on the map, the actual coordinate
 * precision/verification counts, and the real works cited, grouped by kind, with no invented
 * rights claims attached to them.
 */
export default function Methodology() {
  const verified = places.filter((p) => p.coordStatus === 'verified').length;
  const byKind = (Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((k) => ({
    kind: k,
    list: sources.filter((s) => s.kind === k),
  }));

  return (
    <Page status="Map sources · methodology">
      <div className="workspace">
        <LeftNav />
        <main className="directory">
          <p className="eyebrow">About this map</p>
          <h1>How the map is built, and what it does and doesn't know</h1>
          <p className="muted directory__intro">
            Chronoscope separates what's attested from what's inferred, and never blends the two without saying so.
            This page explains how, with the project's real numbers — nothing here is invented to fill out a page.
          </p>

          <p className="eyebrow eyebrow--bold">Evidence states</p>
          <div className="grid">
            {EVIDENCE_STATES.map((s) => (
              <div key={s} className="card card--light">
                <strong>{EVIDENCE_LABEL[s]}</strong>
                <span className="muted">{EVIDENCE_MEANING[s]}</span>
              </div>
            ))}
          </div>

          <p className="eyebrow eyebrow--bold">Coordinates and territory fill</p>
          <div className="grid">
            <div className="card card--light">
              <strong>{verified} / {places.length} places verified</strong>
              <span className="muted">Checked against a survey or gazetteer reference, not just the citing work's own description.</span>
            </div>
            <div className="card card--light">
              <strong>Nearest-attested-place fill</strong>
              <span className="muted">A territory cell with no claim of its own is colored by whichever attested place is geographically nearest, drawn paler so it reads as inferred, not recorded — the same rule the map's own coverage note states live.</span>
            </div>
            <div className="card card--light">
              <strong>{yearLabel(MIN_YEAR)}–{yearLabel(MAX_YEAR)}</strong>
              <span className="muted">The timeline's full range. Territory and event coverage are not even across it — most records cluster 1500–1800; see the map's own "no reconstructed territory" notice for any date with none at all.</span>
            </div>
            <div className="card card--light">
              <strong>Web Mercator display, WGS84 storage</strong>
              <span className="muted">Every coordinate is stored as plain WGS84 latitude/longitude; MapLibre projects it to Web Mercator for display, same as the base map underneath.</span>
            </div>
          </div>

          <p className="eyebrow eyebrow--bold">Naming</p>
          <div className="grid">
            <div className="card card--light">
              <strong>Present-day names by default</strong>
              <span className="muted">The map shows current state and district names until a historical date is selected.</span>
            </div>
            <div className="card card--light">
              <strong>Period names on a valid date</strong>
              <span className="muted">A place's historical name only appears for the years a source actually records it under that name — see each place's own record for its dated name history.</span>
            </div>
          </div>

          <p className="eyebrow eyebrow--bold">Works cited · {sources.length} total</p>
          {byKind.map(({ kind, list }) => list.length > 0 && (
            <div key={kind}>
              <p className="muted" style={{ marginBottom: 6 }}>{KIND_LABEL[kind]} · {list.length}</p>
              <div className="grid" style={{ marginBottom: 18 }}>
                {list.map((s) => (
                  <div key={s.id} className="card card--light">
                    <strong>{s.title}</strong>
                    <span className="muted">{s.author} · {s.dated}</span>
                    {s.note && <span>{s.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="muted">Rights and license status per source are not tracked yet — not shown here rather than guessed.</p>
          <p><Link className="link" to="/sources">‹ Full source list</Link></p>
        </main>
      </div>
    </Page>
  );
}
