import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Heart, MapPin, Star, Swords, X } from "lucide-react";
import { ImageCarousel } from "@/components/image-carousel";
import type { Court } from "@/lib/courts/types";
import { imagesForCourt } from "@/lib/courts/images";
import { useCourtAdmin } from "@/lib/courts/admin-overrides";
import { useFavorites } from "@/lib/courts/favorites";
import {
  favoriteCountFor,
  reviewsFor,
  useCourtSocial,
} from "@/lib/courts/social";
import { cn } from "@/lib/utils";
import { directionsUrl } from "@/lib/maps/directions";

export type AboutCourt =
  | (Court & { miles?: number })
  | {
      id: string;
      name: string;
      lat?: number;
      lon?: number;
      address?: string;
      neighborhood?: string;
      notes?: string;
      surface?: string;
      hoops?: number;
      amenities?: string[];
      miles?: number;
    };

function formatMiles(mi: number) {
  if (mi < 0.1) return "<0.1 mi";
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}

function haversineMi(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 3958.8;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function courtAboutText(court: {
  name: string;
  neighborhood?: string;
  notes?: string;
  surface?: string;
  hoops?: number;
  amenities?: string[];
}) {
  if (court.notes?.trim()) return court.notes.trim();
  const bits = [
    court.neighborhood
      ? `${court.neighborhood} outdoor courts`
      : "Public outdoor courts",
    court.hoops
      ? `${court.hoops} hoop${court.hoops === 1 ? "" : "s"}`
      : null,
    court.surface && court.surface !== "unknown"
      ? `${court.surface} surface`
      : null,
  ].filter(Boolean);
  return `${bits.join(" · ")}. Upset City is still writing a full take on this spot.`;
}

/**
 * Popup for court ⓘ — photos + notes.
 */
export function CourtAboutSheet({
  court,
  onClose,
  onSelectCourt,
  onPlay,
  isSelected = false,
  confirmLabel,
  userLat,
  userLon,
}: {
  court: AboutCourt | null | undefined;
  onClose: () => void;
  onSelectCourt?: (id: string) => void;
  onPlay?: () => void;
  isSelected?: boolean;
  confirmLabel?: string;
  userLat?: number;
  userLon?: number;
}) {
  const social = useCourtSocial();
  const favorites = useFavorites();
  const courtOverrides = useCourtAdmin((s) => s.overrides);

  useEffect(() => {
    if (!court) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const prevPad = body.style.paddingRight;
    const sb = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (sb > 0) body.style.paddingRight = `${sb}px`;
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      body.style.paddingRight = prevPad;
    };
  }, [court]);

  if (!court) return null;

  const lat = "lat" in court ? court.lat : undefined;
  const lon = "lon" in court ? court.lon : undefined;
  const milesFromYou =
    typeof lat === "number" &&
    typeof lon === "number" &&
    userLat != null &&
    userLon != null
      ? haversineMi(userLat, userLon, lat, lon)
      : "miles" in court && typeof court.miles === "number"
        ? court.miles
        : null;

  const images = imagesForCourt(court.id, 6, courtOverrides);
  const about = courtAboutText(court);
  const isFav = favorites.ids.includes(court.id);
  const favCount = favoriteCountFor(court.id, isFav, social.favoriteBonus);
  const courtReviews = reviewsFor(social.reviews, court.id);
  const avgReview =
    courtReviews.length > 0
      ? courtReviews.reduce((s, r) => s + r.rating, 0) / courtReviews.length
      : null;

  const mapsHref =
    typeof lat === "number" && typeof lon === "number"
      ? directionsUrl(lat, lon, court.address || court.name)
      : court.address
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(court.address)}`
        : null;

  const amenityLabels: Record<string, string> = {
    lights: "Lights",
    full_court: "Full court",
    half_court: "Half court",
    multiple: "Multiple courts",
    water: "Water",
    parking: "Parking",
    fence: "Fenced",
    shade: "Shade",
  };
  const amenities = (court.amenities ?? [])
    .map((a) => amenityLabels[a] ?? a)
    .filter(Boolean);

  const sheet = (
    <div
      className="uc-sheet-backdrop fixed inset-0 z-[400] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="court-about-title"
      onClick={onClose}
    >
      <div className="absolute inset-0" aria-hidden />
      <div
        className="uc-sheet-surface relative z-10 flex max-h-[min(90dvh,680px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-bg shadow-soft sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 justify-center pt-2 pb-1" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-fg-subtle/40" />
        </div>
        {/* Photos only — name/info live below */}
        <div className="relative w-full shrink-0 overflow-hidden bg-bg-subtle">
          <div className="relative aspect-[16/9] w-full max-h-[56dvh] min-h-[18rem]">
            {images.length > 0 ? (
              <ImageCarousel
                images={images}
                alt={court.name}
                className="absolute inset-0 h-full w-full"
                showControls
                priority
                allowFullscreen
                fill
              />
            ) : (
              <div className="absolute inset-0 bg-bg-subtle" />
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2.5 right-2.5 z-30 rounded-full bg-black/55 p-1.5 text-white"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Title + meta under image, then scrollable body */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-bg"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
        >
          <div className="space-y-3 px-3.5 pt-3 pb-2">
            <div>
              <h3
                id="court-about-title"
                className="font-display text-[1.25rem] font-semibold leading-tight text-fg"
              >
                {court.name}
              </h3>
              <p className="mt-0.5 text-[13px] text-fg-muted">
                {court.neighborhood ?? "Austin"}
              </p>
            </div>

            {milesFromYou != null ? (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-court/15 px-2.5 py-1 text-[12px] font-semibold text-court">
                <MapPin className="size-3.5" />
                {formatMiles(milesFromYou)} from you
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-1.5">
              {avgReview != null ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-elevated px-2.5 py-1 text-[12px] font-semibold text-fg">
                  <Star className="size-3.5 fill-court text-court" />
                  {avgReview.toFixed(1)}
                  <span className="font-normal text-fg-muted">
                    · {courtReviews.length} review
                    {courtReviews.length === 1 ? "" : "s"}
                  </span>
                </span>
              ) : (
                <span className="rounded-full border border-border bg-bg-elevated px-2.5 py-1 text-[12px] text-fg-subtle">
                  No reviews yet
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-elevated px-2.5 py-1 text-[12px] font-semibold text-fg">
                <Heart
                  className={cn(
                    "size-3.5",
                    isFav ? "fill-court text-court" : "text-fg-muted",
                  )}
                />
                {favCount} saved
              </span>
            </div>

            {mapsHref ? (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 rounded-xl border border-border bg-bg-elevated px-3 py-2.5"
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-court" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium leading-snug text-fg">
                    {court.address ||
                      [court.neighborhood, "Austin"].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-0.5 inline-flex items-center text-[12px] font-semibold text-court">
                    Get directions
                    <span aria-hidden className="ml-0.5">
                      ›
                    </span>
                  </span>
                </span>
              </a>
            ) : court.address ? (
              <p className="flex items-start gap-1.5 text-[13px] leading-snug text-fg">
                <MapPin className="mt-0.5 size-4 shrink-0 text-court" />
                <span>{court.address}</span>
              </p>
            ) : null}

            {amenities.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {amenities.map((a) => (
                  <span
                    key={a}
                    className="rounded-full border border-border bg-bg-elevated px-2 py-0.5 text-[11px] font-medium text-fg-muted"
                  >
                    {a}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="rounded-xl border border-border bg-bg-elevated px-3 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-court uppercase">
                About this court
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-fg">
                {about}
              </p>
            </div>

            <div className="space-y-1.5 pb-1">
              <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
                Reviews
              </p>
              {courtReviews.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-3 text-[12px] text-fg-muted">
                  No player reviews yet for this court.
                </p>
              ) : (
                courtReviews.slice(0, 4).map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-border bg-bg-elevated px-2.5 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-semibold text-fg">
                        {r.author ?? "Player"}
                      </p>
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-fg">
                        <Star className="size-3 fill-court text-court" />
                        {r.rating}
                      </span>
                    </div>
                    {r.text ? (
                      <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">
                        {r.text}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="relative z-10 shrink-0 border-t border-border bg-bg p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {onSelectCourt ? (
            <button
              type="button"
              onClick={() => onSelectCourt(court.id)}
              className="w-full rounded-full bg-court py-3 text-sm font-semibold text-white"
            >
              {confirmLabel ?? (isSelected ? "Selected ✓" : "Select this court")}
            </button>
          ) : onPlay ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border border-border py-2.5 text-sm font-semibold text-fg"
              >
                Close
              </button>
              <button
                type="button"
                onClick={onPlay}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-court py-2.5 text-sm font-semibold text-white"
              >
                <Swords className="size-3.5" strokeWidth={1.75} />
                Play
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full bg-fg py-2.5 text-sm font-semibold text-bg"
            >
              Got it
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return sheet;
  return createPortal(sheet, document.body);
}
