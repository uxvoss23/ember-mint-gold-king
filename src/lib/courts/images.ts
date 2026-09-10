/**
 * Court photos must belong to that court record (admin / verified uploads).
 * The shared pack is NOT assigned to specific courts — that implied the
 * photo showed that park. Unverified courts get a labeled placeholder.
 */

export const COURT_PLACEHOLDER = "/court-placeholder.svg";

export type CourtImageOverride = {
  preview?: string;
  gallery?: string[];
};

export function isPlaceholderPhoto(src: string | undefined): boolean {
  return !src || src === COURT_PLACEHOLDER;
}

/**
 * Verified photos for a court, or a single labeled placeholder.
 * Never pads with unrelated park photos.
 */
export function courtImagesFor(
  _id: string,
  count = 4,
  override?: CourtImageOverride | null,
): string[] {
  const out: string[] = [];
  if (override?.preview && !isPlaceholderPhoto(override.preview)) {
    out.push(override.preview);
  }
  for (const g of override?.gallery ?? []) {
    if (g && !isPlaceholderPhoto(g) && !out.includes(g)) out.push(g);
  }
  if (out.length) return out.slice(0, Math.max(count, 4));
  return [COURT_PLACEHOLDER];
}

/** Shared source of truth: catalog court + admin photo overrides. */
export function imagesForCourt(
  courtId: string,
  count = 4,
  overrides?: Record<string, { photos?: CourtImageOverride | null }> | null,
): string[] {
  return courtImagesFor(courtId, count, overrides?.[courtId]?.photos ?? null);
}

/** @deprecated hash-index unused; kept so older callers typecheck */
export function imageIndexFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 18;
}

export function courtImageFor(_index: number): string {
  return COURT_PLACEHOLDER;
}
