import { Link, useNavigate } from 'react-router-dom';
import { LeftNav, Page } from '../components/Shell';
import { useRecent, type RecentEntry } from '../state/recent';

const KIND_LABEL: Record<RecentEntry['kind'], string> = {
  map: 'MAP', person: 'PERSON', 'living-history': 'LIVING HISTORY', comparison: 'COMPARISON',
};

function timeAgo(at: number) {
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(at).toLocaleDateString();
}

/**
 * "Recent activity and return" — adapted from the Figma mockup, but honest about what this app
 * can actually restore. The mockup shows fine-grained saved state (an exact camera bearing, a
 * comparison divider at 48%, captions/sound toggles) that nothing in Chronoscope persists
 * anywhere — restoring here means navigating back to the URL that was open, which is exactly
 * as precise as the app's own deep-linking already is (a date, a selected event or person, a
 * comparison mode) and no more. This is an automatic log (state/recent.ts), separate from the
 * explicit "Save moment" feature on SavedPage.
 */
export default function RecentActivityPage() {
  const { items, clear } = useRecent();
  const navigate = useNavigate();

  return (
    <Page status="Activity · return to where the URL can take you">
      <div className="workspace">
        <LeftNav />
        <main className="directory">
          <div className="directory__header-row">
            <div>
              <p className="eyebrow">Return without losing your place</p>
              <h1>Recent activity</h1>
              <p className="muted directory__intro">
                Recorded automatically as you browse, kept in this browser only. Each entry restores exactly what its own
                link encodes — a date, a selected record, a mode — not finer state like camera angle, which nothing here
                saves yet.
              </p>
            </div>
            {items.length > 0 && <button type="button" className="option" onClick={clear}>Clear activity</button>}
          </div>
          {items.length === 0 && <p className="muted">Nothing recorded yet. Open an event, a person's journey, a Living History chapter or a comparison and it will appear here.</p>}
          <div className="grid">
            {items.map((it) => (
              <div key={it.id} className="card card--light">
                <span className="chips"><span className="chip chip--strong">{KIND_LABEL[it.kind]}</span><span className="muted">{timeAgo(it.at)}</span></span>
                <strong>{it.title}</strong>
                <span className="muted">{it.sub}</span>
                <span className="chips">
                  <button type="button" className="link" onClick={() => navigate(it.url)}>Restore ›</button>
                </span>
              </div>
            ))}
          </div>
          <p><Link className="link" to="/saved">‹ Explicitly saved moments instead</Link></p>
        </main>
      </div>
    </Page>
  );
}
