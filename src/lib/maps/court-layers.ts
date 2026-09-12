/** MapLibre GeoJSON court pins — teardrop basketball markers. */

import type { Court } from "@/lib/courts/types";
import { catalogNear } from "@/lib/courts/catalog";
import { courtPinImageData } from "@/lib/maps/court-pin-art";

const SRC = "uc-courts";
const LAYER_PIN = "uc-courts-pin";
const LAYER_SHADOW = "uc-courts-shadow";
const LAYER_RING = "uc-courts-ring";
const LAYER_HALO = "uc-courts-halo";
const LAYER_LABEL = "uc-courts-label";
const ICON_IDLE = "uc-pin-idle-v13";
const ICON_SEL = "uc-pin-sel-v13";

const AUSTIN = { lat: 30.2672, lon: -97.7431 };
const SEED_RADIUS_M = 50 * 1609.34;

function collection(
  courts: Court[],
  hooping: Set<string>,
  selectedId?: string | null,
) {
  return {
    type: "FeatureCollection" as const,
    features: courts.map((c) => ({
      type: "Feature" as const,
      id: c.id,
      properties: {
        id: c.id,
        name: c.name,
        hooping: hooping.has(c.id) ? 1 : 0,
        selected: selectedId && c.id === selectedId ? 1 : 0,
      },
      geometry: { type: "Point" as const, coordinates: [c.lon, c.lat] as [number, number] },
    })),
  };
}

let pendingCourts: Court[] = [];
let pendingHooping = new Set<string>();
let pendingSelected: string | null = null;

type LiveMapFn = () => import("maplibre-gl").Map | null;
let liveMapFn: LiveMapFn | null = null;

type MapBag = import("maplibre-gl").Map & {
  __ucPill?: HTMLDivElement;
  __ucPillBound?: boolean;
};

export function bindLiveMapGetter(fn: LiveMapFn) {
  liveMapFn = fn;
}

function seedCatalog(): Court[] {
  if (pendingCourts.length) return pendingCourts;
  pendingCourts = catalogNear(AUSTIN.lat, AUSTIN.lon, SEED_RADIUS_M, 40);
  return pendingCourts;
}

function setPinImage(map: import("maplibre-gl").Map, id: string, img: ImageData) {
  if (map.hasImage(id)) return;
  map.addImage(id, img, { pixelRatio: 4 });
}

function ensurePinImages(map: import("maplibre-gl").Map) {
  setPinImage(map, ICON_IDLE, courtPinImageData(false));
  setPinImage(map, ICON_SEL, courtPinImageData(true));
}

export function publishCourts(courts: Court[], hooping: Set<string>, selectedId?: string | null) {
  pendingCourts = courts;
  pendingHooping = hooping;
  if (selectedId !== undefined) pendingSelected = selectedId ?? null;
  const map = liveMapFn?.();
  if (!map) return;
  try {
    setCourtFeatures(map, pendingCourts, pendingHooping, pendingSelected);
  } catch {
    /* style not ready */
  }
}

export function hydrateCourtLayers(map: import("maplibre-gl").Map) {
  seedCatalog();
  ensureCourtLayers(map);
  setCourtFeatures(map, pendingCourts, pendingHooping, pendingSelected);
}

export function ensureCourtLayers(map: import("maplibre-gl").Map) {
  if (!map.getSource(SRC)) {
    map.addSource(SRC, {
      type: "geojson",
      data: collection(seedCatalog(), pendingHooping, pendingSelected),
      promoteId: "id",
    });
  }
  ensurePinImages(map);

  for (const id of [LAYER_LABEL, LAYER_SHADOW, LAYER_RING, LAYER_HALO]) {
    if (map.getLayer(id)) {
      try {
        map.removeLayer(id);
      } catch {
        /* already gone */
      }
    }
  }

  const existing = map.getLayer(LAYER_PIN);
  if (existing && existing.type !== "symbol") {
    try {
      map.removeLayer(LAYER_PIN);
    } catch {
      /* already gone */
    }
  }

  if (!map.getLayer(LAYER_PIN)) {
    map.addLayer({
      id: LAYER_PIN,
      type: "symbol",
      source: SRC,
      layout: {
        "icon-image": ["case", ["==", ["get", "selected"], 1], ICON_SEL, ICON_IDLE],
        "icon-size": 1,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-anchor": "bottom",
        "icon-padding": 0,
      },
    });
  } else {
    try {
      map.setLayoutProperty(LAYER_PIN, "icon-anchor", "bottom");
      map.setLayoutProperty(LAYER_PIN, "icon-image", [
        "case",
        ["==", ["get", "selected"], 1],
        ICON_SEL,
        ICON_IDLE,
      ]);
    } catch {
      /* layout already applied */
    }
  }

  bindPill(map as MapBag);
}

function bindPill(map: MapBag) {
  if (!map.__ucPillBound) {
    map.__ucPillBound = true;
    const place = () => positionPill(map);
    map.on("move", place);
    map.on("moveend", place);
  }
  positionPill(map);
}

function pillEl(map: MapBag) {
  if (map.__ucPill?.isConnected) {
    if (!map.__ucPill.querySelector(".uc-map-name-pill-text")) {
      map.__ucPill.innerHTML = `<span class="uc-map-name-pill-text"></span>`;
    }
    return map.__ucPill;
  }
  const el = document.createElement("div");
  el.className = "uc-map-name-pill";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<span class="uc-map-name-pill-text"></span>`;
  map.getCanvasContainer().appendChild(el);
  map.__ucPill = el;
  return el;
}

function positionPill(map: MapBag) {
  const el = pillEl(map);
  const text = el.querySelector(".uc-map-name-pill-text");
  const court = pendingSelected
    ? pendingCourts.find((c) => c.id === pendingSelected)
    : undefined;
  if (!court) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  if (text && text.textContent !== court.name) text.textContent = court.name;
  el.title = court.name;
  const pt = map.project([court.lon, court.lat]);
  el.style.transform = `translate(${Math.round(pt.x)}px, ${Math.round(pt.y)}px) translate(-50%, calc(-100% - 40px))`;
}

export function setCourtFeatures(
  map: import("maplibre-gl").Map,
  courts: Court[],
  hooping: Set<string>,
  selectedId?: string | null,
) {
  if (!courts.length) return;
  pendingCourts = courts;
  pendingHooping = hooping;
  if (selectedId !== undefined) pendingSelected = selectedId ?? null;
  ensureCourtLayers(map);
  const src = map.getSource(SRC) as import("maplibre-gl").GeoJSONSource | undefined;
  src?.setData(collection(pendingCourts, pendingHooping, pendingSelected));
  positionPill(map as MapBag);
}

export function setSelectedCourtFeature(
  map: import("maplibre-gl").Map,
  _prevId: string | null,
  nextId: string | null,
) {
  pendingSelected = nextId;
  if (!map.getSource(SRC)) return;
  if (!pendingCourts.length) return;
  setCourtFeatures(map, pendingCourts, pendingHooping, nextId);
}

export function bindCourtLayerClicks(
  map: import("maplibre-gl").Map,
  onSelect: (id: string) => void,
) {
  const bag = map as unknown as { __ucPinClick?: boolean };
  if (bag.__ucPinClick) return;
  bag.__ucPinClick = true;
  const hit = (e: {
    features?: { id?: string | number; properties?: { id?: string } }[];
  }) => {
    const f = e.features?.[0];
    const id = f?.properties?.id ?? (typeof f?.id === "string" ? f.id : undefined);
    if (typeof id === "string" && id) onSelect(id);
  };
  map.on("click", LAYER_PIN, hit as never);
  map.on("mouseenter", LAYER_PIN, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", LAYER_PIN, () => {
    map.getCanvas().style.cursor = "";
  });
}

export function courtFeatureCount() {
  return pendingCourts.length;
}
