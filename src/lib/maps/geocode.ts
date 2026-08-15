/** Austin-area address geocoding + autocomplete (Nominatim / OpenStreetMap). */

export type GeoHit = {
  lat: number;
  lon: number;
  label: string;
  detail?: string;
};

const AUSTIN_VIEWBOX = "-98.05,30.55,-97.45,30.05";

function formatLabel(displayName: string) {
  return displayName
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
}

/** Single best match (legacy courts search). */
export async function geocodeAustinAddress(
  q: string,
): Promise<GeoHit | null> {
  const hits = await suggestAustinAddresses(q, 1);
  return hits[0] ?? null;
}

/**
 * Autocomplete-style suggestions for typing an address in Austin.
 * Uses OpenStreetMap Nominatim (no API key). Google-like dropdown UX.
 */
export async function suggestAustinAddresses(
  q: string,
  limit = 6,
): Promise<GeoHit[]> {
  const query = q.trim();
  if (query.length < 3) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${query}, Austin, Texas`);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("viewbox", AUSTIN_VIEWBOX);
  url.searchParams.set("bounded", "1");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        // Nominatim usage policy — identify the app
        "User-Agent": "UpsetCity/1.0 (court finder)",
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      type?: string;
      class?: string;
    }>;
    const seen = new Set<string>();
    const out: GeoHit[] = [];
    for (const hit of data) {
      const lat = Number(hit.lat);
      const lon = Number(hit.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const label = formatLabel(hit.display_name);
      const key = `${lat.toFixed(4)},${lon.toFixed(4)},${label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        lat,
        lon,
        label,
        detail: hit.display_name,
      });
    }
    return out;
  } catch {
    return [];
  }
}
