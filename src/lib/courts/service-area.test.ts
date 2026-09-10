/**
 * Phase 3: Austin service area + honest court photos.
 */
import assert from "node:assert/strict";
import { COURT_PLACEHOLDER, courtImagesFor, imagesForCourt } from "./images.ts";

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

const AUSTIN = { lat: 30.2672, lon: -97.7431 };
const LIMIT = 55 * 1609.34;
const inArea = (lat: number, lon: number) =>
  haversineMeters(AUSTIN.lat, AUSTIN.lon, lat, lon) <= LIMIT;

assert.equal(inArea(30.2672, -97.7431), true, "downtown Austin");
assert.equal(inArea(30.508, -97.678), true, "Round Rock-ish");
assert.equal(inArea(32.7767, -96.797), false, "Dallas is out");
assert.equal(inArea(40.7128, -74.006), false, "NYC is out");

const placeholder = courtImagesFor("cat-zilker", 4);
assert.deepEqual(placeholder, [COURT_PLACEHOLDER], "no fake pack photos");

const verified = courtImagesFor("cat-zilker", 4, {
  preview: "/uploads/a.jpg",
  gallery: ["/uploads/b.jpg", "/uploads/c.jpg"],
});
assert.equal(verified[0], "/uploads/a.jpg");
assert.ok(!verified.includes(COURT_PLACEHOLDER));

assert.equal(
  imagesForCourt("cat-bartholomew", 1, {
    "cat-bartholomew": { photos: { preview: "/uploads/bart.jpg", gallery: [] } },
  })[0],
  "/uploads/bart.jpg",
  "create + courts share override photos",
);
assert.equal(
  imagesForCourt("cat-bartholomew", 1, {})[0],
  COURT_PLACEHOLDER,
  "no photo still falls back",
);

console.log("ALL COURT PHASE 3 TESTS PASSED");
