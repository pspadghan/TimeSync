import placeRows from './records/places.json';
import claimRows from './records/control.json';

// Chronoscope's own record of who held what, and when. The records live in
// src/data/records/*.json and are checked by scripts/validate-data.mjs before every build:
//   places.json   one row per identified place, with its coordinates, how precise they are,
//                 and whether they have been checked against a survey source
//   control.json  one row per claim: this place was held by this power from `from` until
//                 `to` (exclusive), according to these works
// Nothing is taken from a ready-made historical map.
export interface Place {
  id: string;
  name: string;
  lng: number;
  lat: number;
  /** How far the stored point may be from the true site. */
  precisionKm: number;
  coordStatus: 'verified' | 'unverified';
  coordSource: string;
  /** Names in use at the time, where they differ from the name the record is filed under. */
  names?: { name: string; from: number; to: number; note?: string }[];
}

export interface ControlClaim {
  /** Database row id; present on claims returned by the data service. */
  id?: number;
  placeId: string;
  place: string;
  /** What the place was called in the year asked about — only when a dated record actually
   * covers that year; null when nothing is attested for it, never silently the base name. */
  nameThen?: string | null;
  lng: number;
  lat: number;
  precisionKm: number;
  coordStatus: Place['coordStatus'];
  polity: string;
  /** Overlord, where the holder acknowledged one. */
  under?: string;
  /** Internal division of the holder that the place belonged to, e.g. a province. */
  division?: string | null;
  from: number;
  to: number;
  sourceIds: string[];
  note?: string;
  /** The place was this power’s seat of government for the whole span. */
  capital?: boolean;
}

export const places = placeRows as Place[];
const placeById = new Map(places.map((p) => [p.id, p]));

export const controlClaims: ControlClaim[] = (claimRows as Omit<ControlClaim, 'place' | 'lng' | 'lat' | 'precisionKm' | 'coordStatus'>[]).map((c) => {
  const p = placeById.get(c.placeId)!;
  return { ...c, place: p.name, lng: p.lng, lat: p.lat, precisionKm: p.precisionKm, coordStatus: p.coordStatus };
});

/** What the place was called in `year`; the filing name follows in brackets when it differs. */
export function nameIn(placeId: string, year: number): string {
  const p = placeById.get(placeId)!;
  const then = p.names?.find((n) => year >= n.from && year < n.to);
  return then && then.name !== p.name ? `${then.name} (${p.name})` : p.name;
}

/** A recorded change of holder: who lost a place and who gained it. */
export interface Handover {
  year: number;
  place: string;
  lng?: number;
  lat?: number;
  from?: string;
  to: string;
  works: number;
}

export const handovers: Handover[] = controlClaims
  .map((c) => ({ c, before: controlClaims.find((o) => o.placeId === c.placeId && o.to === c.from) }))
  .filter(({ c, before }) => before ? before.polity !== c.polity : c.from > 1500)
  .map(({ c, before }) => ({ year: c.from, place: c.place, from: before?.polity, to: c.polity, works: c.sourceIds.length }))
  .sort((a, b) => a.year - b.year);

/** The user's rule: a statement that five authentic works agree on is treated as settled. */
export const SETTLED_AT = 5;

export function consensus(count: number): string {
  if (count >= SETTLED_AT) return `Settled · ${count} works agree`;
  if (count >= 3) return `Strong · ${count} of ${SETTLED_AT} works`;
  if (count === 2) return `Corroborated · 2 of ${SETTLED_AT} works`;
  if (count === 1) return `Single source · 1 of ${SETTLED_AT} works`;
  return 'Unsourced';
}
