import { events } from './events';
import type { Calendar, HistEvent, Precision } from './types';

export type Scale = 'century' | 'year' | 'month' | 'day' | 'hour' | 'minute';

/** The timeline spans the boundary snapshots: 7000 BCE to 2026 CE. Negative years are BCE. */
export const MIN_YEAR = -7000;
export const MAX_YEAR = 2026;

/** Date.UTC treats years 0–99 as 1900–1999, so build every timestamp through this. */
export function utc(y: number, m = 0, d = 1, h = 0, min = 0): number {
  const dt = new Date(Date.UTC(2000, m, d, h, min));
  dt.setUTCFullYear(y);
  return dt.getTime();
}

export const MIN_MS = utc(MIN_YEAR, 0, 1);
export const MAX_MS = utc(MAX_YEAR, 11, 31);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const RANK: Record<Scale, number> = { minute: -2, hour: -1, day: 0, month: 1, year: 2, century: 3 };

/** Accepts a bare date (`1660-07-13`) or a date with a recorded time of day
 * (`1660-07-13T14:30` or `T14`). A leading minus marks a BCE year, so the string cannot simply
 * be split on hyphens. */
export function toMs(iso: string): number {
  const [, y, m, d, h, min] = /^(-?\d+)-(\d+)-(\d+)(?:T(\d+)(?::(\d+))?)?$/.exec(iso)!.map((v) => (v === undefined ? undefined : Number(v)));
  return utc(y!, m! - 1, d!, h ?? 0, min ?? 0);
}

export function parts(ms: number) {
  const dt = new Date(ms);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate(), h: dt.getUTCHours(), min: dt.getUTCMinutes() };
}

export const clampMs = (ms: number) => Math.min(MAX_MS, Math.max(MIN_MS, ms));

export const yearLabel = (y: number) => (y <= 0 ? `${-y || 1} BCE` : y < 1000 ? `${y} CE` : String(y));

function centuryLabel(y: number): string {
  const s = Math.floor(y / 100) * 100;
  if (s < 0) return `${-s}–${-s - 99} BCE`;
  return `${s || 1}–${s + 99}${s < 1000 ? ' CE' : ''}`;
}

const hourText = (ms: number) => {
  const { h, min } = parts(ms);
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

export function addUnits(ms: number, scale: Scale, n: number): number {
  const { y, m, d } = parts(ms);
  if (scale === 'minute') return ms + n * 60000;
  if (scale === 'hour') return ms + n * 3600000;
  if (scale === 'day') return ms + n * 86400000;
  if (scale === 'month') return utc(y, m + n, Math.min(d, 28));
  return utc(y + (scale === 'century' ? 100 * n : n), m, Math.min(d, 28));
}

/** First instant of the unit that contains `ms`. */
export function startOf(ms: number, scale: Scale): number {
  const { y, m, d } = parts(ms);
  if (scale === 'minute') return Math.floor(ms / 60000) * 60000;
  if (scale === 'hour') return Math.floor(ms / 3600000) * 3600000;
  if (scale === 'day') return utc(y, m, d);
  if (scale === 'month') return utc(y, m, 1);
  return utc(scale === 'century' ? Math.floor(y / 100) * 100 : y, 0, 1);
}

export function formatDate(ms: number, precision: Scale = 'day', long = true): string {
  const { y, m, d } = parts(ms);
  const month = long ? MONTHS_LONG[m] : MONTHS[m];
  if (precision === 'century') return centuryLabel(y);
  if (precision === 'year') return yearLabel(y);
  if (precision === 'month') return `${month} ${yearLabel(y)}`;
  if (precision === 'hour' || precision === 'minute') return `${d} ${month} ${yearLabel(y)}, ${hourText(ms)}`;
  return `${d} ${month} ${yearLabel(y)}`;
}

export function tickLabel(ms: number, scale: Scale): string {
  const { y, m, d } = parts(ms);
  if (scale === 'century') return centuryLabel(y);
  if (scale === 'year') return yearLabel(y);
  if (scale === 'month') return `${MONTHS[m]} ${yearLabel(y)}`;
  if (scale === 'hour' || scale === 'minute') return hourText(ms);
  return `${d} ${MONTHS[m]}`;
}

export const formatEventDate = (e: HistEvent) => formatDate(toMs(e.date), e.precision);

export const CALENDAR_LABEL: Record<Calendar, string> = {
  julian: 'Julian (Old Style)',
  gregorian: 'Gregorian (New Style)',
  'as-cited': 'As cited — calendar not stated',
};

function sameUnit(a: number, b: number, unit: Scale): boolean {
  const pa = parts(a);
  const pb = parts(b);
  if (unit === 'century') return Math.floor(pa.y / 100) === Math.floor(pb.y / 100);
  if (pa.y !== pb.y) return false;
  if (unit === 'year') return true;
  if (pa.m !== pb.m) return false;
  if (unit === 'month') return true;
  if (pa.d !== pb.d) return false;
  if (unit === 'day') return true;
  if (pa.h !== pb.h) return false;
  return unit === 'hour' || pa.min === pb.min;
}

/** An event is in view when it falls in the playhead's window, at the coarser of scale and its own precision. */
export function inWindow(e: HistEvent, ms: number, scale: Scale): boolean {
  const own: Precision = e.precision;
  const unit = RANK[own] > RANK[scale] ? own : scale;
  return sameUnit(toMs(e.date), ms, unit);
}

export const eventsChrono = [...events].sort((a, b) => toMs(a.date) - toMs(b.date));

/** Nearest event strictly outside the current window, before (-1) or after (+1) the playhead. */
export function neighbourEvent(ms: number, scale: Scale, dir: 1 | -1): HistEvent | undefined {
  const list = dir === 1 ? eventsChrono : [...eventsChrono].reverse();
  return list.find((e) => !inWindow(e, ms, scale) && (dir === 1 ? toMs(e.date) > ms : toMs(e.date) < ms));
}
