import { controlClaims } from './control';
import { events } from './events';
import { historicalRegions } from './regions';
import ruleRows from './records/unit-rules.json';
import { toMs, utc } from './time';

// Every moment at which something on the map or in the record changes: a dated event, a
// place changing hands, a district rule or a period region starting or ending. Playback
// never jumps over one of these, however fast it runs; it lands on each in turn.
const years = [
  ...controlClaims.flatMap((c) => [c.from, c.to]),
  ...(ruleRows as { from: number; to: number }[]).flatMap((r) => [r.from, r.to]),
  ...historicalRegions.flatMap((r) => [r.from, r.to]),
];

export const stops: number[] = [...new Set([...years.map((y) => utc(y, 0, 1)), ...events.map((e) => toMs(e.date))])].sort((a, b) => a - b);

/** The first stop after `from`, up to and including `to`; undefined when the stretch is clear. */
export function nextStop(from: number, to: number): number | undefined {
  let lo = 0, hi = stops.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (stops[mid] <= from) lo = mid + 1;
    else hi = mid;
  }
  return lo < stops.length && stops[lo] <= to ? stops[lo] : undefined;
}
