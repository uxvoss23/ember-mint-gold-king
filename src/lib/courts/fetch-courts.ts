import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Court, CourtAmenity, CourtSurface, CourtsResult } from "./types";
import { haversineMeters } from "@/lib/utils";
import { imageIndexFromId } from "./images";
import { catalogNear, mergeWithCatalog } from "./catalog";

const inputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  radiusMeters: z.number().min(500).max(50000).default(8000),
  label: z.string().optional(),
});

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const cache = new Map<string, { at: number; courts: Court[] }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(lat: number, lon: number, radius: number) {
  return `v3:${lat.toFixed(3)},${lon.toFixed(3)},${Math.round(radius / 500) * 500}`;
}

function pickCoords(el: OverpassElement): { lat: number; lon: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lon: el.lon };
  }
  if (el.center && typeof el.center.lat === "number" && typeof el.center.lon === "number") {
    return { lat: el.center.lat, lon: el.center.lon };
  }
  return null;
}

function surfaceFromTags(tags: Record<string, string> | undefined): CourtSurface {
  const s = (tags?.surface || tags?.material || "").toLowerCase();
  if (s.includes("asphalt") || s.includes("tarmac") || s.includes("paved")) return "asphalt";
  if (s.includes("concrete") || s.includes("cement")) return "concrete";
  if (s.includes("rubber") || s.includes("tartan") || s.includes("acrylic")) return "rubber";
  return "unknown";
}

function amenitiesFromTags(tags: Record<string, string> | undefined): CourtAmenity[] {
  const a: CourtAmenity[] = ["full_court"];
  if (!tags) return a;
  if (tags.lit === "yes" || tags.lighting === "yes") a.push("lights");
  const hoops = tags.hoops ? Number(tags.hoops) : NaN;
  if (Number.isFinite(hoops) && hoops >= 4) a.push("multiple");
  if (tags.barrier === "fence" || tags.fenced === "yes") a.push("fence");
  if (tags.drinking_water === "yes") a.push("water");
  if (tags.parking === "yes") a.push("parking");
  if (
    tags.covered === "yes" ||
    tags.shelter === "yes" ||
    tags.shade === "yes" ||
    tags.canopy === "yes"
  ) {
    a.push("shade");
  }
  return a;
}

function hasRealName(tags: Record<string, string> | undefined): string | null {
  const n = tags?.name || tags?.["name:en"] || tags?.ref;
  return n && n.trim() ? n.trim() : null;
}

function placeHint(tags: Record<string, string> | undefined): string | undefined {
  return (
    tags?.["addr:neighbourhood"] ||
    tags?.["addr:suburb"] ||
    tags?.["addr:city"] ||
    tags?.["addr:street"] ||
    tags?.operator ||
    undefined
  );
}

function isGenericName(name: string): boolean {
  return (
    name === "Public outdoor court" ||
    name.startsWith("Public outdoor court ·") ||
    name.startsWith("Outdoor court")
  );
}

function bearingLabel(fromLat: number, fromLon: number, toLat: number, toLon: number): string {
  const y = Math.sin(((toLon - fromLon) * Math.PI) / 180) * Math.cos((toLat * Math.PI) / 180);
  const x =
    Math.cos((fromLat * Math.PI) / 180) * Math.sin((toLat * Math.PI) / 180) -
    Math.sin((fromLat * Math.PI) / 180) *
      Math.cos((toLat * Math.PI) / 180) *
      Math.cos(((toLon - fromLon) * Math.PI) / 180);
  const brng = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(brng / 45) % 8]!;
}

function sortCourts(a: Court, b: Court): number {
  // Prefer named courts when distances are close (~400m)
  const distDiff = a.distanceMeters - b.distanceMeters;
  if (Math.abs(distDiff) < 400) {
    const aNamed = !isGenericName(a.name);
    const bNamed = !isGenericName(b.name);
    if (aNamed !== bNamed) return aNamed ? -1 : 1;
  }
  return distDiff;
}

/** Merge courts within ~55m (same facility / multi-hoop parks). Prefer named. */
function clusterCourts(courts: Court[]): Court[] {
  const sorted = [...courts].sort((a, b) => a.distanceMeters - b.distanceMeters);
  const kept: Court[] = [];

  for (const c of sorted) {
    const near = kept.find((k) => haversineMeters(k.lat, k.lon, c.lat, c.lon) < 55);
    if (!near) {
      kept.push({ ...c, amenities: [...c.amenities] });
      continue;
    }

    if (isGenericName(near.name) && !isGenericName(c.name)) {
      near.name = c.name;
      near.address = c.address ?? near.address;
      near.notes = c.notes ?? near.notes;
    } else if (!near.address && c.address) {
      near.address = c.address;
    }

    const amenitySet = new Set<CourtAmenity>([...near.amenities, ...c.amenities, "multiple"]);
    near.amenities = [...amenitySet];
    near.hoops = (near.hoops ?? 2) + (c.hoops ?? 1);
  }

  return kept;
}

async function queryOverpass(
  lat: number,
  lon: number,
  radiusMeters: number,
): Promise<Court[]> {
  const key = cacheKey(lat, lon, radiusMeters);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.courts
      .map((c) => ({
        ...c,
        distanceMeters: haversineMeters(lat, lon, c.lat, c.lon),
      }))
      .sort(sortCourts);
  }

  const query = `
[out:json][timeout:6];
(
  nwr["leisure"="pitch"]["sport"="basketball"](around:${radiusMeters},${lat},${lon});
);
out center tags 80;
`.trim();

  // Prefer the fastest public mirror; fail over quickly
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  let lastError: unknown;
  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "UpsetCity/1.0 (Austin outdoor basketball)",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 429 || res.status === 504 || res.status === 502) {
        lastError = new Error(`Overpass ${res.status}`);
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      if (!res.ok) {
        lastError = new Error(`Overpass ${res.status}`);
        continue;
      }

      const data = (await res.json()) as { elements?: OverpassElement[] };
      const elements = data.elements ?? [];
      const courts: Court[] = [];
      const seen = new Set<string>();

      for (const el of elements) {
        const coords = pickCoords(el);
        if (!coords) continue;
        if (el.tags?.indoor === "yes" || el.tags?.building) continue;
        const keyCoord = `${coords.lat.toFixed(5)},${coords.lon.toFixed(5)}`;
        if (seen.has(keyCoord)) continue;
        seen.add(keyCoord);

        const id = `osm-${el.type}-${el.id}`;
        const distanceMeters = haversineMeters(lat, lon, coords.lat, coords.lon);
        if (distanceMeters > radiusMeters * 1.08) continue;

        const real = hasRealName(el.tags);
        const hint = placeHint(el.tags);
        const name = real ?? (hint ? `${hint} Court` : "Public outdoor court");

        courts.push({
          id,
          name,
          lat: coords.lat,
          lon: coords.lon,
          distanceMeters,
          address: el.tags?.["addr:street"]
            ? [el.tags["addr:housenumber"], el.tags["addr:street"], el.tags["addr:city"]]
                .filter(Boolean)
                .join(" ")
            : hint,
          surface: surfaceFromTags(el.tags),
          amenities: amenitiesFromTags(el.tags),
          imageIndex: imageIndexFromId(id),
          source: "osm",
          hoops: el.tags?.hoops ? Number(el.tags.hoops) || undefined : undefined,
          notes: el.tags?.description || el.tags?.note,
        });
      }

      const clustered = clusterCourts(courts)
        .map((c) => {
          if (!isGenericName(c.name)) return c;
          const dir = bearingLabel(lat, lon, c.lat, c.lon);
          return {
            ...c,
            name: `Public outdoor court · ${dir}`,
          };
        })
        .sort(sortCourts)
        .slice(0, 40);

      cache.set(key, { at: Date.now(), courts: clustered });
      return clustered;
    } catch (err) {
      lastError = err;
    }
  }

  console.warn("[courts] Overpass unavailable, using catalog", lastError);
  return [];
}

export const fetchCourtsNear = createServerFn({ method: "POST" })
  .validator((raw: unknown) => inputSchema.parse(raw))
  .handler(async ({ data }): Promise<CourtsResult> => {
    const { lat, lon, radiusMeters, label } = data;

    // Instant: curated Austin catalog (photos, notes, neighborhoods)
    const catalog = catalogNear(lat, lon, Math.max(radiusMeters, 12_000), 40);
    const catalogFallback =
      catalog.length >= 4
        ? catalog
        : catalogNear(lat, lon, 20_000_000, 30);

    // Optional OSM enrich — never block more than ~5s on the wire
    let osm: Court[] = [];
    try {
      osm = await queryOverpass(lat, lon, radiusMeters);
    } catch (e) {
      console.warn("[courts] query error", e);
      osm = [];
    }

    let courts: Court[];
    let source: CourtsResult["source"];

    if (osm.length === 0) {
      courts = catalogFallback;
      source = "catalog";
    } else {
      // Catalog courts win for named Austin parks (photos + notes)
      courts = mergeWithCatalog(osm, lat, lon, radiusMeters, 10)
        .sort(sortCourts)
        .slice(0, 40);
      // Guarantee at least catalog coverage if merge thinned too hard
      if (courts.length < 6) {
        courts = catalogFallback;
        source = "catalog";
      } else {
        source = osm.length >= 6 ? "mixed" : "catalog";
      }
    }

    return {
      courts,
      location: { lat, lon, label },
      source,
      queryRadiusMeters: radiusMeters,
    };
  });
