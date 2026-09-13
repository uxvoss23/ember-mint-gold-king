/** Isolated MapV2 prototype. Does not touch the production map instance. */

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { catalogNear, DEFAULT_CITY } from "@/lib/courts/catalog";
import { loadMapV2Style } from "@/lib/maps/map-v2-style";
import styles from "./map-v2.module.css";

const WORKER = "/maplibre/maplibre-gl-worker.mjs";
const TERRAIN_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const TEST_IDS = [
  "cat-wooldridge",
  "cat-butler",
  "cat-pease",
  "cat-rosewood",
  "cat-eastwoods",
] as const;
const SELECTED_ID = "cat-wooldridge";

type Caps = {
  buildings: boolean;
  terrain: boolean;
  pins: number;
  errors: string[];
};

function pinImage(selected: boolean): ImageData {
  const dpr = 3;
  const cssW = selected ? 40 : 32;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil((cssW + 12) * dpr);
  canvas.height = Math.ceil((cssW * (42 / 32) + 12) * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.translate(6, 3);
  ctx.scale(cssW / 32, cssW / 32);
  const path = new Path2D(
    "M16 39.6C16.5 30.4 28.2 23.1 28.2 14.2A12.2 12.2 0 1 0 3.8 14.2C3.8 23.1 15.5 30.4 16 39.6Z",
  );
  if (selected) {
    const glow = ctx.createRadialGradient(16, 16, 2, 16, 16, 16);
    glow.addColorStop(0, "rgba(242,78,8,0.55)");
    glow.addColorStop(1, "rgba(242,78,8,0)");
    ctx.beginPath();
    ctx.arc(16, 16, 16, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(16, 40.5, selected ? 5.4 : 4, selected ? 1.5 : 1.1, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fill();
  ctx.fillStyle = selected ? "#141414" : "#F24E08";
  ctx.fill(path);
  ctx.lineJoin = "round";
  ctx.strokeStyle = selected ? "#F24E08" : "#fff";
  ctx.lineWidth = selected ? 2.6 : 2.15;
  ctx.stroke(path);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(16, 13.7, 6.05, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(10, 13.7);
  ctx.lineTo(22, 13.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(14.5, 8.15);
  ctx.bezierCurveTo(10.55, 10.55, 10.55, 16.85, 14.5, 19.25);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(17.5, 8.15);
  ctx.bezierCurveTo(21.45, 10.55, 21.45, 16.85, 17.5, 19.25);
  ctx.stroke();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function addTerrain(map: maplibregl.Map, caps: Caps) {
  try {
    if (!map.getSource("uc-v2-terrain")) {
      map.addSource("uc-v2-terrain", {
        type: "raster-dem",
        tiles: [TERRAIN_TILES],
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 15,
      });
    }
    map.setTerrain({ source: "uc-v2-terrain", exaggeration: 1.15 });
    caps.terrain = true;
  } catch (err) {
    caps.terrain = false;
    caps.errors.push(`terrain: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function addPins(map: maplibregl.Map, caps: Caps) {
  const courts = catalogNear(DEFAULT_CITY.lat, DEFAULT_CITY.lon, 50 * 1609.34, 40).filter((c) =>
    (TEST_IDS as readonly string[]).includes(c.id),
  );
  if (!map.hasImage("uc-v2-idle")) map.addImage("uc-v2-idle", pinImage(false), { pixelRatio: 3 });
  if (!map.hasImage("uc-v2-sel")) map.addImage("uc-v2-sel", pinImage(true), { pixelRatio: 3 });
  if (!map.getSource("uc-v2-courts")) {
    map.addSource("uc-v2-courts", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: courts.map((c) => ({
          type: "Feature" as const,
          properties: { id: c.id, name: c.name, selected: c.id === SELECTED_ID ? 1 : 0 },
          geometry: { type: "Point" as const, coordinates: [c.lon, c.lat] },
        })),
      },
    });
  }
  if (!map.getLayer("uc-v2-pins")) {
    map.addLayer({
      id: "uc-v2-pins",
      type: "symbol",
      source: "uc-v2-courts",
      layout: {
        "icon-image": ["case", ["==", ["get", "selected"], 1], "uc-v2-sel", "uc-v2-idle"],
        "icon-pitch-alignment": "viewport",
        "icon-rotation-alignment": "viewport",
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "symbol-sort-key": ["get", "selected"],
      },
    });
  }
  caps.pins = courts.length;
}

export function MapV2() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let map: maplibregl.Map | null = null;
    let cancelled = false;
    const caps: Caps = { buildings: false, terrain: false, pins: 0, errors: [] };

    (async () => {
      try {
        maplibregl.setWorkerUrl(WORKER);
      } catch {
        /* already set */
      }
      let style;
      try {
        style = await loadMapV2Style();
      } catch (err) {
        caps.errors.push(`style: ${err instanceof Error ? err.message : String(err)}`);
        (window as unknown as { __ucMapV2Caps?: Caps }).__ucMapV2Caps = caps;
        return;
      }
      if (cancelled || !hostRef.current) return;
      map = new maplibregl.Map({
        container: hostRef.current,
        style,
        center: [-97.7431, 30.2686],
        zoom: 15.05,
        pitch: 58,
        bearing: -22,
        minZoom: 11,
        maxZoom: 17.5,
        maxPitch: 75,
        dragRotate: true,
        pitchWithRotate: true,
        fadeDuration: 0,
        attributionControl: { compact: true },
        canvasContextAttributes: {
          antialias: true,
          powerPreference: "default",
          preserveDrawingBuffer: true,
          failIfMajorPerformanceCaveat: false,
        },
      });
      const live = map;
      (window as unknown as { __ucMapV2?: maplibregl.Map }).__ucMapV2 = live;
      let booted = false;
      const boot = () => {
        if (booted) return;
        try {
          if (!live.getLayer("building")) return;
          caps.buildings = live.getLayer("building")?.type === "fill-extrusion";
          addTerrain(live, caps);
          addPins(live, caps);
          booted = true;
        } catch (err) {
          caps.errors.push(`boot: ${err instanceof Error ? err.message : String(err)}`);
        }
        (window as unknown as { __ucMapV2Caps?: Caps }).__ucMapV2Caps = caps;
      };
      live.on("style.load", boot);
      live.on("styledata", boot);
      live.on("load", boot);
      if (live.isStyleLoaded()) boot();
      requestAnimationFrame(() => {
        live.resize();
        boot();
      });
      live.on("error", (e) => {
        const msg = e?.error?.message || e?.error?.toString?.() || "map error";
        if (!caps.errors.includes(msg)) caps.errors.push(msg);
        (window as unknown as { __ucMapV2Caps?: Caps }).__ucMapV2Caps = caps;
      });
    })();

    return () => {
      cancelled = true;
      try {
        map?.remove();
      } catch {
        /* already gone */
      }
    };
  }, []);

  return (
    <div className={styles.root}>
      <div ref={hostRef} className={styles.canvas} />
      <div className={styles.badge}>MAP V2 · PROTOTYPE</div>
      <div className={styles.note}>
        Pitched 3D city view. Production Courts map is unchanged.
      </div>
    </div>
  );
}
