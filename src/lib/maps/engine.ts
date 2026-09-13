/** Shared MapLibre loader + a single persistent Map instance. */

import { hydrateCourtLayers, bindLiveMapGetter, courtFeatureCount } from "./court-layers";

export type MapLibreNS = typeof import("maplibre-gl");

export type WarmMap = {
  map: import("maplibre-gl").Map;
  maplibregl: MapLibreNS;
  el: HTMLElement;
};

type MapHost = HTMLElement & { __ucMap?: WarmMap };

declare global {
  interface Window {
    __ucWarmMap?: WarmMap | null;
    __ucPerf?: { stage: string; t: number }[];
    __ucBootHidden?: boolean;
    __ucMapLock?: Promise<WarmMap> | null;
    __ucMapBoot?: boolean;
  }
}

const MAP_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";
const AUSTIN: [number, number] = [-97.7431, 30.2672];

let enginePromise: Promise<MapLibreNS> | null = null;
let live: WarmMap | null = null;
let lock: Promise<WarmMap> | null = null;
let lot: HTMLElement | null = null;

function mark(stage: string, extra?: string) {
  if (typeof performance === "undefined") return;
  const t = Math.round(performance.now());
  const w = window;
  if (!w.__ucPerf) w.__ucPerf = [];
  w.__ucPerf.push({ stage, t });
  try {
    console.info("[uc-map]", t, stage, extra ?? "");
  } catch {
    /* no console */
  }
}

function attachWorker(maplibregl: MapLibreNS) {
  try {
    maplibregl.setWorkerUrl(MAP_WORKER_URL);
  } catch {
    /* already configured */
  }
}

export function loadMapLibre(): Promise<MapLibreNS> {
  if (!enginePromise) {
    mark("map:engine-import");
    enginePromise = Promise.all([
      import("maplibre-gl"),
      import("maplibre-gl/dist/maplibre-gl.css"),
    ]).then(([m]) => {
      attachWorker(m);
      mark("map:engine-ready");
      return m;
    });
  }
  return enginePromise;
}

export function constrainedMobile(): boolean {
  if (typeof window === "undefined") return false;
  const cores = navigator.hardwareConcurrency || 8;
  return window.innerWidth < 520 || cores <= 4;
}

export function streetStyle(): import("maplibre-gl").StyleSpecification {
  return {
    version: 8,
    name: "Upset City Street",
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      carto: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: "Tiles © Esri",
      },
      labels: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#1a1d21" } },
      {
        id: "carto",
        type: "raster",
        source: "carto",
        paint: {
          "raster-saturation": 0.08,
          "raster-contrast": 0.1,
          "raster-brightness-min": 0,
          "raster-brightness-max": 0.56,
          "raster-opacity": 1,
        },
      },
      {
        id: "labels",
        type: "raster",
        source: "labels",
        paint: { "raster-opacity": 0.82 },
      },
    ],
  };
}

function parkingLot() {
  if (lot?.isConnected) return lot;
  lot = document.createElement("div");
  lot.id = "uc-map-lot";
  lot.setAttribute("aria-hidden", "true");
  lot.style.cssText =
    "position:fixed;left:-9999px;top:0;width:360px;height:360px;opacity:0;pointer-events:none;";
  document.body.appendChild(lot);
  return lot;
}

export function createStreetMap(
  maplibregl: MapLibreNS,
  container: HTMLElement,
  center: [number, number] = AUSTIN,
) {
  mark("map:constructor");
  if (window.__ucWarmMap?.map) {
    mark("map:constructor-blocked");
    return window.__ucWarmMap;
  }
  attachWorker(maplibregl);
  console.log("[MAP INSTANCE CREATED]", performance.now());
  const map = new maplibregl.Map({
    container,
    style: streetStyle(),
    center,
    zoom: 10.4,
    minZoom: 9,
    maxZoom: 16,
    attributionControl: { compact: true },
    dragRotate: false,
    pitchWithRotate: false,
    fadeDuration: 0,
    trackResize: true,
    pixelRatio: constrainedMobile() ? 1 : undefined,
    maxTileCacheSize: constrainedMobile() ? 80 : undefined,
    canvasContextAttributes: {
      antialias: false,
      powerPreference: constrainedMobile() ? "low-power" : "default",
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false,
    },
  });
  map.addControl(
    new maplibregl.NavigationControl({ showCompass: false }),
    "bottom-right",
  );
  mark("map:constructor-done", `${container.clientWidth}x${container.clientHeight}`);
  const bootPins = () => {
    try {
      hydrateCourtLayers(map);
      mark("map:pins-boot", String(courtFeatureCount()));
    } catch (err) {
      mark("map:pins-boot-fail");
      console.info("[uc-map]", Math.round(performance.now()), "map:pins-boot-fail", err);
    }
  };
  if (map.isStyleLoaded()) bootPins();
  map.on("load", bootPins);
  map.once("styledata", bootPins);
  const warm: WarmMap = { map, maplibregl, el: container };
  (container as MapHost).__ucMap = warm;
  return warm;
}

function rehome(warm: WarmMap, next: HTMLElement) {
  const map = warm.map;
  const prev = map.getContainer();
  if (prev !== next) {
    while (prev.firstChild) next.appendChild(prev.firstChild);
    (map as unknown as { _container: HTMLElement })._container = next;
    if ((prev as MapHost).__ucMap === warm) delete (prev as MapHost).__ucMap;
  }
  warm.el = next;
  live = warm;
  window.__ucWarmMap = warm;
  bindLiveMapGetter(() => live?.map ?? null);
  try {
    map.resize();
    map.triggerRepaint();
  } catch {
    /* size may still be 0 */
  }
}

export function bindWarmMap(maplibregl: MapLibreNS) {
  mark("map:bind-warm");
  if (typeof window === "undefined") return;
  if (window.__ucWarmMap?.map) {
    live = window.__ucWarmMap;
    bindLiveMapGetter(() => live?.map ?? null);
    mark("map:bind-reuse");
    return;
  }
  if (window.__ucMapBoot) {
    mark("map:bind-skip");
    return;
  }
  window.__ucMapBoot = true;
  attachWorker(maplibregl);
  const el = parkingLot();
  const warm = createStreetMap(maplibregl, el);
  live = warm;
  window.__ucWarmMap = warm;
  bindLiveMapGetter(() => live?.map ?? null);
}

export function takeWarmMap(el: HTMLElement): WarmMap | null {
  const w = live ?? window.__ucWarmMap ?? null;
  if (!w?.map) return null;
  rehome(w, el);
  return w;
}

export async function acquireMap(el: HTMLElement): Promise<WarmMap> {
  if (lock) {
    await lock;
  }
  const run = (async () => {
    if (live?.map && live.map.getContainer() === el) return live;
    if (live?.map || window.__ucWarmMap?.map) {
      const w = live ?? window.__ucWarmMap;
      if (w?.map) {
        rehome(w, el);
        return w;
      }
    }
    const maplibregl = await loadMapLibre();
    if (live?.map) {
      rehome(live, el);
      return live;
    }
    const warm = createStreetMap(maplibregl, el);
    live = warm;
    window.__ucWarmMap = warm;
    bindLiveMapGetter(() => live?.map ?? null);
    return warm;
  })();
  lock = run;
  try {
    return await run;
  } finally {
    if (lock === run) lock = null;
  }
}

export function mapIsOwner(map: import("maplibre-gl").Map, el: HTMLElement | null) {
  if (!el) return false;
  try {
    return map.getContainer() === el || el.contains(map.getCanvas());
  } catch {
    return false;
  }
}

export function parkMap(el?: HTMLElement | null) {
  const w = live ?? window.__ucWarmMap ?? null;
  if (!w?.map) return;
  const lotEl = parkingLot();
  if (w.map.getContainer() === lotEl) return;
  if (el && w.map.getContainer() !== el && !el.contains(w.map.getCanvas())) return;
  rehome(w, lotEl);
}

export function releaseMapEl(el?: HTMLElement | null) {
  if (!el) return;
  delete (el as MapHost).__ucMap;
  delete el.dataset.ucMapBound;
}

export function resetLiveMap() {
  try {
    live?.map.remove();
  } catch {
    /* already gone */
  }
  live = null;
  if (typeof window !== "undefined") {
    window.__ucWarmMap = null;
    window.__ucMapBoot = false;
  }
  lock = null;
  enginePromise = null;
}
