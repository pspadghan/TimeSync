import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TopBar } from '../components/Shell';
import { useAudit } from '../state/audit';
import { useContributions } from '../state/contributions';
import { useProposals } from '../state/proposals';
import { useSaved } from '../state/saved';
import { useProfile, type Role } from '../state/account';

const ROLES: { id: Role; label: string; text: string }[] = [
  { id: 'reader', label: 'Reader', text: 'Explore the map, people and events, save moments and share links.' },
  { id: 'researcher', label: 'Researcher', text: 'Also add sources and propose corrections, people, events, places, routes and merges.' },
  { id: 'admin', label: 'Admin', text: 'Also review submissions and check the records.' },
];

/** Who is working. Local to this browser: there is no password and no server account. */
export default function Account() {
  const { profile, save } = useProfile();
  const [name, setName] = useState(profile.name === 'Anonymous' ? '' : profile.name);
  const [role, setRole] = useState<Role>(profile.role);
  const [done, setDone] = useState(false);
  const saved = useSaved().items.length;
  const sources = useContributions().items.length;
  const proposals = useProposals().items.length;
  const decisions = useAudit().length;

  return (
    <div className="app">
      <TopBar status="Account · kept in this browser only" />
      <main className="start">
        <p className="eyebrow gold">Account</p>
        <h1>Who is working</h1>
        <p className="start__lede">Your name and role are stored in this browser and put on the work you do, for example the reviews in the audit log. There is no password and no sign-in with a server, so switching role here is immediate and anyone can do it — but Research and Admin screens do check it and will turn you back here if you're not at least Researcher or Admin.</p>
        <form className="start__grid" onSubmit={(e) => { e.preventDefault(); save({ name: name.trim() || 'Anonymous', role }); setDone(true); }}>
          <label className="rcard">
            <h2>Name</h2>
            <input value={name} onChange={(e) => { setName(e.target.value); setDone(false); }} placeholder="As it should appear on your work" />
          </label>
          {ROLES.map((r) => (
            <label key={r.id} className={`rcard${role === r.id ? ' is-link' : ''}`}>
              <h2><input type="radio" name="role" checked={role === r.id} onChange={() => { setRole(r.id); setDone(false); }} /> {r.label}</h2>
              <p className="dim">{r.text}</p>
            </label>
          ))}
          <div className="rcard">
            <h2>In this browser</h2>
            <p>{saved} saved moment{saved === 1 ? '' : 's'} · {sources} source submission{sources === 1 ? '' : 's'} · {proposals} proposal{proposals === 1 ? '' : 's'} · {decisions} review decision{decisions === 1 ? '' : 's'}</p>
            <Link className="link" to="/library">Open the library</Link>
          </div>
          <button type="submit" className="playbtn start__go">{done ? 'Saved' : 'Save'}</button>
        </form>
      </main>
    </div>
  );
}
