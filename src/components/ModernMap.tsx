import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * A plain present-day basemap — no territory grid, no attested places, nothing historical.
 * Used only as the "modern reference" half of the historical-vs-modern comparison; everything
 * historical still comes from HistoricalMap, which is the one place that data is allowed to live.
 *
 * Uses MapLibre's own open demo style (no key, meant for exactly this — evaluation and reference
 * use). It is NOT a production basemap: the FE handoff notes call for a real OpenStreetMap-based
 * provider (MapTiler, Stadia, or a self-hosted tile server) before this ships. Swap MODERN_STYLE
 * for that when one is chosen.
 */
const MODERN_STYLE = 'https://demotiles.maplibre.org/style.json';

interface Props {
  center: [number, number];
  zoom: number;
  caption: string;
  onMoveEnd?: (center: [number, number], zoom: number) => void;
}

export default function ModernMap({ center, zoom, caption, onMoveEnd }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const live = useRef(onMoveEnd);
  live.current = onMoveEnd;
  const syncing = useRef(false);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: holder.current!,
      style: MODERN_STYLE,
      center,
      zoom,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;
    map.on('moveend', () => {
      if (syncing.current) return;
      live.current?.([map.getCenter().lng, map.getCenter().lat], map.getZoom());
    });
    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const same = Math.abs(map.getCenter().lng - center[0]) < 1e-6 && Math.abs(map.getCenter().lat - center[1]) < 1e-6 && Math.abs(map.getZoom() - zoom) < 1e-6;
    if (same) return;
    syncing.current = true;
    map.jumpTo({ center, zoom });
    syncing.current = false;
  }, [center, zoom]);

  return (
    <div className="map modern-map">
      <div ref={holder} className="map__canvas" />
      <div className="map__scale modern-map__caption"><p>{caption}</p></div>
    </div>
  );
}
