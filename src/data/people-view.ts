import type { Track } from './api';

const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export const compass = (deg: number) => POINTS[Math.round(deg / 45) % 8];

/** One line saying where a person is and what the record supports. */
export function describe(t: Track): string {
  if (t.state === 'at') return `Recorded at ${t.at.label}`;
  if (t.state === 'after') return `Last recorded at ${t.at.label}`;
  if (t.state === 'before') return `Next recorded at ${t.at.label}`;
  return `Moving ${compass(t.heading ?? 0)}, about ${t.progress}% of the way from ${t.from!.label} to ${t.to!.label}`;
}

const COLOURS = ['#ffd23f', '#3bceac', '#ee6352', '#59a5ff', '#f78fb3', '#b8f2e6', '#ff9f1c', '#a0e426', '#c77dff', '#ff6b6b'];
const colourOf = (id: string) => COLOURS[[...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0) % COLOURS.length];

/** One marker on the map: either a single person, or a group badge standing in for several. */
export type PersonMarker =
  | { kind: 'person'; id: string; name: string; lng: number; lat: number; color: string; firm: boolean; gender: 'male' | 'female' }
  | { kind: 'group'; id: string; lng: number; lat: number; count: number; ids: string[]; names: string[] };

// The clustering radius is in SCREEN PIXELS, the same way Google Maps clusters places — not a
// fixed map distance. That is what makes it zoom-aware: the same two points are close together
// on screen when zoomed out (so they merge into one group) and far apart once zoomed in enough
// (so the group splits back into individual people), without any special-casing per zoom level.
// Two people recorded at the exact same coordinate (the ordinary case — they were at the same
// event) stay grouped at any zoom, the same way Google Maps never zoom-separates two places in
// the same building; the group's own click handler opens a list instead, not a zoom.
const CLUSTER_PX = 26;

/** Markers for the people in view: singles where they stand alone, grouped where they don't. */
export function personMarkers(tracks: Track[], zoom: number): PersonMarker[] {
  const degPerPx = 360 / (512 * 2 ** zoom);
  const radiusDeg = CLUSTER_PX * degPerPx;
  const clusters: Track[][] = [];
  for (const t of tracks) {
    const home = clusters.find((c) => Math.hypot(c[0].at.lng - t.at.lng, c[0].at.lat - t.at.lat) < radiusDeg);
    if (home) home.push(t);
    else clusters.push([t]);
  }
  return clusters.map((c) => {
    if (c.length === 1) {
      const t = c[0];
      return { kind: 'person', id: t.id, name: t.name, lng: t.at.lng, lat: t.at.lat, color: colourOf(t.id), firm: t.state === 'at', gender: t.gender };
    }
    const lng = c.reduce((sum, t) => sum + t.at.lng, 0) / c.length;
    const lat = c.reduce((sum, t) => sum + t.at.lat, 0) / c.length;
    return { kind: 'group', id: c.map((t) => t.id).join(','), lng, lat, count: c.length, ids: c.map((t) => t.id), names: c.map((t) => t.name) };
  });
}
