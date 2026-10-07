import rows from './records/regions.json';

// Named regions inside a power, at any depth: a province's districts, a district's
// subdivisions, and so on. Each is a dated set of present-day units, so it always has a
// boundary that can be drawn, and one can sit inside another through `parent`.
// A region is matched for now to the present-day district that holds its seat; mapping its
// full extent means listing more districts or talukas in the record, nothing else changes.
export interface HistoricalRegion {
  id: string;
  name: string;
  /** What the power itself called this level: sarkar, pargana, nadu, vishaya, district… */
  kind: string;
  power: string;
  /** The larger region or division this one belonged to. */
  parent?: string;
  from: number;
  to: number;
  country: string;
  /** Lower-case fragments of present-day district names. */
  districts: string[];
  sourceIds: string[];
  note?: string;
}

export const historicalRegions = rows as HistoricalRegion[];
const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Regions on record that cover a present-day district in `year`, innermost last. */
export function regionsAt(country: string, district: string, year: number): HistoricalRegion[] {
  const name = plain(district);
  return historicalRegions.filter((r) => r.country === country && year >= r.from && year < r.to && r.districts.some((d) => name.includes(d)));
}
