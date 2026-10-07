import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import topo from 'world-atlas/countries-110m.json';

// Present-day countries, used only so a reader can find their way around by a familiar name.
// Their outlines are never drawn: this app shows territory from its own sourced records.
export interface Country {
  name: string;
  lng: number;
  lat: number;
  zoom: number;
}

const world = topo as unknown as Topology;
const collection = feature(world, world.objects.countries) as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, { name: string }>;

export const countries: Country[] = collection.features.map((f) => {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  // Frame the largest piece, so a country with far-flung islands still centres on its mainland.
  const box = polys
    .map((p) => {
      const xs = p[0].map((c) => c[0]), ys = p[0].map((c) => c[1]);
      return { w: Math.min(...xs), e: Math.max(...xs), s: Math.min(...ys), n: Math.max(...ys) };
    })
    .sort((a, b) => (b.e - b.w) * (b.n - b.s) - (a.e - a.w) * (a.n - a.s))[0];
  const span = Math.max(box.e - box.w, (box.n - box.s) * 1.6, 1);
  return { name: f.properties.name, lng: (box.w + box.e) / 2, lat: (box.s + box.n) / 2, zoom: Math.min(7, Math.max(1.5, Math.log2(360 / span) + 0.6)) };
}).sort((a, b) => a.name.localeCompare(b.name));
