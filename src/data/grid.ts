import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FeatureCollection, LineString, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, GeometryObject, Topology } from 'topojson-specification';
import landTopo from 'world-atlas/land-50m.json';
import { useTerritory } from './api';
import { type ControlClaim } from './control';
import powerRows from './records/powers.json';
import { historicalRegions } from './regions';
import ruleRows from './records/unit-rules.json';

// The territory model. The world is a SIZE x SIZE grid of cells in Web Mercator, so a cell is
// the same shape on screen everywhere, like a pixel. For any year, each cell is either empty
// or holds one power, with a grade saying how we know:
//   2 enclosed  the cell lies inside the area enclosed by the places that power is recorded
//               as holding that year (the convex hull of each group of places within LINK_KM
//               of one another, padded by PAD_KM). Derived from the
//               records, so it grows and shrinks as places are gained and lost. Where two
//               powers' areas overlap, the cell goes to the one with the nearer attested place.
//               The result is then snapped to real boundaries: each present-day district
//               (see scripts/build-units.mjs) goes whole to the power with an attested place in
//               it, or failing that to the power covering at least SNAP_SHARE of it, and is
//               otherwise left empty. Every edge drawn is therefore a surveyed boundary.
//   1 recorded  the cell's district is assigned to the power by a dated rule in
//               src/data/records/unit-rules.json (for example every district of India to the
//               Republic of India from 1947). Recorded districts override derived ones.
//   4 nearest   no rule and no enclosing power: the district goes to the power with the
//               nearest attested place. The weakest grade, drawn palest; it exists so that
//               land is never shown as belonging to no one.
//   3 mapped    drawn by a researcher as a region, with its own sources. Overrides grade 2.
// The method is the same for every power and every year; nothing is special-cased, and
// nothing is filled from a ready-made historical map.
export const SIZE = 2048;
/** How far beyond its outermost attested places a power’s enclosed area extends. */
export const PAD_KM = 45;
const SHADES = [1, 0.62, 0.8];
/** A district with no attested place joins a power only when that power covers this share of it. */
const SNAP_SHARE = 0.5;
/** Two of a power’s places are treated as one continuous holding when they are this close. */
export const LINK_KM = 650;
const MAX_LAT = 85.0511;
const EARTH_KM = 6371.0088;

// One fixed colour per power, from the records (see scripts/assign-colours.mjs).
const powers = powerRows as { name: string; colour: string; family: string }[];
/** Archaeological cultures are not states: they are shown where they are found and never spread to fill empty land. */
const cultures = new Set(powers.filter((p) => p.family === 'culture').map((p) => p.name));
export const PALETTE = powers.map((p) => p.colour);
const powerIndex = new Map(powers.map((p, i) => [p.name, i]));

/** Palette index for a power. Names not yet in the colour table get a stable fallback. */
export function colourOf(name: string) {
  const known = powerIndex.get(name);
  if (known !== undefined) return known;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % PALETTE.length;
}

export const land = feature(landTopo as unknown as Topology, (landTopo as unknown as Topology).objects.land);

export interface MappedRegion {
  id: string;
  polity: string;
  from: number;
  to: number;
  sources: string[];
  cells: number[];
}

export interface Pole {
  lng: number;
  lat: number;
  /** Radius of the largest circle around this point that stays inside the territory, in cells. */
  r: number;
  /** Unbroken width of the territory through this point, in cells. */
  run: number;
}

export interface PolityInfo {
  id: number;
  /** What is shown and selected: the power, or one of its divisions in the divisions view. */
  name: string;
  /** The power itself; equals `name` except for a division. */
  power: string;
  /** Relative strength of the fill, so neighbouring divisions of one power can be told apart. */
  shade: number;
  under?: string;
  k: number;
  /** Area by grade: recorded, enclosed, mapped, nearest. */
  km2: [recorded: number, enclosed: number, mapped: number, nearest: number];
  claims: ControlClaim[];
  regions: MappedRegion[];
  poles: Pole[];
}

export interface Grid {
  year: number;
  cells: Uint16Array;
  grade: Uint8Array;
  polities: PolityInfo[];
  box: { x0: number; y0: number; x1: number; y1: number } | null;
  /** Polity id per present-day district (the file's own `id`, not this module's rasterisation
   * order), for whichever districts a holder was actually decided for this year. Lets the map
   * trace each territory's edge along the district's real, surveyed shape (see zoneOutline)
   * instead of approximating it with the raster cells above. */
  unitOwner: Map<number, number>;
}

export const colOf = (lng: number) => Math.min(SIZE - 1, Math.max(0, Math.floor(((lng + 180) / 360) * SIZE)));
const mercY = (lat: number) => {
  const phi = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2) * SIZE;
};
export const rowOf = (lat: number) => Math.min(SIZE - 1, Math.max(0, Math.floor(mercY(lat))));
const lngOf = (col: number) => (col / SIZE) * 360 - 180;
const latOf = (row: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * row) / SIZE))) * 180) / Math.PI;
const kmPerCell = (lat: number) => (2 * Math.PI * EARTH_KM * Math.cos((lat * Math.PI) / 180)) / SIZE;
const rowKm2 = Array.from({ length: SIZE }, (_, row) => {
  const top = Math.sin((latOf(row) * Math.PI) / 180);
  const bottom = Math.sin((latOf(row + 1) * Math.PI) / 180);
  return EARTH_KM * EARTH_KM * ((2 * Math.PI) / SIZE) * (top - bottom);
});

type Pt = [number, number];
const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Convex hull by monotone chain. Fewer than three distinct points come back as they are. */
function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const half = (list: Pt[]) => {
    const out: Pt[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half(pts.reverse())];
}

function insideHull(hull: Pt[], p: Pt): boolean {
  if (hull.length < 3) return false;
  for (let i = 0; i < hull.length; i++) if (cross(hull[i], hull[(i + 1) % hull.length], p) < 0) return false;
  return true;
}

function distanceToHull(hull: Pt[], [x, y]: Pt): number {
  if (hull.length === 1) return Math.hypot(hull[0][0] - x, hull[0][1] - y);
  let best = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const [ax, ay] = hull[i], [bx, by] = hull[(i + 1) % hull.length];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + t * dx - x, ay + t * dy - y));
  }
  return best;
}

let mask: Uint8Array | null = null;
/** 1 where the cell centre is on land. Built once from the coastline by scanline fill. */
export function landMask(): Uint8Array {
  if (mask) return mask;
  const out = new Uint8Array(SIZE * SIZE);
  const geom = (land.type === 'FeatureCollection' ? land.features[0].geometry : land.geometry) as Polygon | MultiPolygon;
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  for (const rings of polys) {
    const edges: number[][] = [];
    let minY = Infinity, maxY = -Infinity;
    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const x1 = ((ring[i][0] + 180) / 360) * SIZE, y1 = mercY(ring[i][1]);
        const x2 = ((ring[i + 1][0] + 180) / 360) * SIZE, y2 = mercY(ring[i + 1][1]);
        if (y1 === y2) continue;
        edges.push(y1 < y2 ? [x1, y1, x2, y2] : [x2, y2, x1, y1]);
        minY = Math.min(minY, y1, y2);
        maxY = Math.max(maxY, y1, y2);
      }
    }
    for (let row = Math.max(0, Math.floor(minY)); row <= Math.min(SIZE - 1, Math.ceil(maxY)); row++) {
      const y = row + 0.5;
      const xs: number[] = [];
      for (const [x1, y1, x2, y2] of edges) if (y >= y1 && y < y2) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let col = Math.max(0, Math.ceil(xs[i] - 0.5)); col <= Math.min(SIZE - 1, Math.floor(xs[i + 1] - 0.5)); col++) out[row * SIZE + col] = 1;
      }
    }
  }
  mask = out;
  return out;
}

/** A dated assignment of whole districts to a power. Later rules in the file win over earlier ones. */
interface UnitRule {
  country: string;
  /** Lower-case fragments; the rule applies to a district whose name or state contains one. Omit for the whole country. */
  match?: string[];
  /** Restrict `match` to districts in states containing one of these fragments. */
  onlyStates?: string[];
  /** A paramount power: colours only districts that have no recorded ruler of their own. */
  fill?: boolean;
  /** Leave out districts in states containing one of these fragments. */
  exceptStates?: string[];
  polity: string;
  from: number;
  to: number;
}
const unitRules = ruleRows as UnitRule[];
const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Present-day districts rasterised onto the grid: the building blocks of every territory. */
export interface Units {
  /** Unit id per cell, 0 where no unit covers the cell. */
  grid: Uint16Array;
  /** Indexed by unit id (this module's own rasterisation order, not the file's own `id`). */
  list: { id: number; name: string; country: string; state: string; cells: number; x0: number; y0: number; x1: number; y1: number }[];
}

let unitsRequest: Promise<Units> | null = null;
function loadUnits(): Promise<Units> {
  unitsRequest ??= fetch('/data/base/units.json').then((r) => r.json()).then((fc: FeatureCollection<MultiPolygon, { id: number; name: string; country: string; state: string }>) => {
    const grid = new Uint16Array(SIZE * SIZE);
    const list: Units['list'] = [{ id: 0, name: '', country: '', state: '', cells: 0, x0: 0, y0: 0, x1: 0, y1: 0 }];
    for (const f of fc.features) {
      const unit = { id: f.properties.id, name: f.properties.name, country: f.properties.country, state: f.properties.state ?? '', cells: 0, x0: SIZE, y0: SIZE, x1: -1, y1: -1 };
      const id = list.push(unit) - 1;
      for (const rings of f.geometry.coordinates) {
        const edges: number[][] = [];
        let minY = Infinity, maxY = -Infinity;
        for (const ring of rings) {
          for (let i = 0; i < ring.length - 1; i++) {
            const x1 = ((ring[i][0] + 180) / 360) * SIZE, y1 = mercY(ring[i][1]);
            const x2 = ((ring[i + 1][0] + 180) / 360) * SIZE, y2 = mercY(ring[i + 1][1]);
            if (y1 === y2) continue;
            edges.push(y1 < y2 ? [x1, y1, x2, y2] : [x2, y2, x1, y1]);
            minY = Math.min(minY, y1, y2);
            maxY = Math.max(maxY, y1, y2);
          }
        }
        for (let row = Math.max(0, Math.floor(minY)); row <= Math.min(SIZE - 1, Math.ceil(maxY)); row++) {
          const y = row + 0.5;
          const xs: number[] = [];
          for (const [x1, y1, x2, y2] of edges) if (y >= y1 && y < y2) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
          xs.sort((a, b) => a - b);
          for (let i = 0; i + 1 < xs.length; i += 2) {
            for (let col = Math.max(0, Math.ceil(xs[i] - 0.5)); col <= Math.min(SIZE - 1, Math.floor(xs[i + 1] - 0.5)); col++) {
              if (grid[row * SIZE + col]) continue;
              grid[row * SIZE + col] = id;
              unit.cells++;
              unit.x0 = Math.min(unit.x0, col); unit.x1 = Math.max(unit.x1, col); unit.y0 = Math.min(unit.y0, row); unit.y1 = Math.max(unit.y1, row);
            }
          }
        }
      }
    }
    return { grid, list };
  });
  return unitsRequest;
}

/** The district grid, or null until it has loaded. */
export function useUnits(): Units | null {
  const [units, setUnits] = useState<Units | null>(null);
  useEffect(() => {
    let live = true;
    loadUnits().then((u) => live && setUnits(u), () => undefined);
    return () => {
      live = false;
    };
  }, []);
  return units;
}

type UnitsTopology = Topology<{ units: GeometryCollection<{ id: number; name: string; country: string; state: string }> }>;
let topoRequest: Promise<UnitsTopology> | null = null;
function loadUnitsTopology(): Promise<UnitsTopology> {
  topoRequest ??= fetch('/data/base/units-topology.json').then((r) => r.json());
  return topoRequest;
}

/** The same districts as useUnits, but as a shared-arc topology (see
 * scripts/build-units-topology.mjs) — the geometry zoneOutline needs to trace a smooth edge
 * along real district shapes, which the raster grid used for the fill cannot give. */
export function useUnitsTopology(): UnitsTopology | null {
  const [topo, setTopo] = useState<UnitsTopology | null>(null);
  useEffect(() => {
    let live = true;
    loadUnitsTopology().then((t) => live && setTopo(t), () => undefined);
    return () => {
      live = false;
    };
  }, []);
  return topo;
}

/** Name of the present-day district at a point, if one covers it. */
export function unitAt(units: Units | null, lng: number, lat: number): string | undefined {
  const id = units?.grid[rowOf(lat) * SIZE + colOf(lng)];
  return id ? units!.list[id].name : undefined;
}

const most = (tally: Map<number, number> | undefined): [number, number] => [...(tally ?? [])].sort((a, b) => b[1] - a[1])[0] ?? [0, 0];
const bump = (into: Map<number, Map<number, number>>, unit: number, power: number) => {
  const t = into.get(unit) ?? new Map<number, number>();
  t.set(power, (t.get(power) ?? 0) + 1);
  into.set(unit, t);
};

const active = <T extends { from: number; to: number }>(list: T[], year: number) => list.filter((c) => year >= c.from && year < c.to);

export function buildGrid(year: number, regions: MappedRegion[], estimate: boolean, claims: ControlClaim[], byDivision = false, units: Units | null = null): Grid {
  const isLand = landMask();
  const cells = new Uint16Array(SIZE * SIZE);
  const grade = new Uint8Array(SIZE * SIZE);
  // Distance (in cells, plus one so zero means unset) from each claimed cell to its holder’s nearest attested place.
  const nearest = new Float32Array(SIZE * SIZE);
  const polities: PolityInfo[] = [];
  const byName = new Map<string, PolityInfo>();
  const unitOwner = new Map<number, number>();
  let x0 = SIZE, y0 = SIZE, x1 = -1, y1 = -1;

  const polity = (name: string, under?: string, power = name) => {
    let p = byName.get(name);
    if (!p) {
      p = { id: polities.length + 1, name, power, shade: name === power ? 1 : SHADES[polities.length % SHADES.length], under, k: colourOf(under ?? power), km2: [0, 0, 0, 0], claims: [], regions: [], poles: [] };
      polities.push(p);
      byName.set(name, p);
    }
    return p;
  };
  const grow = (col: number, row: number) => {
    x0 = Math.min(x0, col); x1 = Math.max(x1, col); y0 = Math.min(y0, row); y1 = Math.max(y1, row);
  };

  for (const claim of claims) {
    const p = byDivision && claim.division ? polity(claim.division, claim.under, claim.polity) : polity(claim.polity, claim.under);
    p.claims.push(claim);
  }

  if (estimate) {
    for (const p of polities) {
      const spots = [...new Map(p.claims.map((c): [string, Pt] => [c.placeId, [colOf(c.lng) + 0.5, rowOf(c.lat) + 0.5]])).values()];
      const perCell = kmPerCell(p.claims[0].lat);
      const pad = PAD_KM / perCell;
      // Only places within LINK_KM of one another are enclosed together, so scattered outposts
      // stay separate instead of claiming everything between them.
      const groups: Pt[][] = [];
      for (const spot of spots) {
        const near = groups.filter((g) => g.some((q) => Math.hypot(q[0] - spot[0], q[1] - spot[1]) * perCell <= LINK_KM));
        const merged = [spot, ...near.flat()];
        near.forEach((g) => groups.splice(groups.indexOf(g), 1));
        groups.push(merged);
      }
      for (const group of groups) {
      const hull = convexHull(group);
      const xs = group.map((q) => q[0]), ys = group.map((q) => q[1]);
      const c0 = Math.max(0, Math.floor(Math.min(...xs) - pad)), c1 = Math.min(SIZE - 1, Math.ceil(Math.max(...xs) + pad));
      const r0 = Math.max(0, Math.floor(Math.min(...ys) - pad)), r1 = Math.min(SIZE - 1, Math.ceil(Math.max(...ys) + pad));
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const i = row * SIZE + col;
          if (!isLand[i]) continue;
          const at: Pt = [col + 0.5, row + 0.5];
          if (!insideHull(hull, at) && distanceToHull(hull, at) > pad) continue;
          let d = Infinity;
          for (const q of spots) d = Math.min(d, Math.hypot(q[0] - at[0], q[1] - at[1]));
          if (nearest[i] && d + 1 >= nearest[i]) continue;
          nearest[i] = d + 1;
          cells[i] = p.id;
          grade[i] = 2;
          grow(col, row);
        }
      }
      }
    }
  }
  // Give every district a holder. In order of strength:
  //   a dated rule that names it outright                         (grade 1)
  //   the power with an attested place inside it                  (grade 2)
  //   a paramount power, where a rule says one stood over the land (grade 1)
  //   the power whose attested places enclose most of it          (grade 2)
  //   the power with the nearest attested place                   (grade 4)
  // Land is therefore never left blank in any year for which there is a single record.
  if (units && x1 >= 0 || units && active(unitRules, year).length) {
    const rules = active(unitRules, year);
    const covered = new Map<number, Map<number, number>>();
    const seated = new Map<number, Map<number, number>>();
    if (x1 >= 0) {
      for (let row = y0; row <= y1; row++) {
        for (let col = x0; col <= x1; col++) {
          const i = row * SIZE + col;
          if (!units.grid[i] || !cells[i]) continue;
          bump(covered, units.grid[i], cells[i]);
          cells[i] = 0;
          grade[i] = 0;
        }
      }
    }
    const spots: { col: number; row: number; id: number }[] = [];
    for (const p of polities) for (const c of p.claims) {
      const col = colOf(c.lng), row = rowOf(c.lat);
      if (!cultures.has(p.power)) spots.push({ col, row, id: p.id });
      if (units.grid[row * SIZE + col]) bump(seated, units.grid[row * SIZE + col], p.id);
    }
    units.list.forEach((info, unit) => {
      if (!unit || !info.cells) return;
      const name = plain(info.name), state = plain(info.state);
      const applies = (r: UnitRule) =>
        r.country === info.country
        && !(r.onlyStates && !r.onlyStates.some((t) => state.includes(t)))
        && !(r.exceptStates && r.exceptStates.some((t) => state.includes(t)))
        && !(r.match && !r.match.some((m) => name.includes(m) || state.includes(m)));
      const named = rules.filter((r) => !r.fill && applies(r)).pop();
      const paramount = rules.filter((r) => r.fill && applies(r)).pop();
      const [holder] = most(seated.get(unit));
      const [widest, count] = most(covered.get(unit));
      let owner = 0, how = 0;
      if (named) { owner = polity(named.polity).id; how = 1; }
      else if (holder) { owner = holder; how = 2; }
      else if (paramount) { owner = polity(paramount.polity).id; how = 1; }
      else if (estimate && count / info.cells >= SNAP_SHARE) { owner = widest; how = 2; }
      else if (spots.length) {
        const cx = (info.x0 + info.x1) / 2, cy = (info.y0 + info.y1) / 2;
        let best = Infinity;
        for (const sp of spots) {
          const d = (sp.col - cx) ** 2 + (sp.row - cy) ** 2;
          if (d < best) { best = d; owner = sp.id; }
        }
        how = 4;
      }
      if (!owner) return;
      unitOwner.set(info.id, owner);
      for (let row = info.y0; row <= info.y1; row++) {
        for (let col = info.x0; col <= info.x1; col++) {
          const i = row * SIZE + col;
          if (units.grid[i] !== unit) continue;
          cells[i] = owner;
          grade[i] = how;
        }
      }
      grow(info.x0, info.y0);
      grow(info.x1, info.y1);
    });
  }

  // In the divisions view, period regions on record take over the districts they name.
  if (units && byDivision) {
    for (const r of active(historicalRegions, year)) {
      const p = polity(r.name, undefined, r.power);
      units.list.forEach((info, unit) => {
        if (!unit || info.country !== r.country || !r.districts.some((d) => plain(info.name).includes(d))) return;
        unitOwner.set(info.id, p.id);
        for (let row = info.y0; row <= info.y1; row++) {
          for (let col = info.x0; col <= info.x1; col++) {
            const i = row * SIZE + col;
            if (units.grid[i] !== unit) continue;
            cells[i] = p.id;
            grade[i] = 1;
          }
        }
        grow(info.x0, info.y0);
        grow(info.x1, info.y1);
      });
    }
  }

  for (const region of active(regions, year)) {
    const p = polity(region.polity);
    p.regions.push(region);
    for (const i of region.cells) {
      cells[i] = p.id;
      grade[i] = 3;
      grow(i % SIZE, Math.floor(i / SIZE));
    }
  }

  const grid: Grid = { year, cells, grade, polities, unitOwner, box: x1 < 0 ? null : { x0, y0, x1, y1 } };
  if (grid.box) analyse(grid);
  return grid;
}

/** Areas per grade, and for each territory the interior points where a name will fit. */
function analyse(grid: Grid) {
  const { cells, grade, polities } = grid;
  const { x0, y0, x1, y1 } = grid.box!;
  const w = x1 - x0 + 3, h = y1 - y0 + 3; // one empty cell of margin all round
  const at = (x: number, y: number) => cells[(y0 - 1 + y) * SIZE + (x0 - 1 + x)];
  const dist = new Uint16Array(w * h);
  const BIG = 60000;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const id = at(x, y);
      if (!id) continue;
      polities[id - 1].km2[grade[(y0 - 1 + y) * SIZE + (x0 - 1 + x)] - 1] += rowKm2[y0 - 1 + y];
      const edge = at(x - 1, y) !== id || at(x + 1, y) !== id || at(x, y - 1) !== id || at(x, y + 1) !== id;
      dist[y * w + x] = edge ? 3 : BIG;
    }
  }
  // Two-pass chamfer transform: distance from each cell to the edge of its own territory.
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (dist[i] > 3) dist[i] = Math.min(dist[i], dist[i - 1] + 3, dist[i - w] + 3, dist[i - w - 1] + 4, dist[i - w + 1] + 4);
  }
  for (let y = h - 2; y > 0; y--) for (let x = w - 2; x > 0; x--) {
    const i = y * w + x;
    if (dist[i] > 3) dist[i] = Math.min(dist[i], dist[i + 1] + 3, dist[i + w] + 3, dist[i + w + 1] + 4, dist[i + w - 1] + 4);
  }

  const peaks: { id: number; x: number; y: number; d: number }[] = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, d = dist[i];
    if (d < 6) continue;
    if (d >= dist[i - 1] && d >= dist[i + 1] && d >= dist[i - w] && d >= dist[i + w] && d >= dist[i - w - 1] && d >= dist[i - w + 1] && d >= dist[i + w - 1] && d >= dist[i + w + 1]) peaks.push({ id: at(x, y), x, y, d });
  }
  peaks.sort((a, b) => b.d - a.d);
  const taken: typeof peaks = [];
  for (const p of peaks) {
    const mine = taken.filter((t) => t.id === p.id);
    if (mine.length >= 2 || mine.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < 110)) continue;
    taken.push(p);
    let left = p.x, right = p.x;
    while (at(left - 1, p.y) === p.id) left--;
    while (at(right + 1, p.y) === p.id) right++;
    const mid = (left + right) / 2;
    polities[p.id - 1].poles.push({ lng: lngOf(x0 - 1 + mid + 0.5), lat: latOf(y0 - 1 + p.y + 0.5), r: p.d / 3, run: right - left + 1 });
  }
}

export function polityAt(grid: Grid | null, lng: number, lat: number): { polity: PolityInfo; grade: number } | undefined {
  if (!grid) return undefined;
  const i = rowOf(lat) * SIZE + colOf(lng);
  const id = grid.cells[i];
  return id ? { polity: grid.polities[id - 1], grade: grid.grade[i] } : undefined;
}

const OPACITY = [0, 0.72, 0.6, 0.85, 0.4];

/** The grid as drawable shapes: one rectangle per unbroken run of like cells in a row. */
export function gridShapes(grid: Grid, selectedId: number | null): FeatureCollection<Polygon> {
  const features: FeatureCollection<Polygon>['features'] = [];
  if (!grid.box) return { type: 'FeatureCollection', features };
  const { x0, y0, x1, y1 } = grid.box;
  for (let row = y0; row <= y1; row++) {
    const north = latOf(row), south = latOf(row + 1);
    for (let col = x0; col <= x1; ) {
      const i = row * SIZE + col;
      const id = grid.cells[i], g = grid.grade[i];
      let end = col + 1;
      while (end <= x1 && grid.cells[row * SIZE + end] === id && grid.grade[row * SIZE + end] === g) end++;
      if (id) {
        const west = lngOf(col), east = lngOf(end);
        features.push({
          type: 'Feature',
          properties: { color: PALETTE[grid.polities[id - 1].k], opacity: OPACITY[g] * grid.polities[id - 1].shade * (selectedId && selectedId !== id ? 0.45 : 1) },
          geometry: { type: 'Polygon', coordinates: [[[west, north], [east, north], [east, south], [west, south], [west, north]]] },
        });
      }
      col = end;
    }
  }
  return { type: 'FeatureCollection', features };
}

/**
 * The true edge of every kingdom for this year, in one solid line — like the bold black country
 * line on an ordinary atlas, not a colour per power. Traced along the real, surveyed shape of
 * whichever present-day districts a power holds (units-topology.json), wherever the power in
 * charge changes, including against unclaimed land. A division of the same power (see byDivision)
 * does not get a line here — that is an internal matter for the gray present-day lines
 * (unit-lines/state-lines) to carry, the same way a province never gets its neighbour country's
 * weight of line on a real map.
 */
export function zoneOutline(topo: UnitsTopology | null, grid: Grid): FeatureCollection<LineString | MultiLineString> {
  if (!topo || !grid.unitOwner.size) return { type: 'FeatureCollection', features: [] };
  const powerOf = (g: GeometryObject) => {
    const owner = grid.unitOwner.get((g.properties as { id: number } | undefined)?.id ?? -1);
    return owner ? grid.polities[owner - 1].power : null;
  };
  const line = mesh(topo, topo.objects.units, (a, b) => powerOf(a) !== powerOf(b));
  if (!line.coordinates.length) return { type: 'FeatureCollection', features: [] };
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: line }] };
}

export const GRADE_LABEL = ['', 'districts recorded as its territory', 'districts enclosed by its attested places', 'mapped region', 'districts nearest to its attested places'];

/** Holder of the attested place nearest to a point, if one lies within `km`. */
export function holderNear(grid: Grid, lng: number, lat: number, km: number): PolityInfo | undefined {
  const perDegree = 111.32;
  let best: PolityInfo | undefined;
  let bestKm = km;
  for (const p of grid.polities) {
    for (const c of p.claims) {
      const d = Math.hypot((c.lng - lng) * perDegree * Math.cos((lat * Math.PI) / 180), (c.lat - lat) * perDegree);
      if (d <= bestKm) { bestKm = d; best = p; }
    }
  }
  return best;
}

export function formatArea(km2: number): string {
  if (km2 >= 1e6) return `${(km2 / 1e6).toFixed(2)} million km²`;
  return `${(km2 >= 10000 ? Math.round(km2 / 1000) * 1000 : Math.round(km2 / 100) * 100).toLocaleString('en-US')} km²`;
}

const KEY = 'chronoscope.regions';

function readRegions(): MappedRegion[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

/** Researcher-drawn regions, kept in this browser. */
export function useRegions() {
  const [regions, setRegions] = useState<MappedRegion[]>(readRegions);
  const update = useCallback((next: MappedRegion[]) => {
    setRegions(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: regions still work for this session
    }
  }, []);
  return { regions, update };
}

export function useGrid(year: number, regions: MappedRegion[], reach = true, byDivision = false): Grid {
  // The claims in force are whatever the database returns for this year. Rebuild only when
  // that answer actually differs, not on every tick of the playhead.
  const claims = useTerritory(year);
  const units = useUnits();
  const key = claims.map((c) => `${c.id}:${c.nameThen}`).join(',') + '|' + unitRules.map((r, i) => (year >= r.from && year < r.to ? i : '')).join(',') + '|' + historicalRegions.map((r, i) => (year >= r.from && year < r.to ? i : '')).join(',') + '|' + regions.map((r) => (year >= r.from && year < r.to ? r.id : '')).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => buildGrid(year, regions, reach, claims, byDivision, units), [key, regions, reach, byDivision, units]);
}

/** Cells within `radius` cells of a point, restricted to land. */
export function brushCells(lng: number, lat: number, radius: number): number[] {
  const isLand = landMask();
  const c0 = colOf(lng), r0 = rowOf(lat);
  const out: number[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const col = c0 + dx, row = r0 + dy;
      if (dx * dx + dy * dy > radius * radius || col < 0 || row < 0 || col >= SIZE || row >= SIZE) continue;
      if (isLand[row * SIZE + col]) out.push(row * SIZE + col);
    }
  }
  return out;
}
