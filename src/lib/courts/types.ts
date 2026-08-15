export type CourtSurface = "asphalt" | "concrete" | "rubber" | "unknown";

export type CourtAmenity =
  | "lights"
  | "full_court"
  | "half_court"
  | "multiple"
  | "water"
  | "parking"
  | "fence"
  | "shade";

export interface Court {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceMeters: number;
  address?: string;
  surface: CourtSurface;
  amenities: CourtAmenity[];
  imageIndex: number;
  source: "osm" | "catalog";
  hoops?: number;
  notes?: string;
  /** Map zone label e.g. East Austin */
  neighborhood?: string;
  /** Lights hours if known */
  lightsHours?: string;
  /** Park hours */
  hours?: string;
}

export interface UserLocation {
  lat: number;
  lon: number;
  label?: string;
  accuracy?: number;
}

export interface CourtsResult {
  courts: Court[];
  location: UserLocation;
  source: "osm" | "catalog" | "mixed";
  queryRadiusMeters: number;
}
