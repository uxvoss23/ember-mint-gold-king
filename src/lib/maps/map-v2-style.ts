/** MapV2-only style. Production streetStyle() is untouched. */

import type { StyleSpecification } from "maplibre-gl";

const OFM_DARK = "https://tiles.openfreemap.org/styles/dark";

const PAINT: Record<string, Record<string, unknown>> = {
  background: { "background-color": "#161b20" },
  water: { "fill-color": "#1f4d5c" },
  waterway: { "line-color": "#1f4d5c" },
  landuse_park: { "fill-color": "#2a4a34" },
  landcover_wood: { "fill-color": "#243d2c" },
  landuse_residential: { "fill-color": "#1d2228" },
  highway_path: { "line-color": "#3a4148" },
  highway_minor: { "line-color": "#454c55" },
  highway_major_inner: { "line-color": "#5a616a" },
  highway_major_casing: { "line-color": "#2a3036" },
  highway_motorway_inner: { "line-color": "#6a717a" },
  highway_motorway_casing: { "line-color": "#2a3036" },
};

const BUILDING = {
  id: "building",
  type: "fill-extrusion" as const,
  source: "openmaptiles",
  "source-layer": "building",
  minzoom: 12,
  paint: {
    "fill-extrusion-color": [
      "interpolate",
      ["linear"],
      ["coalesce", ["get", "render_height"], ["get", "height"], 12],
      0,
      "#323840",
      30,
      "#3e4650",
      80,
      "#565e68",
    ],
    "fill-extrusion-height": [
      "coalesce",
      ["get", "render_height"],
      ["get", "height"],
      ["*", ["coalesce", ["get", "render_levels"], ["get", "levels"], 3], 3.1],
      10,
    ],
    "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
    "fill-extrusion-opacity": 0.94,
  },
};

export async function loadMapV2Style(): Promise<StyleSpecification> {
  const style = (await fetch(OFM_DARK).then((r) => r.json())) as StyleSpecification;
  for (const layer of style.layers ?? []) {
    const patch = PAINT[layer.id];
    if (patch) layer.paint = { ...(layer.paint as object), ...patch };
  }
  style.layers = (style.layers ?? []).map((layer) =>
    layer.id === "building" ? (BUILDING as typeof layer) : layer,
  );
  return style;
}
