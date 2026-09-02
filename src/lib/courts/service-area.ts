import { haversineMeters } from "@/lib/utils";

/** Downtown Austin — product is Austin-first. */
export const AUSTIN_CENTER = { lat: 30.2672, lon: -97.7431 };

/** Greater Austin / nearby suburbs (~55 miles). Outside this → empty state. */
export const AUSTIN_SERVICE_METERS = 55 * 1609.34;

export function inAustinServiceArea(lat: number, lon: number): boolean {
  return (
    haversineMeters(AUSTIN_CENTER.lat, AUSTIN_CENTER.lon, lat, lon) <=
    AUSTIN_SERVICE_METERS
  );
}
