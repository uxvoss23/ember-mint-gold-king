/**
 * Real outdoor court photos from the user’s basketball courts pack.
 * Served from public/basketball-courts — Austin park courts.
 */
export const COURT_IMAGES = [
  "/basketball-courts/real-2921.jpg",
  "/basketball-courts/real-2927.jpg",
  "/basketball-courts/real-2929.jpg",
  "/basketball-courts/real-2925.jpg",
  "/basketball-courts/real-2917.jpg",
  "/basketball-courts/real-2909.jpg",
  "/basketball-courts/real-2912.jpg",
  "/basketball-courts/real-2913.jpg",
  "/basketball-courts/real-2914.jpg",
  "/basketball-courts/real-2931.jpg",
  "/basketball-courts/real-2933.jpg",
  "/basketball-courts/real-2938.jpg",
  "/basketball-courts/real-2934.jpg",
  "/basketball-courts/real-2943.jpg",
  "/basketball-courts/real-2953.jpg",
  "/basketball-courts/real-2946.jpg",
  "/basketball-courts/real-2947.jpg",
  "/basketball-courts/real-2948.jpg",
] as const;

const N = COURT_IMAGES.length;

export function courtImageFor(index: number): string {
  const i = ((index % N) + N) % N;
  return COURT_IMAGES[i]!;
}

/** Stable image pick from a court id. */
export function imageIndexFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % N;
}

export type CourtImageOverride = {
  preview?: string;
  gallery?: string[];
};

/**
 * At least `count` photos for a court.
 * Admin preview is always first when set; gallery follows; pack fills the rest.
 */
export function courtImagesFor(
  id: string,
  count = 4,
  override?: CourtImageOverride | null,
): string[] {
  const start = imageIndexFromId(id);
  const n = Math.max(count, 4);
  const pack: string[] = [];
  for (let i = 0; i < n + 8; i++) {
    pack.push(COURT_IMAGES[(start + i) % N]!);
  }

  if (!override?.preview && !(override?.gallery && override.gallery.length)) {
    return pack.slice(0, n);
  }

  const out: string[] = [];
  if (override.preview) out.push(override.preview);
  for (const g of override.gallery ?? []) {
    if (g && !out.includes(g)) out.push(g);
  }
  for (const p of pack) {
    if (out.length >= n) break;
    if (!out.includes(p)) out.push(p);
  }
  return out.length > 0 ? out : pack.slice(0, n);
}
