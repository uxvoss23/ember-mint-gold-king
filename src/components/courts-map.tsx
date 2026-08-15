import { useEffect, useRef, useState } from "react";
import type { Court, UserLocation } from "@/lib/courts/types";
import type { Player } from "@/lib/upset/types";
import { cn } from "@/lib/utils";

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
}

type MapStyle = "satellite" | "street";

function asIdSet(ids?: Set<string> | string[]): Set<string> {
  if (!ids) return new Set();
  return ids instanceof Set ? ids : new Set(ids);
}

export function CourtsMap({
  courts,
  location,
  selectedId,
  onSelect,
  kings = {},
  openGames = {},
  hoopingNowIds,
  variant = "scene",
  mapClassName,
  bare = false,
}: CourtsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markersRef = useRef<import("maplibre-gl").Marker[]>([]);
  const pinElsRef = useRef<Map<string, HTMLElement>>(new Map());
  const [style, setStyle] = useState<MapStyle>("street");
  const [ready, setReady] = useState(false);
  const [zoomTick, setZoomTick] = useState(0);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const hoopingRef = useRef(asIdSet(hoopingNowIds));
  hoopingRef.current = asIdSet(hoopingNowIds);
  const hoopingKey = [...asIdSet(hoopingNowIds)].sort().join(",");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!containerRef.current || mapRef.current) return;
      const maplibregl = await import("maplibre-gl");
      await import("maplibre-gl/dist/maplibre-gl.css");
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: STREET_STYLE,
        center: [location.lon, location.lat],
        zoom: 10.4,
        minZoom: 9,
        maxZoom: 16,
        attributionControl: { compact: true },
        // Keep map from expanding past container / creating page scroll
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "bottom-right",
      );
      mapRef.current = map;
      map.on("load", () => {
        if (!cancelled) {
          setReady(true);
          // Size after layout settles (sheet + full-bleed)
          requestAnimationFrame(() => {
            map.resize();
            requestAnimationFrame(() => map.resize());
          });
        }
      });
      map.on("zoomend", () => setZoomTick((t) => t + 1));

      const ro = new ResizeObserver(() => {
        map.resize();
      });
      if (containerRef.current) ro.observe(containerRef.current);
      (map as unknown as { __ro?: ResizeObserver }).__ro = ro;
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      pinElsRef.current.clear();
      const map = mapRef.current as
        | (import("maplibre-gl").Map & { __ro?: ResizeObserver })
        | null;
      map?.__ro?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const center = map.getCenter();
    const zoom = map.getZoom();
    map.setStyle(style === "satellite" ? SATELLITE_STYLE : STREET_STYLE);
    map.once("style.load", () => {
      map.setCenter(center);
      map.setZoom(zoom);
    });
  }, [style, ready]);

  // Rebuild pins when data/zoom/hooping changes — selection highlight is separate
  // Yield to the browser so first taps aren't blocked by marker DOM work
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    let cancelled = false;
    let idleId: number | null = null;
    let timeoutId: number | null = null;

    const run = async () => {
      const maplibregl = await import("maplibre-gl");
      const map = mapRef.current;
      if (!map || cancelled) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      pinElsRef.current.clear();

      const youEl = document.createElement("div");
      youEl.innerHTML = `<div class="uc-you"></div>`;
      markersRef.current.push(
        new maplibregl.Marker({ element: youEl, anchor: "center" })
          .setLngLat([location.lon, location.lat])
          .addTo(map),
      );

      const zoom = map.getZoom();
      const cluster = zoom < 11.5 && courts.length > 8;
      const isFinder = variant === "finder";
      const sel = selectedIdRef.current;
      const hooping = hoopingRef.current;

      const placePin = (c: Court) => {
        const king = kings[c.id];
        const open = openGames[c.id] ?? 0;
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
          ${
            selected
              ? `<div class="uc-pin-label">${esc(c.name)}${live ? " · Hooping now" : ""}</div>`
              : ""
          }
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
        pin.getElement().style.zIndex = live ? "6" : "5";
        markersRef.current.push(pin);
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
            markersRef.current.push(cl);
          }
        }
      } else {
        for (const c of courts.slice(0, 80)) placePin(c);
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
          markersRef.current.push(chip);
        }
      }

      if (courts.length > 0 && zoomTick === 0) {
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
      cancelled = true;
      if (idleId != null && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idleId);
      }
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [
    courts,
    location.lat,
    location.lon,
    kings,
    openGames,
    ready,
    zoomTick,
    variant,
    hoopingKey,
  ]);

  // Instant select highlight without full pin rebuild
  useEffect(() => {
    for (const [id, el] of pinElsRef.current) {
      if (id === selectedId) el.classList.add("uc-pin-selected");
      else el.classList.remove("uc-pin-selected");
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
        <div className="absolute inset-0 flex items-center justify-center bg-bg-elevated">
          <div className="h-8 w-8 animate-pulse rounded-full bg-bg-subtle" />
        </div>
      )}
      <div className="absolute top-3 left-3 z-10 flex rounded-full border border-border bg-bg/90 p-0.5 shadow-soft backdrop-blur-md">
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

const STREET_STYLE: import("maplibre-gl").StyleSpecification = {
  version: 8,
  name: "Upset City Street",
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "&copy; OSM &copy; CARTO",
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
