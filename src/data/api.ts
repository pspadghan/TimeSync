import { useEffect, useState } from 'react';
import type { ControlClaim, Handover } from './control';
import type { HistEvent } from './types';

// Client side of the data service (server/api.mjs). Each hook asks the database about the
// time currently selected and keeps showing the previous answer until the new one arrives,
// so moving the timeline never blanks the map.
const cache = new Map<string, Promise<unknown>>();

function get<T>(url: string): Promise<T> {
  if (cache.size > 800) cache.clear(); // playback asks for a new moment every frame
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url} -> ${r.status}`);
      return r.json();
    }));
  }
  return cache.get(url) as Promise<T>;
}

function useQuery<T>(url: string, initial: T): T {
  const [state, setState] = useState<T>(initial);
  useEffect(() => {
    let live = true;
    if (!url) return;
    get<T>(url).then((data) => live && setState(data), () => undefined);
    return () => {
      live = false;
    };
  }, [url]);
  return state;
}

const NONE: never[] = [];

/** Every attested place and its holder in `year`, named as it was then. */
export const useTerritory = (year: number) => useQuery<ControlClaim[]>(`/api/territory?year=${year}`, NONE);

/** Changes of holder in [from, to). */
export const useHandovers = (from: number, to: number) => useQuery<Handover[]>(`/api/handovers?from=${from}&to=${to}`, NONE);

export interface Era {
  name: string;
  note: string | null;
  from: number;
  to: number;
}

/** The conventional period name for `year`, or null where none is entered. */
export const useEra = (year: number) => useQuery<Era | null>(`/api/era?year=${year}`, null);

export interface DeepContext {
  stages: { from: number; to: number; title: string; text: string }[];
  near: { ma: number; title: string; text: string }[];
  marks: { ma: number; title: string }[];
}
const NO_CONTEXT: DeepContext = { stages: [], near: [], marks: [] };

/** Stage and world events around a point in deep time. */
export const useDeepContext = (ma: number, window = 6) => useQuery<DeepContext>(`/api/deeptime?ma=${ma}&window=${window}`, NO_CONTEXT);

/** Events whose date overlaps the window [from, to), in milliseconds. */
export const useEventsIn = (from: number, to: number) => useQuery<HistEvent[]>(`/api/events?from=${Math.round(from)}&to=${Math.round(to)}`, NONE);

export interface TrackPoint {
  lng: number;
  lat: number;
  label: string;
  kind?: string;
  ref?: string;
}
export interface Track {
  id: string;
  uid: string;
  name: string;
  gender: 'male' | 'female';
  /** at: recorded here now · between: interpolated · after / before: within 90 days of a recorded appearance */
  state: 'at' | 'between' | 'after' | 'before';
  at: TrackPoint;
  precision?: string;
  from?: TrackPoint;
  to?: TrackPoint;
  heading?: number;
  distanceKm?: number;
  days?: number;
  progress?: number;
  implausible?: boolean;
  trail: TrackPoint[] | null;
}

/** Where each recorded person is at the given moment. */
export const useTracks = (ms: number, enabled = true) => useQuery<Track[]>(enabled ? `/api/tracks?ms=${Math.round(ms)}` : '', NONE);
