import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TopBar } from '../components/Shell';
import { places } from '../data/control';
import { countries } from '../data/countries';
import { events } from '../data/events';
import { people } from '../data/people';
import { formatEventDate, MAX_YEAR, MIN_YEAR, yearLabel } from '../data/time';
import { useTime } from '../state/time';

const ERAS = [
  { label: 'Indus cities', year: -2500 }, { label: 'Maurya Empire', year: -250 }, { label: 'Gupta Empire', year: 400 }, { label: 'Chola Empire', year: 1030 },
  { label: 'Delhi Sultanate', year: 1340 }, { label: 'Vijayanagara', year: 1520 }, { label: 'Mughal Empire', year: 1690 }, { label: 'Maratha power', year: 1760 },
  { label: 'British Raj', year: 1900 }, { label: 'Independence', year: 1947 }, { label: 'Today', year: MAX_YEAR },
];

/** Entry screen: choose what, where and when, and go straight to it on the map. */
export default function Start() {
  const navigate = useNavigate();
  const { setDeep, setMa, setPlaying } = useTime();
  const [what, setWhat] = useState('');
  const [where, setWhere] = useState('');
  const [when, setWhen] = useState('');

  const go = () => {
    if (what.startsWith('event:')) return navigate(`/?event=${what.slice(6)}`);
    if (what.startsWith('person:')) return navigate(`/people/${what.slice(7)}`);
    const params = new URLSearchParams();
    const year = Number(when);
    if (when.trim() && Number.isFinite(year)) params.set('year', String(Math.min(MAX_YEAR, Math.max(MIN_YEAR, Math.round(year)))));
    if (where.startsWith('place:')) params.set('place', where.slice(6));
    const country = countries.find((c) => `country:${c.name}` === where);
    if (country) params.set('at', `${country.lng.toFixed(2)},${country.lat.toFixed(2)},${country.zoom.toFixed(1)}`);
    navigate(`/?${params}`);
  };
  const fromTheBeginning = () => {
    setDeep(true);
    setMa(200);
    setPlaying(true);
    navigate('/');
  };

  return (
    <div className="app">
      <TopBar status="Choose what, where and when" />
      <main className="start">
        <p className="eyebrow gold">Chronoscope</p>
        <h1>Walk through the history of Jambudvipa</h1>
        <p className="start__lede">One timeline, from the Indian landmass leaving Gondwana 200 million years ago to {yearLabel(MAX_YEAR)}. Every territory, place and event on the map carries the sources it rests on, and says so where the record is thin.</p>

        <div className="start__actions">
          <button type="button" className="playbtn" onClick={fromTheBeginning}>▶ Play from the beginning</button>
          <Link className="option" to="/">Open the map</Link>
          <Link className="option" to="/kingdoms">Browse the powers</Link>
        </div>

        <div className="start__grid">
          <label className="rcard">
            <h2>What</h2>
            <p className="dim">A person or an event to go straight to.</p>
            <select value={what} onChange={(e) => setWhat(e.target.value)}>
              <option value="">Anything</option>
              <optgroup label="People">{people.map((p) => <option key={p.id} value={`person:${p.id}`}>{p.name} · {p.born}–{p.died}</option>)}</optgroup>
              <optgroup label="Events">{[...events].sort((a, b) => a.date.localeCompare(b.date)).map((e) => <option key={e.id} value={`event:${e.id}`}>{e.title} · {formatEventDate(e)}</option>)}</optgroup>
            </select>
          </label>
          <label className="rcard">
            <h2>Where</h2>
            <p className="dim">A recorded place, or a present-day country to centre on.</p>
            <select value={where} onChange={(e) => setWhere(e.target.value)} disabled={!!what}>
              <option value="">The whole subcontinent</option>
              <optgroup label="Recorded places">{[...places].sort((a, b) => a.name.localeCompare(b.name)).map((p) => <option key={p.id} value={`place:${p.id}`}>{p.name}</option>)}</optgroup>
              <optgroup label="Present-day countries">{countries.map((c) => <option key={c.name} value={`country:${c.name}`}>{c.name}</option>)}</optgroup>
            </select>
          </label>
          <label className="rcard">
            <h2>When</h2>
            <p className="dim">A year from {yearLabel(MIN_YEAR)} to {MAX_YEAR}. Use a minus sign for BCE.</p>
            <input type="number" min={MIN_YEAR} max={MAX_YEAR} value={when} onChange={(e) => setWhen(e.target.value)} placeholder="e.g. 1666 or -250" disabled={!!what} />
            <div className="options">{ERAS.map((e) => <button key={e.label} type="button" className="option" disabled={!!what} onClick={() => setWhen(String(e.year))}>{e.label}</button>)}</div>
          </label>
        </div>
        <button type="button" className="playbtn start__go" onClick={go}>Go there</button>
      </main>
    </div>
  );
}
