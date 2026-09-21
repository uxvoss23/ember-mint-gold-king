/**
 * Run: node --experimental-strip-types --no-warnings src/lib/courts/photo-store.test.ts
 */
import assert from "node:assert/strict";
import { isStablePhotoUrl, parseImageDataUrl } from "./photo-store.ts";

assert.equal(isStablePhotoUrl("/api/court-photos/abc"), true);
assert.equal(isStablePhotoUrl("/court-placeholder.svg"), true);
assert.equal(isStablePhotoUrl("https://cdn.example/x.jpg"), true);
assert.equal(isStablePhotoUrl("data:image/jpeg;base64,xxxx"), false);

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(40).fill(1)]);
const dataUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
const parsed = parseImageDataUrl(dataUrl);
assert.ok(parsed);
assert.equal(parsed!.mime, "image/jpeg");
assert.equal(parsed!.bytes.equals(jpeg), true);
assert.equal(parseImageDataUrl("not-an-image"), null);
assert.equal(parseImageDataUrl("data:text/plain;base64,YQ=="), null);

console.log("ALL PHOTO STORE TESTS PASSED");
