import { useEffect, useMemo, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import { useDeepContext } from '../data/api';
import type { DeepView } from './HistoricalMap';

// The deep-time stretch of the timeline. Continental positions come from a published plate
// model (built by scripts/build-deeptime.mjs); stage text and world events come from the
// database. Nothing here is placed by hand.
interface Snapshot {
  ma: number;
  refs: Record<string, [number, number]>;
  indiaCmPerYear: number | null;
}
interface Index {
  model: string;
  step: number;
  indiaRef: [number, number];
  snapshots: Snapshot[];
}

const LAND_NAME: Record<string, string> = {
  india: 'Indian landmass', madagascar: 'Madagascar', africa: 'Africa', arabia: 'Arabia', eurasia: 'Eurasia', antarctica: 'Antarctica', australia: 'Australia',
};
const NEAR_MA = 6;
const coasts = new Map<number, Promise<FeatureCollection>>();
let indexRequest: Promise<Index> | null = null;

const fmt = ([lng, lat]: [number, number]) => `${Math.abs(lat).toFixed(1)}°${lat < 0 ? 'S' : 'N'}, ${Math.abs(lng).toFixed(1)}°${lng < 0 ? 'W' : 'E'}`;
function kmBetween([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const rad = Math.PI / 180;
  const h = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
const coast = (ma: number) => {
  if (!coasts.has(ma)) coasts.set(ma, fetch(`/data/deeptime/${ma}.json`).then((r) => r.json()));
  return coasts.get(ma)!;
};

/** Everything the map and panel need for one point in deep time. Null until loaded or when inactive. */
export function useDeep(active: boolean, ma: number) {
  const [index, setIndex] = useState<Index | null>(null);
  const [shape, setShape] = useState<{ ma: number; fc: FeatureCollection } | null>(null);

  useEffect(() => {
    if (!active) return;
    indexRequest ??= fetch('/data/deeptime/index.json').then((r) => r.json());
    indexRequest.then((data) => {
      setIndex(data);
      data.snapshots.forEach((s) => coast(s.ma)); // warm every step so playback never waits
    });
  }, [active]);

  useEffect(() => {
    if (!active) return;
    let live = true;
    coast(ma).then((fc) => live && setShape({ ma, fc }));
    return () => {
      live = false;
    };
  }, [active, ma]);

  const snap = index?.snapshots.find((s) => s.ma === ma);
  const view: DeepView | null = useMemo(() => {
    if (!active || !index || !snap || !shape) return null;
    return {
      coast: shape.fc,
      path: index.snapshots.filter((s) => s.ma >= ma).map((s) => s.refs.india),
      at: snap.refs.india,
      labels: Object.entries(snap.refs).map(([land, at]) => ({ name: LAND_NAME[land], at })),
    };
  }, [active, index, snap, shape, ma]);

  return { index, snap, view };
}

export function DeepPanel({ ma, deep }: { ma: number; deep: ReturnType<typeof useDeep> }) {
  const { index, snap } = deep;
  const context = useDeepContext(ma, NEAR_MA);
  const stage = context.stages.find((m) => ma <= m.from && ma >= m.to);
  const today = index?.snapshots[0].refs.india;

  return (
    <>
      <div className="side__header">
        <p className="eyebrow">Journey of the Indian landmass</p>
        <h2>{ma === 0 ? 'Present-day continents' : `${ma} million years ago`}</h2>
        <p className="muted">{index ? `Plate model: ${index.model}.` : 'Loading the plate model…'}</p>
      </div>
      <div className="card card--light card--accent">
        <p className="eyebrow eyebrow--bold">{stage ? `${stage.title} · ${stage.from}–${stage.to} Ma` : 'Loading…'}</p>
        <p>{stage?.text}</p>
        <p className="muted">Stage dates are ranges from the geological literature and are debated; they are context, not model output.</p>
      </div>
      {snap && today && (
        <dl className="facts">
          <div className="facts__row"><dt>Position</dt><dd>{fmt(snap.refs.india)}</dd></div>
          <div className="facts__row"><dt>Still to travel</dt><dd>{Math.round(kmBetween(snap.refs.india, today) / 10) * 10} km to today’s position</dd></div>
          <div className="facts__row"><dt>Speed</dt><dd>{snap.indiaCmPerYear === null ? '—' : `${snap.indiaCmPerYear.toFixed(1)} cm a year, averaged over the previous ${index!.step} million years`}</dd></div>
        </dl>
      )}
      {index && <p className="muted">Figures are calculated from the model for one reference point: the spot that is now {fmt(index.indiaRef)}, in central India.</p>}
      <p className="eyebrow eyebrow--bold">In the world around this time</p>
      {context.near.length === 0 && <p className="muted">Nothing entered within {NEAR_MA} million years of this point.</p>}
      {context.near.map((w) => (
        <div key={w.title} className="card card--light">
          <strong>{w.title}</strong>
          <span className="muted">about {w.ma === 0 ? 'the present' : `${w.ma} million years ago`}</span>
          <span>{w.text}</span>
        </div>
      ))}
      <p className="muted">World events are rounded dates from the scientific literature and still need citations.</p>
    </>
  );
}
