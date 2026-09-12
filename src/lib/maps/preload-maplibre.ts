/**
 * Separate module entry, started from the first HTML.
 * Static imports so the browser fetches MapLibre during document parse
 * and evaluates it before React hydrates.
 *
 * Do not import the worker via `?url` here — Vite's dep optimizer can
 * rewrite that to a missing `/node_modules/.vite/deps/maplibre-gl-worker.mjs`
 * and the whole preload module fails, leaving the map stuck on load.
 */
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { bindWarmMap } from "./engine";

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
bindWarmMap(maplibregl);

const later =
  typeof requestIdleCallback === "function"
    ? requestIdleCallback
    : (cb: () => void) => window.setTimeout(cb, 400);
later(() => {
  void import("@/components/compete/play-hub");
});
