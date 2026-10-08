import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { nextStop } from '../data/stops';
import { addUnits, clampMs, MAX_MS, MIN_MS, toMs, type Scale } from '../data/time';

const DAY_MS = 86400000;
/** Playback rates: how much history passes in one second of watching. */
export const RATES = [
  { id: 'minute', label: '1 minute', ms: DAY_MS / 1440, scale: 'minute', hold: 650 },
  { id: 'hour', label: '1 hour', ms: DAY_MS / 24, scale: 'hour', hold: 600 },
  { id: 'day', label: '1 day', ms: DAY_MS, scale: 'day', hold: 500 },
  { id: 'month', label: '1 month', ms: DAY_MS * 30.4369, scale: 'month', hold: 450 },
  { id: 'year', label: '1 year', ms: DAY_MS * 365.2425, scale: 'year', hold: 400 },
  { id: 'decade', label: '10 years', ms: DAY_MS * 3652.425, scale: 'year', hold: 250 },
  { id: 'century', label: '100 years', ms: DAY_MS * 36524.25, scale: 'year', hold: 150 },
] as const satisfies readonly { id: string; label: string; ms: number; scale: Scale; hold: number }[];
export type RateId = (typeof RATES)[number]['id'];
const FRAME_MS = 100;
// `hold` is how long playback rests on each change so it can be seen: shorter at faster
// rates, but never less than one drawn frame, so nothing is skipped.
/** The timeline opens this many million years ago and runs to the present without a break. */
export const DEEP_START_MA = 200;
export const DEEP_STEP_MA = 5;
const DEEP_TICK_MS = 1100;

interface TimeState {
  ms: number;
  scale: Scale;
  playing: boolean;
  /** How much history passes per second of playback. */
  rate: RateId;
  /** True while the playhead is in the deep-time stretch, measured in `ma` million years ago. */
  deep: boolean;
  ma: number;
  setMs: (ms: number) => void;
  setScale: (s: Scale) => void;
  setPlaying: (p: boolean) => void;
  setRate: (r: RateId) => void;
  setDeep: (d: boolean) => void;
  setMa: (ma: number) => void;
  step: (n: number) => void;
}

const TimeContext = createContext<TimeState | null>(null);

export function TimeProvider({ children }: { children: ReactNode }) {
  const [ms, setMsRaw] = useState(() => toMs('1666-05-12'));
  const [scale, setScaleRaw] = useState<Scale>('year');
  const [playing, setPlaying] = useState(false);
  const [rate, setRateRaw] = useState<RateId>('year');
  const [deep, setDeep] = useState(false);
  const [ma, setMaRaw] = useState(DEEP_START_MA);

  // Choosing a calendar date or scale always brings the playhead out of deep time.
  const setMs = useCallback((v: number) => { setDeep(false); setMsRaw(clampMs(v)); }, []);
  const setScale = useCallback((s: Scale) => { setDeep(false); setScaleRaw(s); }, []);
  const setMa = useCallback((v: number) => setMaRaw(Math.min(DEEP_START_MA, Math.max(0, Math.round(v / DEEP_STEP_MA) * DEEP_STEP_MA))), []);
  // Choosing a rate also sets the scale to match, so what is on screen is one step of what is passing.
  const setRate = useCallback((r: RateId) => { setRateRaw(r); setScaleRaw(RATES.find((x) => x.id === r)!.scale); }, []);
  const step = useCallback((n: number) => setMsRaw((cur) => clampMs(addUnits(cur, scale, n))), [scale]);

  useEffect(() => {
    if (!playing) return;
    if (deep) {
      const id = window.setInterval(() => setMaRaw((cur) => Math.max(0, cur - DEEP_STEP_MA)), DEEP_TICK_MS);
      return () => window.clearInterval(id);
    }
    // Time flows continuously at the chosen rate, but never past a change: playback lands on
    // every dated event and every change of holder in turn and rests there briefly. Running
    // faster shortens the stretches in between; it does not drop anything.
    const chosen = RATES.find((r) => r.id === rate)!;
    const perFrame = (chosen.ms * FRAME_MS) / 1000;
    let resting = 0;
    const id = window.setInterval(() => {
      if (resting > 0) {
        resting -= FRAME_MS;
        return;
      }
      setMsRaw((cur) => {
        const target = cur + perFrame;
        const stop = nextStop(cur, target);
        if (stop !== undefined) {
          resting = chosen.hold;
          return stop;
        }
        if (target >= MAX_MS) {
          setPlaying(false);
          return MAX_MS;
        }
        return target;
      });
    }, FRAME_MS);
    return () => window.clearInterval(id);
  }, [playing, rate, deep]);

  // When playback reaches the present-day continents, carry straight on into recorded history.
  useEffect(() => {
    if (!deep || !playing || ma > 0) return;
    const id = window.setTimeout(() => {
      setDeep(false);
      setRateRaw('century');
      setScaleRaw('year');
      setMsRaw(MIN_MS);
    }, DEEP_TICK_MS);
    return () => window.clearTimeout(id);
  }, [deep, playing, ma]);

  const value = useMemo(
    () => ({ ms, scale, playing, rate, deep, ma, setMs, setScale, setPlaying, setRate, setDeep, setMa, step }),
    [ms, scale, playing, rate, deep, ma, setMs, setScale, setRate, setMa, step],
  );
  return <TimeContext.Provider value={value}>{children}</TimeContext.Provider>;
}

export function useTime(): TimeState {
  const ctx = useContext(TimeContext);
  if (!ctx) throw new Error('useTime must be used inside TimeProvider');
  return ctx;
}
