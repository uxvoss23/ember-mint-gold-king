import type { Court } from "./types";
import { haversineMeters } from "@/lib/utils";
import { imageIndexFromId } from "./images";

/** Curated public outdoor courts — primary fallback when live map data is rate-limited. */
const CATALOG: Omit<Court, "distanceMeters" | "imageIndex">[] = [
  // ── Austin, TX (home city — dense coverage) ──────────────────────────
  {
    id: "cat-zilker",
    name: "Zilker Park Courts",
    lat: 30.2669,
    lon: -97.7729,
    address: "2100 Barton Springs Rd, Austin, TX",
    surface: "concrete",
    amenities: ["full_court", "parking", "water", "multiple", "shade"],
    source: "catalog",
    neighborhood: "Zilker",
    hoops: 4,
    notes: "The heartbeat of outdoor ball in Austin. Multiple full courts steps from Barton Springs, shade trees around the edges, and a weekend crowd that shows up early. Expect competition and a wait for runs when the weather is good.",
  },
  {
    id: "cat-butler",
    name: "Butler Park Courts",
    lat: 30.2634,
    lon: -97.7525,
    address: "1000 Barton Springs Rd, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking"],
    source: "catalog",
    neighborhood: "Downtown",
    hoops: 2,
    notes: "Auditorium Shores courts with the downtown skyline as your backdrop. Open asphalt, often breezy off the river — solid for evening 1v1s when you want lights and a central meetup.",
  },
  {
    id: "cat-pease",
    name: "Pease Park Courts",
    lat: 30.2819,
    lon: -97.7528,
    address: "1100 Kingsbury St, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "half_court", "water", "shade"],
    source: "catalog",
    neighborhood: "Central",
    hoops: 2,
    notes: "Shaded Lamar corridor gem. Trees take the edge off midday heat, surface is honest asphalt, and the vibe is neighborhood-friendly more than pure streetball. Easy parking nearby.",
  },
  {
    id: "cat-battle-bend",
    name: "Battle Bend Park Courts",
    lat: 30.2258,
    lon: -97.7756,
    address: "5005 Escarpment Blvd, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking", "shade", "fence"],
    source: "catalog",
    neighborhood: "South Austin",
    hoops: 2,
    notes: "South Austin favorite for evening 1v1s. Lit, fenced, and shaded enough to stay playable after work. Quiet weeknights; busier when the weather breaks cool.",
  },
  {
    id: "cat-bartholomew",
    name: "Bartholomew District Park",
    lat: 30.3045,
    lon: -97.6928,
    address: "5201 Berkman Dr, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking", "multiple", "water"],
    source: "catalog",
    neighborhood: "Northeast",
    hoops: 4,
    notes: "Northeast staple with room to run. Multiple hoops, lights for night sessions, and regulars who know the space. Good for hosting when you need a court that can hold a small crowd.",
  },
  {
    id: "cat-reed",
    name: "Reed Park Courts",
    lat: 30.3172,
    lon: -97.7654,
    address: "2614 Pecos St, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "parking", "water", "shade"],
    source: "catalog",
    neighborhood: "Northwest",
    hoops: 2,
    notes: "Northwest neighborhood courts with shade and water. Lower traffic than the big parks — a smart pick when you want a clean 1v1 without hunting for space.",
  },
  {
    id: "cat-ramsey",
    name: "Ramsey Park Courts",
    lat: 30.3278,
    lon: -97.7365,
    address: "4301 Rosedale Ave, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "fence", "shade"],
    source: "catalog",
    neighborhood: "Rosedale",
    hoops: 2,
    notes: "Rosedale-area park courts. Compact, walkable, and usually available for a spontaneous run. Surface is classic city asphalt.",
  },
  {
    id: "cat-zaragoza",
    name: "Parque Zaragoza Courts",
    lat: 30.2589,
    lon: -97.7102,
    address: "2608 Gonzales St, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking", "multiple"],
    source: "catalog",
    neighborhood: "East Austin",
    hoops: 4,
    notes: "East Austin recreation hub. Full court action with regular pickup energy. Expect a mix of ages and skill — bring your A-game or come to work on it.",
  },
  {
    id: "cat-givens",
    name: "Givens District Park",
    lat: 30.2638,
    lon: -97.6935,
    address: "3811 E 12th St, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking", "water"],
    source: "catalog",
    neighborhood: "East Austin",
    hoops: 4,
    notes: "East side district park with real room to play. Multiple hoops, parking, and a community vibe. Reliable for scheduled games when you need a clear landmark.",
  },
  {
    id: "cat-garrison",
    name: "Garrison District Park",
    lat: 30.2185,
    lon: -97.7708,
    address: "6001 Manchaca Rd, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking", "multiple", "shade"],
    source: "catalog",
    neighborhood: "South Austin",
    hoops: 4,
    notes: "South Austin district park courts. Straightforward setup, parking on site, and enough space that two games can coexist without stepping on each other.",
  },
  {
    id: "cat-northwest",
    name: "Northwest District Park",
    lat: 30.3584,
    lon: -97.7389,
    address: "7000 Ardath St, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking", "fence"],
    source: "catalog",
    neighborhood: "Northwest",
    hoops: 4,
    notes: "North-side district park workhorse. Lit courts for after-dark runs, solid parking, and a regular cast of evening players.",
  },
  {
    id: "cat-rosewood",
    name: "Rosewood Park Courts",
    lat: 30.2702,
    lon: -97.7178,
    address: "2300 Rosewood Ave, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking"],
    source: "catalog",
    neighborhood: "East Austin",
    hoops: 2,
    notes: "East Austin classic. Historic park energy with outdoor courts that see steady use. Central enough for people coming from downtown or the east side.",
  },
  {
    id: "cat-eastwoods",
    name: "Eastwoods Park Courts",
    lat: 30.2905,
    lon: -97.7312,
    address: "3001 Harris Park Ave, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "half_court", "shade"],
    source: "catalog",
    neighborhood: "University",
    hoops: 2,
    notes: "Near UT — student traffic is real between classes and after dark. Tree cover around the courts, lively atmosphere, and quick games when the campus is in session.",
  },
  {
    id: "cat-little-stacy",
    name: "Little Stacy Park Courts",
    lat: 30.2468,
    lon: -97.7465,
    address: "1500 Alameda Dr, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "water", "shade"],
    source: "catalog",
    neighborhood: "South Austin",
    hoops: 2,
    notes: "South Austin neighborhood pocket. Smaller footprint, friendly for casual 1v1s, and easy to find once you’re off the main drag.",
  },
  {
    id: "cat-circle-c",
    name: "Circle C Metro Park Courts",
    lat: 30.1889,
    lon: -97.8825,
    address: "6301 W Slaughter Ln, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking", "multiple", "water"],
    source: "catalog",
    neighborhood: "Southwest",
    hoops: 4,
    notes: "Southwest metro park — spacious, well kept, and worth the drive if you live that side of town. Parking is easy; courts feel less cramped than central parks.",
  },
  {
    id: "cat-searight",
    name: "Mary Moore Searight Metro Park",
    lat: 30.1712,
    lon: -97.8256,
    address: "907 W Slaughter Ln, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "parking", "multiple", "water", "shade"],
    source: "catalog",
    neighborhood: "Southwest",
    hoops: 4,
    notes: "Mary Moore Searight metro park courts. Big park energy south of town — good for planned sessions when you want space and a proper facility feel.",
  },
  {
    id: "cat-walnut-creek",
    name: "Walnut Creek Metro Park Courts",
    lat: 30.4068,
    lon: -97.6765,
    address: "12138 N Lamar Blvd, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "parking", "water", "shade"],
    source: "catalog",
    neighborhood: "North Austin",
    hoops: 2,
    notes: "North Austin metro park run. Wide open, multiple options, and lights when you need them. Built for people who want a destination court, not a street corner.",
  },
  {
    id: "cat-dottie-jordan",
    name: "Dottie Jordan Recreation Courts",
    lat: 30.3235,
    lon: -97.6821,
    address: "2803 Loyola Ln, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking", "fence"],
    source: "catalog",
    neighborhood: "Northeast",
    hoops: 2,
    notes: "Northeast recreation courts. Practical, lit, and used by people who live nearby. Low drama place to lock in a rated 1v1.",
  },
  {
    id: "cat-metz",
    name: "Metz Recreation Center Courts",
    lat: 30.2548,
    lon: -97.7205,
    address: "2407 Canterbury St, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking"],
    source: "catalog",
    neighborhood: "East Austin",
    hoops: 2,
    notes: "East Austin recreation center courts. Outdoor hoops with a rec-center backbone — bathrooms and parking close. Solid midweek option.",
  },
  {
    id: "cat-guerrero",
    name: "Roy G. Guerrero Metro Park",
    lat: 30.2435,
    lon: -97.6948,
    address: "400 Grove Blvd, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "parking", "water", "multiple", "shade"],
    source: "catalog",
    neighborhood: "Southeast",
    hoops: 4,
    notes: "Roy G. Guerrero metro park on the southeast side. Big park, full amenities, and courts that can handle a crowd. Plan a little drive time from central Austin.",
  },
  {
    id: "cat-onion-creek",
    name: "Onion Creek Metro Park Courts",
    lat: 30.1456,
    lon: -97.7854,
    address: "7010 S Ih 35 Frontage Rd, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "parking", "water"],
    source: "catalog",
    neighborhood: "South Austin",
    hoops: 2,
    notes: "Far south metro park courts. Quiet relative to Zilker — a calm place to get clean games in without the central city circus.",
  },
  {
    id: "cat-hancock",
    name: "Hancock Recreation Courts",
    lat: 30.2978,
    lon: -97.7225,
    address: "811 E 41st St, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking", "shade"],
    source: "catalog",
    neighborhood: "Central",
    hoops: 2,
    notes: "Central / Hancock area courts. Convenient if you’re mid-city; expect neighborhood traffic more than destination ballers.",
  },
  {
    id: "cat-wooldridge",
    name: "Wooldridge Square Courts",
    lat: 30.2728,
    lon: -97.7456,
    address: "900 Guadalupe St, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "half_court"],
    source: "catalog",
    neighborhood: "Downtown",
    hoops: 2,
    notes: "Downtown square courts — compact and convenient when you’re already central. Not a sprawling facility, but you’ll find the hoop fast.",
  },
  {
    id: "cat-domain",
    name: "Domain / North Burnet Courts",
    lat: 30.4012,
    lon: -97.7228,
    address: "North Burnet Rd, Austin, TX",
    surface: "asphalt",
    amenities: ["full_court", "lights", "parking", "multiple"],
    source: "catalog",
    neighborhood: "Domain",
    hoops: 4,
    notes: "North Burnet / Domain-area outdoor courts — the north-central meetup when you live or work near the Domain. Parking nearby, lights for evening 1v1s, and an easy drive from Tech Ridge / Burnet.",
  },

  // New York (kept for multi-city)
  {
    id: "cat-west4",
    name: "West 4th Street Courts",
    lat: 40.7312,
    lon: -74.0011,
    address: "Greenwich Village, NY",
    surface: "asphalt",
    amenities: ["full_court", "lights", "fence", "multiple"],
    source: "catalog",
    hoops: 6,
    notes: "The Cage energy on West 4th — iconic streetball destination. Rough edges, real competition, and a reputation that draws people who want to test themselves.",
  },
  {
    id: "cat-bryant",
    name: "Bryant Park Courts",
    lat: 40.7536,
    lon: -73.9832,
    address: "New York, NY",
    surface: "asphalt",
    amenities: ["full_court", "lights", "fence"],
    source: "catalog",
    hoops: 4,
    notes: "Neighborhood park courts with a simple outdoor setup. Use it for a quiet 1v1 when the big parks are slammed.",
  },
  {
    id: "cat-rucker",
    name: "Holcombe Rucker Park",
    lat: 40.8298,
    lon: -73.9362,
    address: "Harlem, NY",
    surface: "asphalt",
    amenities: ["full_court", "lights", "multiple"],
    source: "catalog",
    hoops: 4,
    notes: "Namesake streetball legend energy — treat it as a competitive outdoor stop. Check local norms; games can get serious.",
  },
  {
    id: "cat-prospect",
    name: "Prospect Park Courts",
    lat: 40.6602,
    lon: -73.969,
    address: "Brooklyn, NY",
    surface: "asphalt",
    amenities: ["full_court", "multiple", "lights", "shade"],
    source: "catalog",
    hoops: 6,
    notes: "Open park courts with city-view vibes depending on the site. A solid alternate when primary courts are packed.",
  },
];

/** Austin first — home market for this build. */
export const CITY_PRESETS = [
  { id: "atx", label: "Austin", lat: 30.2672, lon: -97.7431 },
  { id: "nyc", label: "New York", lat: 40.7282, lon: -73.9942 },
  { id: "la", label: "Los Angeles", lat: 34.0195, lon: -118.4912 },
  { id: "chi", label: "Chicago", lat: 41.8781, lon: -87.6298 },
  { id: "sf", label: "San Francisco", lat: 37.7749, lon: -122.4194 },
  { id: "atl", label: "Atlanta", lat: 33.749, lon: -84.388 },
  { id: "mia", label: "Miami", lat: 25.7617, lon: -80.1918 },
  { id: "sea", label: "Seattle", lat: 47.6062, lon: -122.3321 },
  { id: "den", label: "Denver", lat: 39.7392, lon: -104.9903 },
  { id: "bos", label: "Boston", lat: 42.3601, lon: -71.0589 },
] as const;

export const DEFAULT_CITY = CITY_PRESETS[0]!;

export function allCatalogCourts(): Court[] {
  return CATALOG.map((c) => ({
    ...c,
    distanceMeters: 0,
    imageIndex: imageIndexFromId(c.id),
  }));
}

export function catalogNear(
  lat: number,
  lon: number,
  radiusMeters: number,
  limit = 40,
): Court[] {
  return CATALOG.map((c) => {
    const distanceMeters = haversineMeters(lat, lon, c.lat, c.lon);
    return {
      ...c,
      distanceMeters,
      imageIndex: imageIndexFromId(c.id),
    };
  })
    .filter((c) => c.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}

/** When OSM returns few results, pad with nearby catalog entries. */
export function mergeWithCatalog(
  osmCourts: Court[],
  lat: number,
  lon: number,
  radiusMeters: number,
  minDesired = 6,
): Court[] {
  if (osmCourts.length >= minDesired) {
    const seen = new Set(osmCourts.map((c) => `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`));
    const extras = catalogNear(lat, lon, radiusMeters, 30).filter((c) => {
      const key = `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`;
      const nearOsm = osmCourts.some(
        (o) => haversineMeters(o.lat, o.lon, c.lat, c.lon) < 120,
      );
      if (nearOsm || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return [...osmCourts, ...extras]
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 50);
  }
  const seen = new Set(osmCourts.map((c) => `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`));
  const extras = catalogNear(lat, lon, radiusMeters * 2.5, 30).filter((c) => {
    const key = `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...osmCourts, ...extras]
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 50);
}

/** Named courts for compete game creation dropdown */
export function namedAustinCourts(): Array<{
  id: string;
  name: string;
  lat: number;
  lon: number;
}> {
  return CATALOG.filter((c) => c.address?.includes("Austin") || c.id.startsWith("cat-"))
    .filter((c) => !c.address?.includes("NY") && !c.address?.includes("Brooklyn") && !c.address?.includes("Harlem") && !c.address?.includes("Manhattan") && !c.address?.includes("Greenwich"))
    .map((c) => ({ id: c.id, name: c.name, lat: c.lat, lon: c.lon }));
}
