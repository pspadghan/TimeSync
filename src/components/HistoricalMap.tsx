import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { EventCategory, EvidenceState } from '../data/types';
import { gridShapes, land, PALETTE, polityAt, SIZE, useUnitsTopology, zoneOutline, type Grid } from '../data/grid';
import { registerIcons } from './mapIcons';
import { compassRoseUrl, cornerFlourishUrl, paperGrainUrl } from './mapTexture';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { PersonMarker } from '../data/people-view';
import { seas } from '../data/polities';

export interface MapMarker {
  id: string;
  lng: number;
  lat: number;
  title: string;
  lines?: string[];
  state: EvidenceState;
  /** What kind of event this is, so it gets the matching icon (see mapIcons.ts). Omit for a
   * plain numbered waypoint (Journey's stage markers), which get a blank diamond instead. */
  category?: EventCategory;
  /** The event's own year, only needed when category is 'battle' (picks the era's weapon glyph). */
  year?: number;
  badge?: string;
  dim?: boolean;
}

export interface MapRoute {
  id: string;
  coords: [number, number][];
  state: EvidenceState;
  dim?: boolean;
}

/** The map in deep time: reconstructed continents in place of the present-day base. */
export interface DeepView {
  coast: GeoJSON.FeatureCollection;
  path: [number, number][];
  at: [number, number];
  labels: { name: string; at: [number, number] }[];
}

/** A place to draw attention to for a moment, e.g. one that has just changed hands. */
export interface Pulse {
  lng: number;
  lat: number;
}

export interface MapView {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
}

interface Props {
  markers: MapMarker[];
  routes?: MapRoute[];
  deep?: DeepView | null;
  pulses?: Pulse[];
  /** People on screen: single busts, or group badges where several are close together. */
  people?: PersonMarker[];
  watchingId?: string | null;
  onPerson?: (id: string) => void;
  /** A group badge was clicked/tapped: who's in it, and where, so the caller can zoom in and
   * show the list — works the same on a touch screen, where there is no hover. */
  onGroup?: (ids: string[], lng: number, lat: number) => void;
  /** Territory cells for the map date. */
  grid: Grid;
  selectedPolity?: string | null;
  onPolityClick?: (name: string | null) => void;
  /** Any point was clicked: reports the present-day state, district and taluka it lies in. */
  onSpot?: (s: Spot) => void;
  /** When set, dragging on the map paints cells instead of panning. */
  onBrush?: ((lng: number, lat: number) => void) | null;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  popup?: ReactNode;
  focus?: { lng: number; lat: number; zoom?: number; key: string | number };
  onViewChange?: (v: MapView) => void;
  caption: string;
  children?: ReactNode;
}

const ROUTE_PAINT: Record<EvidenceState, { color: string; width: number; dash?: number[] }> = {
  documented: { color: '#d6a744', width: 3 },
  corroborated: { color: '#f3ebd9', width: 2 },
  inferred: { color: '#d6a744', width: 2, dash: [2, 2] },
  disputed: { color: '#c77a45', width: 2, dash: [4, 2] },
  unknown: { color: '#aaa997', width: 2, dash: [0.5, 3] },
};

const MIN_LABEL_PX = 9;
const MAX_LABEL_PX = 30;
// Average glyph advance of the label face, including its letter-spacing, as a share of font size.
const GLYPH_EM = 0.72;

const INK = '#161813';
const HALO = 'rgba(243, 235, 217, 0.9)';
const WATER = '#30372f';
const DETAIL_ZOOM = 5;
const TALUKA_ZOOM = 7;
const TALUKA_LAYERS = ['taluka-fill', 'taluka-lines'];

/** One place on the map and the present-day units that contain it. */
export interface Spot {
  lng: number;
  lat: number;
  country?: string;
  state?: string;
  district?: string;
  taluka?: string;
}
const LAND = '#897d5c'; // warmed slightly toward parchment, to sit under the grain overlay
const DEEP_WATER = '#263a3f';
const DEEP_LAND = ['match', ['get', 'land'], 'india', '#d6a744', 'madagascar', '#c77a45', 'africa', '#8c8a3a', 'arabia', '#9a7b3a', 'eurasia', '#5c8f6b', 'antarctica', '#b7b29c', 'australia', '#b9774b', LAND];
const TWEEN_MS = 320;
const BASE_LAYERS = ['people-dots', 'people-count', 'unit-fill', 'spot-outline', 'lakes', 'rivers-major', 'rivers-mid', 'rivers-minor', 'grid', 'zone-outline', 'coast', 'places', 'river-names', 'sea-names', 'place-names'];
/** Today's district/state lines are only real history from this year: the Republic of India
 * (and the other modern countries in the records) is the first and only polity in the data whose
 * recorded borders ARE today's borders. Before this, a modern state line has no relationship to
 * the year on screen, so it is hidden rather than shown as clutter alongside a kingdom that has
 * nothing to do with it — see the visibility toggle below. */
const MODERN_LINES_FROM = 1947;
const DEEP_LAYERS = ['deep-shore', 'deep-track', 'deep-now', 'deep-names'];
const NO_FEATURES: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

const river = (id: string, filter: maplibregl.FilterSpecification, minzoom: number, width: number): maplibregl.LayerSpecification => ({
  id, type: 'line', source: 'rivers', filter, minzoom,
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: { 'line-color': '#4a5750', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, width * 0.5, 9, width * 2.4] },
});

// A feature's on-screen radius, in pixels, for a real-world distance (its 'precisionKm'
// property) that should stay the SAME real-world size at every zoom — the standard MapLibre
// idiom for "radius in metres, not pixels": since screen pixels per real metre exactly doubles
// every zoom level, a 2-stop ['exponential', 2] interpolation between the radius at zoom 0 and
// zoom 24 reproduces the true radius at every zoom in between, not just at those two points —
// and because it lives entirely in the style expression, MapLibre re-evaluates it every frame
// on its own, the same way it already does for a place dot's circle-radius. No React state, no
// staleness while actively zooming.
const RADIUS_AT_ZOOM_0 = ['/', ['*', ['get', 'precisionKm'], 512], ['*', 360 * 111.32, ['cos', ['*', ['get', 'lat'], Math.PI / 180]]]] as const;
const metresRadiusExpr = (): maplibregl.ExpressionSpecification => [
  'interpolate', ['exponential', 2], ['zoom'],
  0, RADIUS_AT_ZOOM_0,
  24, ['*', RADIUS_AT_ZOOM_0, 2 ** 24],
] as unknown as maplibregl.ExpressionSpecification;

const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: '/fonts/{fontstack}/{range}.pbf',
  sources: {
    rivers: { type: 'geojson', data: '/data/base/rivers.json' },
    lakes: { type: 'geojson', data: '/data/base/lakes.json' },
    units: { type: 'geojson', data: '/data/base/units.json' },
    states: { type: 'geojson', data: '/data/base/states.json' },
    people: { type: 'geojson', data: NO_FEATURES },
    events: { type: 'geojson', data: NO_FEATURES },
    deepTrack: { type: 'geojson', data: NO_FEATURES },
    deepLabels: { type: 'geojson', data: NO_FEATURES },
    seas: { type: 'geojson', data: { type: 'FeatureCollection', features: seas.map((s) => ({ type: 'Feature', properties: { name: s.name }, geometry: { type: 'Point', coordinates: [s.lng, s.lat] } })) } },
    land: { type: 'geojson', data: land },
    grid: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    'zone-outline': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    places: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
  },
  layers: [
    { id: 'sea', type: 'background', paint: { 'background-color': WATER } },
    { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': '#7d775f' } },
    { id: 'lakes', type: 'fill', source: 'lakes', paint: { 'fill-color': WATER } },
    river('rivers-major', ['<=', ['get', 'rank'], 5], 0, 1.4),
    river('rivers-mid', ['all', ['>', ['get', 'rank'], 5], ['<=', ['get', 'rank'], 8]], 4, 1),
    river('rivers-minor', ['>', ['get', 'rank'], 8], 5.5, 0.7),
    { id: 'grid', type: 'fill', source: 'grid', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'opacity'], 'fill-antialias': false } },
    // Two weights of line, the same way any ordinary atlas draws a country in bold and a
    // province inside it in a thin, unobtrusive gray: zone-outline (below, solid black) is each
    // kingdom's own true edge for the selected year, dissolved from real district shapes by who
    // held them then — never a present-day line. unit-lines/state-lines, further down, are
    // today's real district and state shapes — but shown only from MODERN_LINES_FROM on (toggled
    // in the grid-data effect below), because for any earlier year they are not a kingdom's
    // internal record of anything, only clutter with no relationship to the date on screen.
    // Republic of India is the one polity in the records whose borders actually ARE today's, so
    // from 1947 these same lines stop being a modern reference grid and become the real record.
    { id: 'unit-lines', type: 'line', source: 'units', minzoom: 4.4, paint: { 'line-color': INK, 'line-width': ['interpolate', ['linear'], ['zoom'], 4.4, 0.2, 9, 0.9], 'line-opacity': 0.28 } },
    { id: 'unit-fill', type: 'fill', source: 'units', paint: { 'fill-opacity': 0 } },
    { id: 'state-lines', type: 'line', source: 'states', minzoom: 3.4, paint: { 'line-color': INK, 'line-width': ['interpolate', ['linear'], ['zoom'], 3.4, 0.5, 9, 1.8], 'line-opacity': 0.5 } },
    {
      id: 'zone-outline', type: 'line', source: 'zone-outline',
      paint: { 'line-color': '#161813', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1, 9, 2.8] },
    },
    { id: 'spot-outline', type: 'line', source: 'units', filter: ['==', ['get', 'id'], -1], paint: { 'line-color': '#f3ebd9', 'line-width': 2.5 } },
    { id: 'coast', type: 'line', source: 'land', paint: { 'line-color': '#b7ae8d', 'line-width': 0.8 } },
    // A soft halo sized to the place's own recorded uncertainty. This has to be a genuine
    // per-zoom expression, not a JS-computed number re-set only when React state updates — a
    // flat number stays a fixed SCREEN size while actively zooming (only snapping to the right
    // size once the gesture ends and state catches up), which is exactly the "not tracking the
    // map's own ratio" bug a place dot never had, because circle-radius there is already a zoom
    // expression MapLibre re-evaluates every frame natively. A real-world distance (precisionKm)
    // scales as 2^zoom in screen pixels, so a 2-point ['exponential', 2] interpolation between
    // the radius at zoom 0 and zoom 24 reproduces that formula exactly at every zoom in between,
    // entirely inside the style — no React involved, so it is as live as the base map itself.
    {
      id: 'place-uncertainty', type: 'circle', source: 'places', minzoom: 3.6,
      // The filter already requires the real radius to exceed 10px before this draws at all, so
      // there is no need for a separate floor on the radius itself — and there could not be one
      // here anyway: a 'zoom' interpolate has to be the paint property's top-level expression,
      // not nested inside a 'max' (the same rule that silently blanks the whole style if broken).
      filter: ['>', metresRadiusExpr(), 10],
      paint: {
        'circle-radius': metresRadiusExpr(),
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.14,
        'circle-stroke-width': 0,
      },
    },
    // Attested places appear once the map is zoomed to state/district level — a Google-Maps
    // idea: a point that matters at street level is clutter at country scale, so it waits until
    // there is room for it, the same zoom its own label (place-names, below) already waited for.
    {
      id: 'places', type: 'circle', source: 'places', minzoom: 3.6,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, ['case', ['get', 'capital'], 4.5, 3], 5, ['case', ['get', 'capital'], 8, 5.5], 9, ['case', ['get', 'capital'], 12, 9]],
        'circle-color': ['get', 'color'],
        'circle-stroke-color': ['case', ['get', 'verified'], '#f3ebd9', '#24251f'],
        'circle-stroke-width': ['case', ['get', 'capital'], 3, 1.5],
        'circle-opacity': ['case', ['get', 'dim'], 0.35, 1],
      },
    },
    // A capital's own flag, shown exactly for the span control.json records it as capital=true
    // for that holder — moves, appears and disappears with the real claim data already driving
    // the territory fill, not a separate hand-placed thing. Anchored at its base so it reads as
    // planted at the place dot, not floating near it; tinted the holder's own palette colour.
    {
      id: 'capital-flags', type: 'symbol', source: 'places', minzoom: 3.6,
      filter: ['==', ['get', 'capital'], true],
      layout: {
        'icon-image': 'capital-flag', 'icon-anchor': 'bottom',
        'icon-offset': [0, 4], // the dot itself still shows beneath the flag's planted base
        'icon-allow-overlap': true, 'icon-ignore-placement': true,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.26, 6, 0.36, 10, 0.5],
      },
      paint: {
        'icon-color': ['get', 'color'], 'icon-opacity': ['case', ['get', 'dim'], 0.35, 1],
        'icon-halo-color': '#161813', 'icon-halo-width': 1,
      },
    },
    // Events: a small badge shaped by what kind of thing happened (src/components/mapIcons.ts),
    // sized by zoom the same way places and people are, so it never stays a fixed pixel size
    // while the map around it zooms. A plain diamond with a number is used for a journey
    // waypoint that has no event of its own.
    // Events are a finer grain than places — specific happenings, not settlements — so they wait
    // one notch later than places (matching event-names' own minzoom below) rather than crowding
    // a country-scale view where there is no room to tell two nearby ones apart anyway.
    {
      id: 'event-icons', type: 'symbol', source: 'events', minzoom: 4,
      layout: {
        'icon-image': [
          'case',
          ['!', ['has', 'category']], 'event-plain',
          ['all', ['==', ['get', 'category'], 'battle'], ['>=', ['coalesce', ['get', 'year'], 0], 1850]], 'event-battle-modern',
          ['concat', 'event-', ['get', 'category']],
        ],
        // Always rendered at the event's true coordinate, never offset. Tried native collision
        // hiding here (icon-allow-overlap: false) so a genuinely crowded spot would thin itself
        // out automatically — live-tested it and found it silently drops EVERY icon in the layer
        // rather than keeping one winner (reproducible even with icon-ignore-placement: true
        // alone, so it is not simply losing to another layer; something about this sparse,
        // non-clustered point source trips MapLibre's placement index). Left allow-overlap true
        // so icons are reliably visible; graceful crowding control lives in the label layers
        // below instead, which do respect collision correctly.
        'icon-allow-overlap': true, 'icon-ignore-placement': true,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.19, 6, 0.3, 10, 0.44],
      },
      paint: {
        'icon-color': ['match', ['get', 'state'], 'documented', '#D6A744', 'corroborated', '#F3EBD9', 'inferred', '#F7F2E8', 'disputed', '#C77A45', '#686A60'],
        'icon-opacity': ['case', ['get', 'dim'], 0.35, 1],
        'icon-halo-color': ['case', ['get', 'sel'], '#f3ebd9', '#161813'],
        'icon-halo-width': ['case', ['get', 'sel'], 2.6, 1.1],
      },
    },
    {
      id: 'event-badge-text', type: 'symbol', source: 'events', minzoom: 4, filter: ['has', 'badge'],
      layout: {
        'text-field': ['get', 'badge'], 'text-font': ['Open Sans Semibold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 2, 7, 6, 9, 10, 11],
        // Stamped on the icon itself, not a separate label — stays tied to the icon's own
        // collision outcome (not forced to overlap) so it never floats visible with no icon
        // under it once the icon has lost the placement contest to something else there.
        'text-allow-overlap': false, 'text-ignore-placement': false,
      },
      paint: { 'text-color': ['case', ['get', 'sel'], '#161813', '#f3ebd9'] },
    },
    {
      id: 'event-names', type: 'symbol', source: 'events', minzoom: 4,
      layout: {
        'text-field': ['get', 'title'], 'text-font': ['Open Sans Semibold'], 'text-size': 10,
        'text-anchor': 'left', 'text-offset': [0.9, 0], 'text-padding': 2, 'text-optional': true,
      },
      paint: { 'text-color': '#161813', 'text-halo-color': 'rgba(243, 235, 217, 0.95)', 'text-halo-width': 1.4 },
    },
    {
      // People render AFTER (= on top of) events: they are the moving, interactive element and
      // should win both the visual stack and the click/tap hit-test whenever the two overlap.
      // A bust glyph, not a dot, tinted per person and haloed in ink so it reads against any
      // territory colour underneath. Several people close together (screen-pixel radius,
      // zoom-aware — see personMarkers()) become one 'group' badge instead, with a count shown
      // by the layer below.
      // minzoom matches event-icons (4), not the 4.5 this used to be set to — the map's own
      // default start zoom is 4.1, so at 4.5 people were invisible on every normal page load
      // until the user manually zoomed in past it. Confirmed as the actual cause of "I don't
      // see people on the map" rather than guessed.
      id: 'people-dots', type: 'symbol', source: 'people', minzoom: 4,
      layout: {
        'icon-image': ['case',
          ['==', ['get', 'kind'], 'group'], 'person-group',
          ['==', ['get', 'gender'], 'female'], 'person-pin-female',
          'person-pin',
        ],
        // Always at the person's (or group's) true coordinate, never nudged — see event-icons
        // above for why icon-allow-overlap is true rather than native collision hiding.
        'icon-allow-overlap': true, 'icon-ignore-placement': true,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.22, 6, 0.32, 10, 0.46],
      },
      paint: {
        'icon-color': ['get', 'color'], 'icon-opacity': ['case', ['get', 'firm'], 1, 0.75],
        'icon-halo-color': ['case', ['get', 'sel'], '#f3ebd9', '#161813'], 'icon-halo-width': ['case', ['get', 'sel'], 2.5, 1.3],
      },
    },
    {
      // The count, centred directly on the group badge.
      id: 'people-count', type: 'symbol', source: 'people', minzoom: 4, filter: ['==', ['get', 'kind'], 'group'],
      layout: {
        'text-field': ['get', 'count'], 'text-font': ['Open Sans Semibold'], 'text-anchor': 'center',
        'text-size': ['interpolate', ['linear'], ['zoom'], 2, 8, 6, 10, 10, 13],
        // Stamped on the group badge itself — tied to the badge's own collision outcome, same
        // reasoning as event-badge-text above.
        'text-allow-overlap': false, 'text-ignore-placement': false,
      },
      paint: { 'text-color': '#161813', 'text-halo-color': 'rgba(243, 235, 217, 0.95)', 'text-halo-width': 1.2 },
    },
    // No per-person name label on the map itself — icon + colour only, same as the Figma
    // "clean map" rule already asked for. The name is one click/tap away (the panel, a popup,
    // the Journey page); it does not need its own text competing with place names for space.
    // (Place names keep their own label layer, below, since a reader needs to know WHERE
    // something is without clicking — a person's icon is already enough to say someone is
    // there; the panel says who.)
    {
      id: 'river-names', type: 'symbol', source: 'rivers', minzoom: 4.5, filter: ['all', ['!=', ['get', 'name'], ''], ['<=', ['get', 'rank'], 7]],
      layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-letter-spacing': 0.12, 'symbol-spacing': 420 },
      paint: { 'text-color': '#27322d', 'text-halo-color': 'rgba(125, 119, 95, 0.85)', 'text-halo-width': 1.2 },
    },
    // Removed entirely, not just muted: a present-day state/district has no historical-name
    // counterpart in the data at all, so there is nothing for a bracketed reference to pair
    // with — showing it standalone, at any opacity, is still a name on the map with no
    // relationship to the selected date. Present-day context is still available on demand (the
    // Spot panel's "Present-day district" line, shown when something is clicked), just not
    // painted onto the map itself. This is about the NAME only — the present-day district/state
    // LINES stay on the map (unit-lines/state-lines, above) as faint gray texture beneath each
    // kingdom's own solid black edge; a line is not a name.
    {
      id: 'sea-names', type: 'symbol', source: 'seas',
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 2, 11, 6, 18], 'text-letter-spacing': 0.3 },
      paint: { 'text-color': '#8d9484' },
    },
    { id: 'deep-shore', type: 'line', source: 'land', layout: { visibility: 'none' }, paint: { 'line-color': INK, 'line-width': 0.6, 'line-opacity': 0.6 } },
    { id: 'deep-track', type: 'line', source: 'deepTrack', filter: ['==', ['geometry-type'], 'LineString'], layout: { visibility: 'none' }, paint: { 'line-color': '#f3ebd9', 'line-width': 2, 'line-dasharray': [1.5, 1.5] } },
    { id: 'deep-now', type: 'circle', source: 'deepTrack', filter: ['==', ['geometry-type'], 'Point'], layout: { visibility: 'none' }, paint: { 'circle-radius': 5, 'circle-color': '#f3ebd9', 'circle-stroke-color': INK, 'circle-stroke-width': 2 } },
    {
      id: 'deep-names', type: 'symbol', source: 'deepLabels',
      layout: { visibility: 'none', 'text-field': ['get', 'name'], 'text-font': ['Open Sans Semibold'], 'text-size': 12, 'text-letter-spacing': 0.08, 'text-transform': 'uppercase' },
      paint: { 'text-color': INK, 'text-halo-color': HALO, 'text-halo-width': 1.4 },
    },
    {
      id: 'place-names', type: 'symbol', source: 'places', minzoom: 3.6,
      layout: {
        'text-field': ['get', 'place'], 'text-font': ['Open Sans Semibold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3.6, 10, 9, 14],
        'text-anchor': 'left', 'text-offset': [0.8, 0], 'text-optional': true, 'text-padding': 3,
      },
      paint: { 'text-color': INK, 'text-halo-color': HALO, 'text-halo-width': 1.4, 'text-opacity': ['case', ['get', 'dim'], 0.4, 1] },
    },
  ],
};

function textMarker(className: string, text: string, fontPx?: number) {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  if (fontPx) el.style.fontSize = `${fontPx}px`;
  return el;
}

export default function HistoricalMap({ markers, routes, deep, pulses, people, watchingId, onPerson, onGroup, grid, selectedPolity, onPolityClick, onSpot, onBrush, selectedId, onSelect, popup, focus, onViewChange, caption, children }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [scaleKm, setScaleKm] = useState(0);
  const [globe, setGlobe] = useState(false);
  const [view, setView] = useState<{ bounds: maplibregl.LngLatBounds; zoom: number } | null>(null);
  const [popupHost] = useState(() => document.createElement('div'));
  const live = useRef({ onSelect, onViewChange, onPolityClick, onSpot, onBrush, onPerson, onGroup, grid });
  live.current = { onSelect, onViewChange, onPolityClick, onSpot, onBrush, onPerson, onGroup, grid };
  const shown = useRef(new Map<string, { lng: number; lat: number }>());

  useEffect(() => {
    const map = new maplibregl.Map({
      container: holder.current!,
      style: STYLE,
      center: [79.5, 21.5],
      zoom: 4.1,
      minZoom: 1.2,
      maxZoom: 10,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;
    const groupHoverEl = document.createElement('div');
    groupHoverEl.className = 'map-grouphover';
    const groupHover = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: 'cs-popup cs-popup--hover' });

    const report = () => {
      const b = map.getBounds();
      const c = map.getCenter();
      const metresPerPx = (40075016.686 * Math.cos((c.lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
      setScaleKm((110 * metresPerPx) / 1000);
      setView({ bounds: b, zoom: map.getZoom() });
      live.current.onViewChange?.({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth(), zoom: map.getZoom() });
    };
    map.on('load', () => {
      // sdf: true lets icon-color/icon-halo-color retint these shared glyphs at render time.
      registerIcons(map);
      map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      (Object.keys(ROUTE_PAINT) as EvidenceState[]).forEach((state) => {
        const p = ROUTE_PAINT[state];
        map.addLayer({
          id: `route-${state}`,
          type: 'line',
          source: 'routes',
          filter: ['==', ['get', 'state'], state],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': p.color,
            'line-width': p.width,
            'line-opacity': ['case', ['get', 'dim'], 0.3, 0.95],
            ...(p.dash ? { 'line-dasharray': p.dash } : {}),
          },
        });
      });
      setReady(true);
      report();
    });
    map.on('moveend', report);
    map.on('click', (ev) => {
      if (live.current.onBrush) return;
      live.current.onSelect?.(null);
      // People sit on top of events in the map's own draw order (see the layer list above), so
      // they are checked first here too — a click that lands on both a person and an event
      // beneath it resolves to whichever one is actually topmost, not whichever this code
      // happened to check first.
      const person = map.getLayer('people-dots') ? map.queryRenderedFeatures(ev.point, { layers: ['people-dots'] })[0] : undefined;
      if (person?.properties.kind === 'group') {
        // Tap/click a group the same way Google Maps handles a cluster: zoom toward it (which
        // separates anyone who was only grouped because the map was zoomed out) and hand the
        // member list to the caller — the list is what resolves people who are genuinely
        // recorded at the exact same spot, which no amount of zooming ever will. This has to
        // work on tap alone, not hover, since hover does not exist on a touch screen.
        const [lng, lat] = (person.geometry as GeoJSON.Point).coordinates;
        map.easeTo({ center: [lng, lat], zoom: Math.min(map.getMaxZoom(), map.getZoom() + 2.2), duration: 500 });
        live.current.onGroup?.((person.properties.ids as string).split('|'), lng, lat);
        return;
      }
      if (person) {
        live.current.onPerson?.(person.properties.id as string);
        return;
      }
      const event = map.getLayer('event-icons') ? map.queryRenderedFeatures(ev.point, { layers: ['event-icons', 'event-badge-text'] })[0] : undefined;
      if (event) {
        live.current.onSelect?.(event.properties.id as string);
        return;
      }
      const dot = map.queryRenderedFeatures(ev.point, { layers: ['places'] })[0];
      const unit = map.queryRenderedFeatures(ev.point, { layers: ['unit-fill'] })[0]?.properties;
      const taluka = map.getLayer('taluka-fill') ? map.queryRenderedFeatures(ev.point, { layers: ['taluka-fill'] })[0]?.properties : undefined;
      map.setFilter('spot-outline', ['==', ['get', 'id'], unit?.id ?? -1]);
      live.current.onSpot?.({ lng: ev.lngLat.lng, lat: ev.lngLat.lat, country: unit?.country, state: unit?.state, district: unit?.name, taluka: taluka?.name });
      live.current.onPolityClick?.((dot?.properties?.polity as string) ?? polityAt(live.current.grid, ev.lngLat.lng, ev.lngLat.lat)?.polity.name ?? null);
    });

    // Brush: while a brush handler is supplied, a drag paints cells along its path.
    let painting = false;
    const stroke = (ev: maplibregl.MapMouseEvent) => live.current.onBrush?.(ev.lngLat.lng, ev.lngLat.lat);
    map.on('mousedown', (ev) => {
      if (!live.current.onBrush) return;
      painting = true;
      stroke(ev);
    });
    map.on('mousemove', (ev) => painting && stroke(ev));
    map.on('mouseenter', 'people-dots', () => { if (!live.current.onBrush) map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'people-dots', () => { if (!live.current.onBrush) map.getCanvas().style.cursor = ''; groupHover.setLngLat([0, 0]).remove(); });
    // A hover preview of who's in a group — a desktop-only convenience. It is never the only
    // way to see the list: tap/click (handled above) opens it too, since a phone has no hover.
    map.on('mousemove', 'people-dots', (ev) => {
      if (live.current.onBrush) return;
      const f = ev.features?.[0];
      if (f?.properties.kind !== 'group') { groupHover.remove(); return; }
      const names = (f.properties.names as string).split('|');
      groupHoverEl.textContent = '';
      const strong = document.createElement('strong');
      strong.textContent = `${f.properties.count} people here`;
      groupHoverEl.append(strong);
      for (const n of names) {
        const line = document.createElement('span');
        line.textContent = n;
        groupHoverEl.append(line);
      }
      groupHover.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number]).setDOMContent(groupHoverEl).addTo(map);
    });
    map.on('mouseenter', 'event-icons', () => { if (!live.current.onBrush) map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'event-icons', () => { if (!live.current.onBrush) map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'places', () => { if (!live.current.onBrush) map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'places', () => { if (!live.current.onBrush) map.getCanvas().style.cursor = ''; });
    const stop = () => { painting = false; };
    map.on('mouseup', stop);
    map.getCanvas().addEventListener('mouseleave', stop);


    return () => {
      mapRef.current = null;
      setReady(false);
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (ready && mapRef.current?.isStyleLoaded()) mapRef.current.setProjection({ type: globe ? 'globe' : 'mercator' });
  }, [globe, ready]);

  const isDeep = !!deep;
  const brushing = !!onBrush;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (brushing) map.dragPan.disable();
    else map.dragPan.enable();
    map.getCanvas().style.cursor = brushing ? 'crosshair' : '';
  }, [brushing]);

  // People glide from where they were drawn to where the record now puts them.
  useEffect(() => {
    const map = mapRef.current;
    const source = ready ? (map?.getSource('people') as maplibregl.GeoJSONSource | undefined) : undefined;
    if (!source) return;
    const list = people ?? [];
    const ids = new Set(list.map((p) => p.id));
    for (const id of [...shown.current.keys()]) if (!ids.has(id)) shown.current.delete(id);
    const from = new Map(shown.current);
    const start = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const t = Math.min(1, (now - start) / TWEEN_MS);
      const ease = t * (2 - t);
      source.setData({
        type: 'FeatureCollection',
        features: list.map((p) => {
          const a = from.get(p.id) ?? p;
          // Always the person's (or group's — a group's own lng/lat is already a real coordinate,
          // the centroid of who it stands for, not a fabricated one) own true coordinate — never
          // nudged off it. A place, an event and a person recorded at the very same spot stay at
          // that one spot; minzoom gating, icon-size shrinking by zoom, and the layers' native
          // collision handling (icon-allow-overlap: false) decide what's actually showable there.
          const at = { lng: a.lng + (p.lng - a.lng) * ease, lat: a.lat + (p.lat - a.lat) * ease };
          shown.current.set(p.id, at);
          // Feature properties travel more reliably as flat strings than as nested arrays
          // across MapLibre's GeoJSON/vector-tile boundary, so ids/names are joined here and
          // split back apart wherever they are read (the click and hover handlers below).
          const properties = p.kind === 'group'
            ? { id: p.id, kind: 'group', count: p.count, ids: p.ids.join('|'), names: p.names.join('|'), color: '#8d8f86', firm: true, sel: p.ids.includes(watchingId ?? '') }
            : { id: p.id, kind: 'person', name: p.name, color: p.color, firm: p.firm, gender: p.gender, sel: p.id === watchingId };
          return { type: 'Feature' as const, properties, geometry: { type: 'Point' as const, coordinates: [at.lng, at.lat] } };
        }),
      });
      if (t < 1) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [people, watchingId, ready]);

  const selectedPolityId = grid.polities.find((p) => p.name === selectedPolity)?.id ?? null;
  const unitsTopology = useUnitsTopology();
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource('grid') as maplibregl.GeoJSONSource | undefined)?.setData(gridShapes(grid, selectedPolityId));
    (map.getSource('zone-outline') as maplibregl.GeoJSONSource | undefined)?.setData(zoneOutline(unitsTopology, grid));
    const modernLines = !isDeep && grid.year >= MODERN_LINES_FROM;
    map.setLayoutProperty('unit-lines', 'visibility', modernLines ? 'visible' : 'none');
    map.setLayoutProperty('state-lines', 'visibility', modernLines ? 'visible' : 'none');
    // precisionKm and lat travel as raw feature properties — the place-uncertainty layer's own
    // style expression (metresRadiusExpr, above) converts them to a live, every-frame pixel
    // radius itself; nothing here needs to know the current zoom.
    (map.getSource('places') as maplibregl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: grid.polities.flatMap((p) => p.claims.map((c) => ({
        type: 'Feature' as const,
        properties: {
          // Blank, not the base/default name, when nothing is attested for this exact year —
          // see the comment on the server's /api/territory route. The dot still renders either
          // way (places layer doesn't key off this), only the text label goes missing.
          place: c.nameThen ?? '', capital: !!c.capital, polity: p.name, color: PALETTE[p.k],
          verified: c.coordStatus === 'verified', dim: !!selectedPolityId && selectedPolityId !== p.id,
          precisionKm: c.precisionKm, lat: c.lat,
        },
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
      }))),
    });
  }, [grid, selectedPolityId, ready, unitsTopology]);

  // Swap in the detailed coastline the first time the view gets close enough to need it.
  const detailed = useRef(false);
  useEffect(() => {
    if (!view || view.zoom < DETAIL_ZOOM || detailed.current || isDeep) return;
    detailed.current = true;
    import('world-atlas/land-10m.json').then((mod) => {
      const topo = mod.default as unknown as Topology;
      if (detailed.current) (mapRef.current?.getSource('land') as maplibregl.GeoJSONSource | undefined)?.setData(feature(topo, topo.objects.land) as GeoJSON.GeoJSON);
    });
  }, [view, isDeep]);

  // The taluka layer is large, so it is fetched only once the view is close enough to use it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || isDeep || !view || view.zoom < TALUKA_ZOOM || map.getSource('talukas')) return;
    map.addSource('talukas', { type: 'geojson', data: '/data/base/talukas.json' });
    map.addLayer({ id: 'taluka-fill', type: 'fill', source: 'talukas', minzoom: TALUKA_ZOOM, paint: { 'fill-opacity': 0 } }, 'places');
    map.addLayer({ id: 'taluka-lines', type: 'line', source: 'talukas', minzoom: TALUKA_ZOOM, paint: { 'line-color': INK, 'line-width': 0.4, 'line-opacity': 0.3, 'line-dasharray': [2, 2] } }, 'places');
    // No taluka-names layer: these are present-day sub-district names with no historical-period
    // pairing, so per the same rule applied to state/district labels they are not shown at all —
    // only the boundary lines stay, as faint undated background filler.
  }, [view, ready, isDeep]);

  // Entering deep time swaps the present-day base (coast, rivers, places) for the reconstructed
  // continents on the same map; leaving it puts the base back.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    BASE_LAYERS.forEach((id) => map.setLayoutProperty(id, 'visibility', isDeep ? 'none' : 'visible'));
    DEEP_LAYERS.forEach((id) => map.setLayoutProperty(id, 'visibility', isDeep ? 'visible' : 'none'));
    TALUKA_LAYERS.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', isDeep ? 'none' : 'visible'));
    map.setPaintProperty('land', 'fill-color', isDeep ? DEEP_LAND : LAND);
    map.setPaintProperty('sea', 'background-color', isDeep ? DEEP_WATER : WATER);
    if (!isDeep) {
      detailed.current = false;
      (map.getSource('land') as maplibregl.GeoJSONSource).setData(land);
    }
  }, [isDeep, ready]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !deep) return;
    (map.getSource('land') as maplibregl.GeoJSONSource).setData(deep.coast);
    (map.getSource('deepTrack') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: deep.path } },
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: deep.at } },
      ],
    });
    (map.getSource('deepLabels') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: deep.labels.map((l) => ({ type: 'Feature' as const, properties: { name: l.name }, geometry: { type: 'Point' as const, coordinates: l.at } })),
    });
  }, [deep, ready]);

  // A ring that expands and fades over each place that has just changed hands.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pulses?.length) return;
    const made = pulses.map((p) => new maplibregl.Marker({ element: textMarker('map-pulse', '') }).setLngLat([p.lng, p.lat]).addTo(map));
    return () => made.forEach((m) => m.remove());
  }, [pulses]);

  // A name is drawn only where it fits inside its own territory at the current zoom: sized
  // from the territory's width through an interior point, and dropped when that is too small.
  const labels = useMemo(() => {
    if (!view || isDeep) return [];
    const pxPerCell = (512 * 2 ** view.zoom) / SIZE;
    return grid.polities.flatMap((p) =>
      p.poles
        .filter((pole) => view.bounds.contains([pole.lng, pole.lat]))
        .map((pole) => ({
          name: p.name,
          pole,
          px: Math.min(MAX_LABEL_PX, (pole.run * pxPerCell * 0.9) / (p.name.length * GLYPH_EM), pole.r * pxPerCell * 0.9),
        }))
        .filter((l) => l.px >= MIN_LABEL_PX),
    );
  }, [grid, view, isDeep]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const made = labels.map((l) => new maplibregl.Marker({ element: textMarker('map-polity', l.name, l.px) }).setLngLat([l.pole.lng, l.pole.lat]).addTo(map));
    return () => made.forEach((m) => m.remove());
  }, [labels]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    // Always at the event's own real coordinate — never nudged or ringed off it to dodge a
    // neighbour. Two things sharing a spot stay sharing it; it is minzoom gating, shrinking icon
    // size, and the layers' own native collision handling (icon-allow-overlap: false below) that
    // decide what actually renders there at a given zoom, not a fabricated position.
    const features = markers.map((m) => ({
      type: 'Feature' as const,
      properties: {
        id: m.id, title: m.title, state: m.state, category: m.category, year: m.year, badge: m.badge ?? '',
        dim: !!m.dim, sel: m.id === selectedId,
      },
      geometry: { type: 'Point' as const, coordinates: [m.lng, m.lat] },
    }));
    (map.getSource('events') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features });
  }, [markers, selectedId, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource('routes') as maplibregl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: (routes ?? []).map((r) => ({
        type: 'Feature',
        properties: { state: r.state, dim: !!r.dim },
        geometry: { type: 'LineString', coordinates: r.coords },
      })),
    });
  }, [routes, ready]);

  const selected = popup ? markers.find((m) => m.id === selectedId) : undefined;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected) return;
    const p = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: 'none', offset: 14, className: 'cs-popup' })
      .setLngLat([selected.lng, selected.lat])
      .setDOMContent(popupHost)
      .addTo(map);
    return () => {
      p.remove();
    };
  }, [selected?.id, selected?.lng, selected?.lat, popupHost]);

  useEffect(() => {
    if (!focus) return;
    mapRef.current?.flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom ?? Math.max(mapRef.current.getZoom(), 5.2), duration: 900 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);

  const km = scaleKm >= 100 ? Math.round(scaleKm / 10) * 10 : Math.round(scaleKm);

  return (
    <div className="map">
      <div ref={holder} className="map__canvas" />
      {/* A parchment feel laid over the precise vector map underneath — the data stays exact;
          only how it reads changes. */}
      <div className="map__grain" style={{ backgroundImage: `url(${paperGrainUrl()})` }} />
      {/* An engraved-plate frame: vignette + double rule + four corner flourishes, the way an
          old atlas page borders its map rather than letting it bleed to the edge. */}
      <div className="map__frame" />
      <img className="map__corner map__corner--tl" src={cornerFlourishUrl()} alt="" />
      <img className="map__corner map__corner--tr" src={cornerFlourishUrl()} alt="" />
      <img className="map__corner map__corner--bl" src={cornerFlourishUrl()} alt="" />
      <img className="map__corner map__corner--br" src={cornerFlourishUrl()} alt="" />
      <div className="map__zoom">
        <button type="button" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>+</button>
        <span />
        <button type="button" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>−</button>
        <span />
        <button type="button" className="map__globe" aria-pressed={globe} title={globe ? 'Switch to flat map' : 'Switch to globe'} onClick={() => setGlobe(!globe)}>{globe ? '▭' : '◐'}</button>
      </div>
      <div className="map__scale">
        <img className="map__north" src={compassRoseUrl()} alt="North" width={20} height={20} />
        <div className="map__bar" />
        <p>{km} km · {caption}</p>
      </div>
      {!ready && (
        <div className="map__loading" role="status">
          {/* An indeterminate bar, not a fabricated percentage — MapLibre reports "loaded" as
              one event, not graduated per-layer progress, so a number here would be invented. */}
          <p className="map__loading-title">Building the historical map</p>
          <div className="map__loading-track"><div className="map__loading-value" /></div>
          <p className="map__loading-note">{caption}</p>
        </div>
      )}
      {children}
      {selected && createPortal(popup, popupHost)}
    </div>
  );
}
