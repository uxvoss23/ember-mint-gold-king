/**
 * Static map URL for court carousels — close-up of the court with
 * optional "you" and opponent pins (OpenStreetMap staticmap).
 */

export type MapPin = {
  lat: number;
  lon: number;
  /** lightblue1 | red | green | orange | … (osm.de marker colors) */
  color?: string;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/** Rough zoom from max span in degrees */
function zoomForSpan(spanDeg: number) {
  if (spanDeg < 0.008) return 16;
  if (spanDeg < 0.02) return 15;
  if (spanDeg < 0.05) return 14;
  if (spanDeg < 0.12) return 13;
  if (spanDeg < 0.25) return 12;
  if (spanDeg < 0.5) return 11;
  return 10;
}

/**
 * Build a static map image URL centered to show the court up close,
 * still framing you (and opponent) when possible.
 */
export function courtContextMapUrl(opts: {
  courtLat: number;
  courtLon: number;
  userLat?: number;
  userLon?: number;
  opponentLat?: number;
  opponentLon?: number;
  width?: number;
  height?: number;
}): string {
  const w = opts.width ?? 640;
  const h = opts.height ?? 480;

  const pins: MapPin[] = [
    { lat: opts.courtLat, lon: opts.courtLon, color: "orange" },
  ];
  if (
    opts.userLat != null &&
    opts.userLon != null &&
    Number.isFinite(opts.userLat) &&
    Number.isFinite(opts.userLon)
  ) {
    pins.push({ lat: opts.userLat, lon: opts.userLon, color: "lightblue1" });
  }
  if (
    opts.opponentLat != null &&
    opts.opponentLon != null &&
    Number.isFinite(opts.opponentLat) &&
    Number.isFinite(opts.opponentLon)
  ) {
    pins.push({
      lat: opts.opponentLat,
      lon: opts.opponentLon,
      color: "red",
    });
  }

  const lats = pins.map((p) => p.lat);
  const lons = pins.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  // Bias center toward the court (product focus) but keep others in frame
  let centerLat = opts.courtLat;
  let centerLon = opts.courtLon;
  if (pins.length > 1) {
    const midLat = (minLat + maxLat) / 2;
    const midLon = (minLon + maxLon) / 2;
    centerLat = opts.courtLat * 0.55 + midLat * 0.45;
    centerLon = opts.courtLon * 0.55 + midLon * 0.45;
  }

  const span = Math.max(maxLat - minLat, maxLon - minLon, 0.012);
  const zoom = clamp(zoomForSpan(span * 1.35), 11, 16);

  // staticmap.openstreetmap.de marker format: lat,lon,color
  const markers = pins
    .map((p) => `${p.lat},${p.lon},${p.color ?? "red"}`)
    .join("|");

  const params = new URLSearchParams({
    center: `${centerLat},${centerLon}`,
    zoom: String(zoom),
    size: `${w}x${h}`,
    maptype: "mapnik",
    markers,
  });

  return `https://staticmap.openstreetmap.de/staticmap.php?${params.toString()}`;
}

/** Photos first, map as 2nd slide, remaining photos after */
export function courtImagesWithMap(
  photos: string[],
  mapUrl: string | null | undefined,
): string[] {
  if (!mapUrl) return photos;
  if (photos.length === 0) return [mapUrl];
  return [photos[0]!, mapUrl, ...photos.slice(1)];
}
