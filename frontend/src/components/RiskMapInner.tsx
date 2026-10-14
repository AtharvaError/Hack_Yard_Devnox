"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";

export type MapPoint = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  color: string;
  /** Second line of the hover popup, e.g. "Hospital Â· High risk". */
  label: string;
  /** Draws a white ring to mark a selected asset. */
  ring?: boolean;
};

export type RiskMapProps = {
  center: [number, number]; // [lon, lat]
  points: MapPoint[];
  onSelect?: (id: number) => void;
  links?: { from: [number, number]; to: [number, number] }[];
  route?: { type: "LineString"; coordinates: [number, number][] } | null;
  pin?: [number, number] | null;
  onMapClick?: (lat: number, lon: number) => void;
  /** YYYY-MM-DD; shows that day's NASA satellite image under the assets. */
  satelliteDate?: string | null;
  className?: string;
};

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

// OpenFreeMap: free vector basemap built from OpenStreetMap, no API key or usage limit.
const BASE_STYLE = "https://tiles.openfreemap.org/styles/dark";

function setData(map: maplibregl.Map, source: string, data: GeoJSON.GeoJSON) {
  (map.getSource(source) as maplibregl.GeoJSONSource | undefined)?.setData(data);
}

export default function RiskMapInner(props: RiskMapProps) {
  const { center, points, links, route, pin, satelliteDate, className = "h-[520px]" } = props;
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pinRef = useRef<maplibregl.Marker | null>(null);
  const [ready, setReady] = useState(false);
  // Latest callbacks, so map event handlers registered once never go stale.
  const handlers = useRef(props);
  handlers.current = props;

  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: BASE_STYLE,
      center: handlers.current.center,
      zoom: 11.5,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });

    map.on("load", () => {
      map.addSource("links", { type: "geojson", data: EMPTY });
      map.addSource("route", { type: "geojson", data: EMPTY });
      map.addSource("assets", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "links",
        type: "line",
        source: "links",
        paint: { "line-color": "#7c5cff", "line-width": 1.6, "line-opacity": 0.85, "line-dasharray": [2, 2] },
      });
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#00e5ff", "line-width": 5, "line-opacity": 0.95 },
      });
      map.addLayer({
        id: "assets",
        type: "circle",
        source: "assets",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 3.5, 13, 7, 16, 11],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.92,
          "circle-stroke-color": ["case", ["get", "ring"], "#ffffff", "#05060d"],
          "circle-stroke-width": ["case", ["get", "ring"], 2.5, 1],
        },
      });

      map.on("mousemove", "assets", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        map.getCanvas().style.cursor = "pointer";
        const p = feature.properties as { name: string; label: string };
        const node = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = p.name;
        const sub = document.createElement("div");
        sub.textContent = p.label;
        sub.style.opacity = "0.7";
        node.append(title, sub);
        popup.setLngLat(e.lngLat).setDOMContent(node).addTo(map);
      });
      map.on("mouseleave", "assets", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
      map.on("click", (e) => {
        const hit = map.queryRenderedFeatures(e.point, { layers: ["assets"] })[0];
        if (hit) handlers.current.onSelect?.(Number(hit.properties.id));
        else handlers.current.onMapClick?.(e.lngLat.lat, e.lngLat.lng);
      });
      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.jumpTo({ center, zoom: 11.5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1]]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    setData(mapRef.current, "assets", {
      type: "FeatureCollection",
      // Draw ringed and high-risk points last so they sit on top.
      features: [...points]
        .sort((a, b) => Number(!!a.ring) - Number(!!b.ring))
        .map((p) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [p.lon, p.lat] },
          properties: { id: p.id, name: p.name, label: p.label, color: p.color, ring: !!p.ring },
        })),
    });
  }, [ready, points]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    setData(mapRef.current, "links", {
      type: "FeatureCollection",
      features: (links ?? []).map((l) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates: [l.from, l.to] },
        properties: {},
      })),
    });
  }, [ready, links]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    setData(map, "route", route ? { type: "Feature", geometry: route, properties: {} } : EMPTY);
    if (route && route.coordinates.length > 1) {
      const bounds = new maplibregl.LngLatBounds(route.coordinates[0], route.coordinates[0]);
      route.coordinates.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, { padding: 70, maxZoom: 15 });
    }
  }, [ready, route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    pinRef.current?.remove();
    pinRef.current = pin ? new maplibregl.Marker({ color: "#00e5ff" }).setLngLat(pin).addTo(map) : null;
  }, [ready, pin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (map.getLayer("gibs")) map.removeLayer("gibs");
    if (map.getSource("gibs")) map.removeSource("gibs");
    if (!satelliteDate) return;
    map.addSource("gibs", {
      type: "raster",
      tiles: [
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${satelliteDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
      ],
      tileSize: 256,
      maxzoom: 9,
      attribution: "Imagery: NASA GIBS / MODIS Terra",
    });
    map.addLayer({ id: "gibs", type: "raster", source: "gibs", paint: { "raster-opacity": 0.85 } }, "links");
  }, [ready, satelliteDate]);

  return <div ref={container} className={`w-full overflow-hidden rounded-xl ${className}`} />;
}
