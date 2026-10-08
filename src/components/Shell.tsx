import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { countries } from '../data/countries';
import { events } from '../data/events';
import { people } from '../data/people';
import { formatEventDate } from '../data/time';
import { readProfile, roleAtLeast, type Role } from '../state/account';
import { useCollapse } from '../state/collapse';
import { useTime } from '../state/time';

const PRECISION_LABEL = { century: 'Century', year: 'Year', month: 'Month', day: 'Date', hour: 'Hour', minute: 'Minute' };

const NAV = [
  { to: '/', glyph: '⌖', label: 'Explore', end: true },
  { to: '/people', glyph: '▧', label: 'People' },
  { to: '/places', glyph: '◇', label: 'Places' },
  { to: '/events', glyph: '≋', label: 'Events' },
  { to: '/people/shivaji', glyph: '⌁', label: 'Journeys' },
  { to: '/kingdoms', glyph: '▤', label: 'Powers' },
  { to: '/deep-time', glyph: '◐', label: 'Deep time' },
  { to: '/sources', glyph: '◇', label: 'Sources' },
  { to: '/methodology', glyph: 'ℹ', label: 'Methodology' },
  { to: '/activity', glyph: '↺', label: 'Activity' },
];

function Search() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const hit = (s: string) => s.toLowerCase().includes(needle);
    return [
      ...people.filter((p) => hit(p.name) || p.aliases.some(hit) || hit(p.uid)).map((p) => ({ key: `p-${p.id}`, kind: `Person · ${p.uid}`, title: p.name, sub: `${p.born}–${p.died} · ${p.role}`, to: `/people/${p.id}` })),
      ...events.filter((e) => hit(e.title) || hit(e.place) || e.date.startsWith(needle)).map((e) => ({ key: `e-${e.id}`, kind: 'Event', title: e.title, sub: `${formatEventDate(e)} · ${e.place}`, to: `/?event=${e.id}` })),
      ...countries.filter((c) => hit(c.name)).map((c) => ({ key: `c-${c.name}`, kind: 'Country · present-day name', title: c.name, sub: 'Move the map here', to: `/?at=${c.lng.toFixed(2)},${c.lat.toFixed(2)},${c.zoom.toFixed(1)}` })),
    ].slice(0, 8);
  }, [q]);

  return (
    <form className="search" onBlur={() => window.setTimeout(() => setOpen(false), 150)} onSubmit={(e) => { e.preventDefault(); if (q.trim()) { navigate(`/search?q=${encodeURIComponent(q.trim())}`); setQ(''); setOpen(false); } }}>
      <img src="/assets/ui/icons/search.svg" alt="" width={13} height={13} />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search people, places, events"
        aria-label="Search people, places, events"
      />
      {open && q.trim().length >= 2 && (
        <ul className="search__results">
          {results.length === 0 && <li className="search__empty">No person or event in the dataset matches.</li>}
          {results.length > 0 && <li className="search__empty">Press Enter for all results</li>}
          {results.map((r) => (
            <li key={r.key}>
              <button type="button" onMouseDown={() => { navigate(r.to); setQ(''); setOpen(false); }}>
                <span className="eyebrow">{r.kind}</span>
                <strong>{r.title}</strong>
                <span>{r.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

export function TopBar({ status }: { status?: string }) {
  const { scale } = useTime();
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <Link to="/" className="wordmark">CHRONOSCOPE</Link>
        <p>{status ?? `One timeline, 200 million years ago to today · India’s records entered from memory, review pending · ${PRECISION_LABEL[scale]}-level precision`}</p>
      </div>
      <nav className="topbar__tools">
        <Search />
        <NavLink to="/start">Start</NavLink>
        <NavLink to="/research">Research</NavLink>
        <NavLink to="/admin">Admin</NavLink>
        <NavLink to="/compare">Compare</NavLink>
        <NavLink to="/saved">Saved</NavLink>
        <NavLink to="/library">Library</NavLink>
        <NavLink to="/account">{readProfile().name === 'Anonymous' ? 'Account' : readProfile().name}</NavLink>
      </nav>
    </header>
  );
}

export function LeftNav() {
  const [collapsed, toggle] = useCollapse('leftnav');
  return (
    <nav className={`leftnav${collapsed ? ' is-collapsed' : ''}`} aria-label="Sections">
      <button type="button" className="leftnav__toggle" onClick={toggle} title={collapsed ? 'Expand section labels' : 'Collapse to icons only'} aria-expanded={!collapsed}>
        {collapsed ? '›' : '‹'}
      </button>
      {NAV.map((n) => (
        <NavLink key={n.label} to={n.to} end={n.end} className="leftnav__item" title={collapsed ? n.label : undefined}>
          <span className="leftnav__glyph">{n.glyph}</span>
          {!collapsed && <span>{n.label}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

/** True browser connectivity, not a mock — the records themselves are all local/bundled, so
 * being offline only affects things that need the network: map tile fetches past what's cached,
 * and nothing in this app silently pretends to have fresher data than it does. */
function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

const ROLE_LABEL: Record<Role, string> = { reader: 'Reader', researcher: 'Researcher', admin: 'Administrator' };

/** Gates a screen behind a minimum role. This is a workspace convenience, not real security —
 * see the comment on Role in state/account.ts — so the way out is never "sign in" (there is
 * nothing to sign in to) but always "switch your role," which anyone can do from Account. */
export function RequireRole({ need, children }: { need: Role; children: ReactNode }) {
  const profile = readProfile();
  if (roleAtLeast(profile.role, need)) return <>{children}</>;
  return (
    <Page status={`Needs ${ROLE_LABEL[need]} access`}>
      <div className="workspace">
        <LeftNav />
        <main className="directory">
          <p className="eyebrow">Access boundary · evidence retained</p>
          <h1>This screen needs {ROLE_LABEL[need]} access</h1>
          <p className="muted directory__intro">
            You're currently working as {ROLE_LABEL[profile.role]}. Chronoscope's roles label who did what in the audit
            log and gate a few screens like this one — there's no sign-in behind it, so switching roles is immediate.
          </p>
          <div className="chips">
            <Link className="card" to="/account">Switch role in Account ›</Link>
            <Link className="link" to="/">Go to Explore</Link>
          </div>
        </main>
      </div>
    </Page>
  );
}

export function Page({ children, status }: { children: ReactNode; status?: string }) {
  const online = useOnline();
  return (
    <div className="app">
      <TopBar status={status} />
      {!online && (
        <div className="offline-banner" role="status">
          <strong>Offline.</strong> Territory, event-timing and person-tracking data come from this app's own local data service and won't update until you're reconnected — you're seeing whatever was already loaded. Map tiles or imagery you haven't scrolled to yet won't load either.
        </div>
      )}
      {children}
    </div>
  );
}
