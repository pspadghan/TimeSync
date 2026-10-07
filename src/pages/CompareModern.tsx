import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import HistoricalMap, { type Spot } from '../components/HistoricalMap';
import ModernMap from '../components/ModernMap';
import { LeftNav, Page } from '../components/Shell';
import { places } from '../data/control';
import { useGrid, useRegions } from '../data/grid';
import { parts, yearLabel } from '../data/time';
import { logActivity } from '../state/recent';
import { useTime } from '../state/time';

const kmBetween = (a: { lng: number; lat: number }, b: { lng: number; lat: number }) => {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
/** The nearest attested place to a click, only if it's close enough to plausibly be what was clicked. */
const NEAR_KM = 10;
const nearestPlace = (lng: number, lat: number) => {
  let best: (typeof places)[number] | undefined;
  let bestKm = Infinity;
  for (const p of places) {
    const km = kmBetween({ lng, lat }, p);
    if (km < bestKm) { bestKm = km; best = p; }
  }
  return best && bestKm < NEAR_KM ? { place: best, km: bestKm } : undefined;
};

/**
 * Historical map next to a real present-day reference map, linked pan/zoom, so the same ground
 * can be read both ways at once — distinct from /compare (which puts two HISTORICAL dates next
 * to each other). Clicking a spot shows whatever is actually on record for it — a nearby attested
 * place's real name, coordinates and sources — never an invented "moved by 540m" style claim;
 * this project doesn't have per-place then/now deltas as data, and won't fabricate them as UI.
 */
export default function CompareModernPage() {
  const { ms } = useTime();
  const { regions } = useRegions();
  const year = parts(ms).y;
  const grid = useGrid(year, regions);
  const [center, setCenter] = useState<[number, number]>([78.02, 27.18]);
  const [zoom, setZoom] = useState(9);
  const [linked, setLinked] = useState(true);
  const [showHistoricalLabels, setShowHistoricalLabels] = useState(true);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [focus, setFocus] = useState<{ lng: number; lat: number; zoom?: number; key: string }>();

  const hit = spot ? nearestPlace(spot.lng, spot.lat) : undefined;

  useEffect(() => {
    logActivity({ id: 'comparison-modern', url: '/compare/modern', kind: 'comparison', title: 'Historical vs modern', sub: `Map date ${yearLabel(year)} · ${linked ? 'linked' : 'independent'} cameras` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, linked]);

  return (
    <Page status={`Historical vs modern · map date ${yearLabel(year)}`}>
      <div className="subbar">
        <div className="options">
          <button type="button" className={`option${linked ? ' is-on' : ''}`} onClick={() => setLinked((v) => !v)}>
            {linked ? '● Linked' : '○ Linked'}
          </button>
          <button type="button" className={`option${showHistoricalLabels ? ' is-on' : ''}`} onClick={() => setShowHistoricalLabels((v) => !v)}>
            {showHistoricalLabels ? '● Historical labels' : '○ Historical labels'}
          </button>
          <Link className="link" to="/compare">Date-to-date comparison instead ›</Link>
        </div>
        <p className="dim">{center[1].toFixed(2)}° N, {center[0].toFixed(2)}° E · zoom {zoom.toFixed(1)}{linked ? ' · panning moves both maps' : ' · maps move independently'}</p>
      </div>
      <div className="workspace">
        <LeftNav />
        <div className="compare">
          <HistoricalMap
            markers={[]}
            grid={grid}
            caption={`Historical · ${yearLabel(year)}`}
            focus={focus}
            onSpot={setSpot}
            onViewChange={(v) => { if (linked) { setCenter([(v.west + v.east) / 2, (v.south + v.north) / 2]); setZoom(v.zoom); } }}
          >
            <div className="map__status">
              <span className="tag tag--gold">HISTORICAL</span>
              {!showHistoricalLabels && <span className="tag">Labels hidden</span>}
            </div>
          </HistoricalMap>
          <ModernMap
            center={center}
            zoom={zoom}
            caption="Modern reference · OpenStreetMap-style demo tiles"
            onMoveEnd={(c, z) => {
              setCenter(c);
              setZoom(z);
              if (linked) setFocus({ lng: c[0], lat: c[1], zoom: z, key: `modern-${Date.now()}` });
            }}
          />
        </div>
        <aside className="side">
          <div className="side__header">
            <p className="eyebrow">Selected spot</p>
            <h2>{hit ? hit.place.name : spot ? 'No attested place here' : 'Click either map'}</h2>
            <p className="muted">
              {spot
                ? `${spot.lat.toFixed(3)}°N ${spot.lng.toFixed(3)}°E${spot.district ? ` · ${spot.district}` : ''}${spot.state ? `, ${spot.state}` : ''}`
                : 'Clicking a spot on either map shows what the records actually say about the nearest attested place, if any — real data only, nothing invented for this comparison.'}
            </p>
          </div>
          {hit && (
            <div className="card card--light">
              <strong>{hit.place.name}</strong>
              <span className="muted">{hit.place.lat.toFixed(4)}°N, {hit.place.lng.toFixed(4)}°E · ±{hit.place.precisionKm} km · {hit.place.coordStatus}</span>
              <span className="muted">{hit.km < 0.5 ? 'At the clicked spot' : `${hit.km.toFixed(1)} km from the clicked spot`}</span>
              {hit.place.coordSource && <span>{hit.place.coordSource}</span>}
              {hit.place.names?.length ? (
                <span className="muted">Also known as {hit.place.names.map((n) => `${n.name} (${n.from}–${n.to})`).join(', ')}</span>
              ) : null}
              <Link className="link" to={`/?place=${hit.place.id}`}>Open on the main map ›</Link>
            </div>
          )}
          {spot && !hit && (
            <p className="muted">No attested place is recorded within {NEAR_KM} km of this spot. The map still shows present-day geography here — it's the historical record that's silent, not the map.</p>
          )}
        </aside>
      </div>
    </Page>
  );
}
