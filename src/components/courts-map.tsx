import { useEffect, useMemo, useRef, useState } from "react";
import type { Court, UserLocation } from "@/lib/courts/types";
import type { Player } from "@/lib/upset/types";
import { ucMark } from "@/lib/perf/uc-mark";
import { cn } from "@/lib/utils";
import { acquireMap, parkMap, takeWarmMap } from "@/lib/maps/engine";
import {
  bindCourtLayerClicks,
  hydrateCourtLayers,
} from "@/lib/maps/court-layers";

interface CourtsMapProps {
  courts: Court[];
  location: UserLocation;
  selectedId?: string | null;
  onSelect: (court: Court) => void;
  kings?: Record<string, Player | null | undefined>;
  openGames?: Record<string, number>;
  /** Court ids with live "Hooping now" check-ins */
  hoopingNowIds?: Set<string> | string[];
  /** Finder mode: simple pins + hover name labels */
  variant?: "scene" | "finder";
  /** Override map container classes (e.g. fixed height for create flow) */
  mapClassName?: string;
  /** Drop outer card chrome (for full-bleed split layouts) */
  bare?: boolean;
  /** Frame the map around you + the selected court (create flow). */
  frameSelection?: boolean;
  /** Re-run framing when chrome around the map changes (filters open/close). */
  layoutKey?: string | number | boolean;
  /** Pan (no zoom) so the selected pin stays in the uncovered map area. */
  followSelection?: boolean;
  /** Percent of the map height covered by a bottom sheet overlay. */
  followBottomPct?: number;
  styleToggleClassName?: string;
}

type MapStyle = "satellite" | "street";

const EMPTY_KINGS: Record<string, Player | null | undefined> = {};
const EMPTY_OPEN: Record<string, number> = {};
let maplibreMod: typeof import("maplibre-gl") | null = null;

function constrainedMobile(): boolean {
  if (typeof window === "undefined") return false;
  const cores = navigator.hardwareConcurrency || 8;
  return window.innerWidth < 520 || cores <= 4;
}

function streetStyle(): import("maplibre-gl").StyleSpecification {
  return {
    version: 8,
    name: "Upset City Street",
    sources: {
      carto: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: "Tiles &copy; Esri",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#e8e0d4" } },
      {
        id: "carto",
        type: "raster",
        source: "carto",
        paint: {
          "raster-saturation": -0.35,
          "raster-contrast": -0.08,
          "raster-brightness-min": 0.04,
          "raster-brightness-max": 0.9,
          "raster-opacity": 0.94,
        },
      },
    ],
  };
}

function asIdSet(ids?: Set<string> | string[]): Set<string> {
  if (!ids) return new Set();
  return ids instanceof Set ? ids : new Set(ids);
}

const MIN_FRAME_SPAN = 0.012;

function fitUserAndCourt(
  map: import("maplibre-gl").Map,
  user: { lat: number; lon: number },
  court: { lat: number; lon: number },
  duration: number,
) {
  const el = map.getContainer();
  const h = el.clientHeight;
  const w = el.clientWidth;
  if (h < 48 || w < 48) return;

  let west = Math.min(user.lon, court.lon);
  let east = Math.max(user.lon, court.lon);
  let south = Math.min(user.lat, court.lat);
  let north = Math.max(user.lat, court.lat);
  if (east - west < MIN_FRAME_SPAN) {
    const mid = (east + west) / 2;
    west = mid - MIN_FRAME_SPAN / 2;
    east = mid + MIN_FRAME_SPAN / 2;
  }
  if (north - south < MIN_FRAME_SPAN) {
    const mid = (north + south) / 2;
    south = mid - MIN_FRAME_SPAN / 2;
    north = mid + MIN_FRAME_SPAN / 2;
  }

  const padTop = Math.min(88, Math.max(56, Math.round(h * 0.2)));
  const padBottom = Math.min(110, Math.max(72, Math.round(h * 0.26)));
  const padX = Math.min(64, Math.max(40, Math.round(w * 0.14)));

  map.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    {
      padding: { top: padTop, bottom: padBottom, left: padX, right: padX },
      maxZoom: 13,
      duration,
    },
  );
}

/** Pan only — keep current zoom. No-op if the pin is already in the open map. */
function revealCourtIfNeeded(
  map: import("maplibre-gl").Map,
  court: { lat: number; lon: number },
  bottomPct: number,
  duration: number,
) {
  const el = map.getContainer();
  const h = el.clientHeight;
  const w = el.clientWidth;
  if (h < 48 || w < 48) return;

  const padTop = 72;
  const padBottom = Math.max(
    72,
    Math.round((h * Math.min(92, Math.max(18, bottomPct))) / 100) + 10,
  );
  const padX = 36;
  const visTop = padTop;
  const visBottom = h - padBottom;
  if (visBottom - visTop < 88) return;

  const pt = map.project([court.lon, court.lat]);
  const margin = 32;
  const inside =
    pt.x >= padX + margin &&
    pt.x <= w - padX - margin &&
    pt.y >= visTop + margin &&
    pt.y <= visBottom - margin;
  if (inside) return;

  const targetX = w / 2;
  const targetY = visTop + (visBottom - visTop) * 0.45;
  const centerPx = map.project(map.getCenter());
  const next = map.unproject([
    centerPx.x + (pt.x - targetX),
    centerPx.y + (pt.y - targetY),
  ]);
  map.easeTo({
    center: [next.lng, next.lat],
    duration,
    essential: true,
  });
}

export function CourtsMap({
  courts,
  location,
  selectedId,
  onSelect,
  kings = EMPTY_KINGS,
  openGames = EMPTY_OPEN,
  hoopingNowIds,
  variant = "scene",
  mapClassName,
  bare = false,
  frameSelection = false,
  layoutKey,
  followSelection = false,
  followBottomPct = 50,
  styleToggleClassName,
}: CourtsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markersRef = useRef<import("maplibre-gl").Marker[]>([]);
  const youMarkerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const pinElsRef = useRef<Map<string, HTMLElement>>(new Map());
  const pinGenRef = useRef(0);
  const courtsRef = useRef(courts);
  courtsRef.current = courts;
  const kingsRef = useRef(kings);
  kingsRef.current = kings;
  const openGamesRef = useRef(openGames);
  openGamesRef.current = openGames;
  const fittingRef = useRef(false);
  const followPadRef = useRef(followBottomPct);
  followPadRef.current = followBottomPct;
  const didOverviewRef = useRef(false);
  const [style, setStyle] = useState<MapStyle>("street");
  const [ready, setReady] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [clusterMode, setClusterMode] = useState(false);
  const courtsKey = useMemo(() => courts.map((c) => c.id).join(","), [courts]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const hoopingRef = useRef(asIdSet(hoopingNowIds));
  hoopingRef.current = asIdSet(hoopingNowIds);
  const hoopingKey = [...asIdSet(hoopingNowIds)].sort().join(",");

  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el) return;
    ucMark("map:init-start");

    const attach = (warm: { map: import("maplibre-gl").Map; maplibregl: typeof import("maplibre-gl") }) => {
      if (cancelled || !warm?.map) return;
      maplibreMod = warm.maplibregl;
      mapRef.current = warm.map;
      setReady(true);
      ucMark("map:adopt");
      const valid = courtsRef.current.filter(
        (c) => Number.isFinite(c.lat) && Number.isFinite(c.lon),
      );
      console.info("[uc-debug] map:adopt", {
        courts: courtsRef.current.length,
        valid: valid.length,
        canvasInEl: el.contains(warm.map.getCanvas()),
        center: warm.map.getCenter(),
        zoom: warm.map.getZoom(),
        size: `${el.clientWidth}x${el.clientHeight}`,
      });
      try {
        hydrateCourtLayers(warm.map);
        bindCourtLayerClicks(warm.map, (id) => {
          const c = courtsRef.current.find((x) => x.id === id);
          if (c) onSelectRef.current(c);
        });
      } catch {
        /* style still loading — engine load handler hydrates */
      }
      const map = warm.map;
      map.on("error", (e: { error?: { message?: string } }) => {
        console.info("[uc-debug] map:error", e?.error?.message ?? e);
        if (!cancelled) setTileError(true);
      });
      map.on("zoomend", () => {
        if (fittingRef.current) return;
        const next = map.getZoom() < 11.5 && courtsRef.current.length > 8;
        setClusterMode((prev) => (prev === next ? prev : next));
      });
      let resizeRaf = 0;
      const ro = new ResizeObserver(() => {
        if (resizeRaf) return;
        resizeRaf = requestAnimationFrame(() => {
          resizeRaf = 0;
          try {
            map.resize();
          } catch {
            /* map parked */
          }
        });
      });
      ro.observe(el);
      (map as unknown as { __ro?: ResizeObserver }).__ro = ro;
      requestAnimationFrame(() => {
        try {
          map.resize();
          map.triggerRepaint();
        } catch {
          /* parked */
        }
      });
    };

    const existing = takeWarmMap(el);
    if (existing) {
      attach(existing);
    } else {
      void acquireMap(el)
        .then((warm) => {
          if (!cancelled) attach(warm);
        })
        .catch(() => {
          if (!cancelled) {
            setTileError(true);
            setReady(true);
          }
        });
    }

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      pinElsRef.current.clear();
      youMarkerRef.current?.remove();
      youMarkerRef.current = null;
      const map = mapRef.current as
        | (import("maplibre-gl").Map & { __ro?: ResizeObserver })
        | null;
      map?.__ro?.disconnect();
      parkMap(el);
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const el = containerRef.current;
    if (!map || !ready || !el) return;
    const pause = () => {
      try {
        map.stop();
      } catch {
        /* map already gone */
      }
    };
    const resume = () => {
      try {
        map.resize();
        map.triggerRepaint();
      } catch {
        /* map already gone */
      }
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio > 0.05) resume();
      },
      { threshold: [0, 0.05, 0.2] },
    );
    io.observe(el);
    const onVis = () => {
      if (document.hidden) pause();
      else resume();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ready]);

  const styleBootRef = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (styleBootRef.current) {
      styleBootRef.current = false;
      return;
    }
    const center = map.getCenter();
    const zoom = map.getZoom();
    map.setStyle(style === "satellite" ? SATELLITE_STYLE : streetStyle());
    map.once("style.load", () => {
      map.setCenter(center);
      map.setZoom(zoom);
      try {
        hydrateCourtLayers(map);
      } catch {
        /* ignore */
      }
    });
  }, [style, ready]);

  // Rebuild pins when data/zoom/hooping changes — selection highlight is separate
  // Yield to the browser so first taps aren't blocked by marker DOM work
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const gen = ++pinGenRef.current;
    let idleId: number | null = null;
    let timeoutId: number | null = null;

    const run = async () => {
      ucMark("map:pins-start");
      const maplibregl = maplibreMod ?? (await import("maplibre-gl"));
      maplibreMod = maplibregl;
      const map = mapRef.current;
      if (!map || pinGenRef.current !== gen) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      pinElsRef.current.clear();
      try {
        if (map.getLayer("uc-courts-pin")) {
          map.setLayoutProperty("uc-courts-pin", "visibility", "none");
        }
        const bag = map as { __ucPill?: HTMLDivElement };
        if (bag.__ucPill) bag.__ucPill.hidden = true;
      } catch {
        /* layer may not exist yet */
      }
      const placed: import("maplibre-gl").Marker[] = [];
      const placeMarker = (marker: import("maplibre-gl").Marker) => {
        if (pinGenRef.current !== gen) {
          marker.remove();
          return false;
        }
        placed.push(marker);
        markersRef.current = placed;
        return true;
      };

      const zoom = map.getZoom();
      const cluster = clusterMode || (zoom < 11.5 && courts.length > 8);
      const isFinder = variant === "finder";
      const sel = selectedIdRef.current;
      const hooping = hoopingRef.current;
      const kingsNow = kingsRef.current;
      const openNow = openGamesRef.current;

      const placePin = (c: Court) => {
        if (pinGenRef.current !== gen) return;
        const king = kingsNow[c.id];
        const open = openNow[c.id] ?? 0;
        const selected = c.id === sel;
        const live = hooping.has(c.id);
        const el = document.createElement("div");
        el.dataset.courtId = c.id;
        el.className = [
          "uc-pin",
          isFinder ? "uc-pin-finder-wrap" : "",
          selected ? "uc-pin-selected" : "",
          live ? "uc-pin-hooping" : "",
          !isFinder && !king && !live ? "uc-pin-open" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const initials = king
          ? king.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
          : "";

        el.innerHTML = isFinder
          ? `
          <div class="uc-pin-face uc-pin-finder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="10" r="3"/><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/></svg>
          </div>
          ${live ? `<span class="uc-hoop-badge">NOW</span>` : ""}
          <div class="uc-pin-hover">${esc(c.name)}${live ? " · Hooping" : ""}</div>
          <div class="uc-pin-label">${esc(c.name)}${live ? " · Hooping now" : ""}</div>
        `
          : `
          <div class="uc-pin-face" style="${king && !live ? `background:oklch(0.42 0.08 ${king.hue})` : ""}">
            ${
              king
                ? `<span>${initials}</span>`
                : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`
            }
          </div>
          ${open > 0 ? `<span class="uc-badge">${open}</span>` : ""}
          ${live ? `<span class="uc-hoop-badge">NOW</span>` : ""}
          <div class="uc-pin-hover">${esc(c.name)}</div>
          ${
            selected
              ? `<div class="uc-pin-label">${esc(c.name)}${king ? ` · ${esc(king.name)} runs this court` : " · Unclaimed"}</div>`
              : !king
                ? `<div class="uc-pin-sub">Unclaimed</div>`
                : ""
          }
        `;

        el.addEventListener("mouseenter", () => {
          el.classList.add("uc-pin-hovering");
        });
        el.addEventListener("mouseleave", () => {
          el.classList.remove("uc-pin-hovering");
        });

        let lastPick = 0;
        let downX = 0;
        let downY = 0;
        el.addEventListener("pointerdown", (e) => {
          downX = e.clientX;
          downY = e.clientY;
        });
        el.addEventListener("pointerup", (e) => {
          const moved =
            Math.abs(e.clientX - downX) > 8 || Math.abs(e.clientY - downY) > 8;
          if (moved) return;
          e.preventDefault();
          e.stopPropagation();
          const now = Date.now();
          if (now - lastPick < 280) return;
          lastPick = now;
          onSelectRef.current(c);
        });
        el.style.pointerEvents = "auto";
        el.style.cursor = "pointer";
        el.style.touchAction = "manipulation";
        pinElsRef.current.set(c.id, el);
        const pin = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([c.lon, c.lat])
          .addTo(map);
        pin.getElement().style.zIndex = selected || live ? "7" : "5";
        placeMarker(pin);
      };

      if (cluster) {
        const buckets = new Map<string, Court[]>();
        for (const c of courts) {
          const key = `${c.lat.toFixed(2)},${c.lon.toFixed(2)}`;
          const arr = buckets.get(key) ?? [];
          arr.push(c);
          buckets.set(key, arr);
        }
        for (const group of buckets.values()) {
          if (group.length === 1) {
            placePin(group[0]!);
          } else {
            const lat = group.reduce((s, c) => s + c.lat, 0) / group.length;
            const lon = group.reduce((s, c) => s + c.lon, 0) / group.length;
            const anyLive = group.some((c) => hooping.has(c.id));
            const el = document.createElement("div");
            el.className = cn("uc-cluster", anyLive && "uc-cluster-hooping");
            el.textContent = String(group.length);
            el.onclick = () =>
              map.easeTo({
                center: [lon, lat],
                zoom: Math.min(zoom + 1.4, 13),
                duration: 350,
              });
            const cl = new maplibregl.Marker({ element: el, anchor: "center" })
              .setLngLat([lon, lat])
              .addTo(map);
            cl.getElement().style.zIndex = "5";
            placeMarker(cl);
          }
        }
      } else {
        const zoomClose = zoom >= 12.2;
        const bounds = zoomClose ? map.getBounds() : null;
        let shown = 0;
        for (const c of courts) {
          if (shown >= 80) break;
          if (bounds) {
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            const pad = 0.02;
            if (
              c.lat < sw.lat - pad ||
              c.lat > ne.lat + pad ||
              c.lon < sw.lng - pad ||
              c.lon > ne.lng + pad
            ) {
              continue;
            }
          }
          placePin(c);
          shown += 1;
        }
      }

      if (sel && !pinElsRef.current.has(sel)) {
        const selectedCourt = courts.find((c) => c.id === sel);
        if (selectedCourt) placePin(selectedCourt);
      }

      // Neighborhood banners — sit ABOVE the northernmost pin, never on it
      if (zoom < 13) {
        const zones = new Map<
          string,
          { lat: number; lon: number; n: number; maxLat: number }
        >();
        for (const c of courts) {
          if (!c.neighborhood) continue;
          const z = zones.get(c.neighborhood) ?? {
            lat: 0,
            lon: 0,
            n: 0,
            maxLat: -Infinity,
          };
          z.lat += c.lat;
          z.lon += c.lon;
          z.n += 1;
          z.maxLat = Math.max(z.maxLat, c.lat);
          zones.set(c.neighborhood, z);
        }
        for (const [name, z] of zones) {
          const el = document.createElement("div");
          el.className = "uc-zone";
          el.textContent = name;
          const lon = z.lon / z.n;
          // Well north of the top pin so the chip never sits on a marker
          const lat = z.maxLat + 0.009;
          const chip = new maplibregl.Marker({
            element: el,
            anchor: "bottom",
            offset: [0, -22],
          })
            .setLngLat([lon, lat])
            .addTo(map);
          chip.getElement().style.zIndex = "1";
          placeMarker(chip);
        }
      }

      let you = youMarkerRef.current;
      if (!you) {
        const el = document.createElement("div");
        el.className = "uc-you-wrap";
        el.innerHTML = `<div class="uc-you"></div>`;
        you = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([location.lon, location.lat])
          .addTo(map);
        youMarkerRef.current = you;
      } else {
        you.setLngLat([location.lon, location.lat]).addTo(map);
      }
      const youNode = you.getElement();
      youNode.classList.add("uc-you-wrap");
      youNode.style.zIndex = "10000";
      youNode.style.pointerEvents = "none";
      console.info("[uc-debug] map:pins", {
        html: pinElsRef.current.size,
        markers: markersRef.current.length,
        geoLayer: !!map.getLayer("uc-courts-pin"),
        zoom: map.getZoom(),
      });

      if (courts.length > 0 && !frameSelection && !didOverviewRef.current) {
        didOverviewRef.current = true;
        const bounds = new maplibregl.LngLatBounds();
        bounds.extend([location.lon, location.lat]);
        for (const c of courts.slice(0, 40)) bounds.extend([c.lon, c.lat]);
        // Wider view so edges + labels stay readable; extra bottom pad for sheet
        const pad =
          variant === "finder"
            ? { top: 56, bottom: 120, left: 36, right: 36 }
            : 56;
        map.fitBounds(bounds, {
          padding: pad,
          maxZoom: variant === "finder" ? 11.6 : 12.2,
          duration: 450,
        });
      }
      ucMark("map:pins-done");
    };

    if (typeof requestIdleCallback === "function") {
      idleId = requestIdleCallback(() => {
        void run();
      }, { timeout: 250 }) as unknown as number;
    } else {
      timeoutId = window.setTimeout(() => {
        void run();
      }, 0);
    }

    return () => {
      if (idleId != null && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idleId);
      }
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [
    courtsKey,
    location.lat,
    location.lon,
    ready,
    clusterMode,
    variant,
    hoopingKey,
    frameSelection,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !frameSelection || !selectedId) return;
    const court = courtsRef.current.find((c) => c.id === selectedId);
    if (!court) return;
    let cancelled = false;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 0 : 220;

    fittingRef.current = true;
    const fit = () => {
      if (cancelled || !mapRef.current) return;
      map.resize();
      fitUserAndCourt(map, location, court, duration);
    };

    const raf = requestAnimationFrame(fit);
    const later = window.setTimeout(() => {
      fittingRef.current = false;
      ucMark("map:fit");
    }, duration + 40);
    return () => {
      cancelled = true;
      fittingRef.current = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(later);
    };
  }, [
    frameSelection,
    selectedId,
    ready,
    location.lat,
    location.lon,
    layoutKey,
  ]);

  useEffect(() => {
    if (!followSelection || frameSelection) return;
    const map = mapRef.current;
    if (!map || !ready || !selectedId) return;
    const court = courtsRef.current.find((c) => c.id === selectedId);
    if (!court) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 0 : 240;
    fittingRef.current = true;
    revealCourtIfNeeded(map, court, followPadRef.current, duration);
    const later = window.setTimeout(() => {
      fittingRef.current = false;
    }, duration + 40);
    return () => {
      fittingRef.current = false;
      window.clearTimeout(later);
    };
  }, [followSelection, frameSelection, selectedId, ready]);

  // Instant select highlight without full pin rebuild
  useEffect(() => {
    for (const [id, el] of pinElsRef.current) {
      const on = id === selectedId;
      if (on) {
        el.classList.add("uc-pin-selected");
        el.classList.remove("uc-pin-hovering");
        el.style.zIndex = "7";
      } else {
        el.classList.remove("uc-pin-selected");
        if (!el.classList.contains("uc-pin-hooping")) el.style.zIndex = "5";
      }
    }
  }, [selectedId]);

  return (
    <div
      className={cn(
        bare
          ? "relative h-full w-full max-w-full overflow-hidden"
          : "relative max-w-full overflow-hidden rounded-2xl border border-border bg-bg-elevated",
        mapClassName,
      )}
    >
      <div
        ref={containerRef}
        className={cn(
          "uc-map h-full w-full max-w-full overflow-hidden",
          bare ? "min-h-0" : "aspect-[4/5] sm:aspect-[16/11]",
        )}
      />
      {!ready && (
        <div
          data-uc-map-pending
          className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 bg-bg-elevated"
        >
          <div className="h-8 w-8 animate-pulse rounded-full bg-bg-subtle" />
          <p className="text-[11px] font-medium text-fg-muted">Loading map…</p>
        </div>
      )}
      {tileError && ready ? (
        <div className="absolute bottom-16 left-3 right-3 z-10 rounded-xl border border-border bg-bg/95 px-3 py-2 text-[11px] text-fg-muted shadow-soft">
          Map tiles didn’t load. The court list still works.
          <button
            type="button"
            className="ml-2 font-semibold text-court underline-offset-2 hover:underline"
            onClick={() => {
              const map = mapRef.current;
              if (!map) return;
              setTileError(false);
              try {
                map.resize();
                map.triggerRepaint();
                hydrateCourtLayers(map);
              } catch {
                setTileError(true);
              }
            }}
          >
            Retry map
          </button>
        </div>
      ) : null}
      <div className={cn("absolute top-3 left-3 z-10 flex rounded-full border border-border bg-bg/90 p-0.5 shadow-soft backdrop-blur-md", styleToggleClassName)}>
        {(
          [
            { id: "street" as const, label: "Street" },
            { id: "satellite" as const, label: "Satellite" },
          ] as const
        ).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStyle(s.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              style === s.id
                ? "bg-accent text-accent-fg"
                : "text-fg-muted hover:text-fg",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {!bare && (
        <div className="absolute right-3 bottom-10 z-10 rounded-full border border-border bg-bg/85 px-2.5 py-1 text-[11px] font-medium text-fg-muted backdrop-blur-sm">
          {courts.length} courts
          {asIdSet(hoopingNowIds).size > 0
            ? ` · ${asIdSet(hoopingNowIds).size} live`
            : ""}
        </div>
      )}
    </div>
  );
}

function esc(s: string) {
  return s
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;")
    .replace(/'/g, "&#39;");
}

const SATELLITE_STYLE: import("maplibre-gl").StyleSpecification = {
  version: 8,
  name: "Upset City Satellite",
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles &copy; Esri",
    },
  },
  layers: [
    {
      id: "esri",
      type: "raster",
      source: "esri",
      paint: { "raster-saturation": -0.12, "raster-contrast": 0.06 },
    },
  ],
};
