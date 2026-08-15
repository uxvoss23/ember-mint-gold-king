import { useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Heart,
  MapPin,
  Navigation,
  Star,
  Swords,
  Camera,
  ImagePlus,
  Wrench,
  X,
} from "lucide-react";
import type { Court } from "@/lib/courts/types";
import { courtImagesFor } from "@/lib/courts/images";
import { useFavorites } from "@/lib/courts/favorites";
import {
  favoriteCountFor,
  reviewsFor,
  useCourtSocial,
  WORK_ORDER_LABELS,
  type WorkOrderKind,
} from "@/lib/courts/social";
import { AdminEditCourtButton } from "@/components/admin-court-editor";
import {
  mergeCourtWithOverride,
  useCourtAdmin,
} from "@/lib/courts/admin-overrides";
import { isAdminEmail } from "@/lib/auth/admin";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { compressWorkOrderPhoto } from "@/components/work-order-popup";
import { ImageCarousel } from "@/components/image-carousel";
import { directionsUrl } from "@/lib/maps/directions";
import { cn, formatDistance } from "@/lib/utils";

const AMENITY_LABEL: Record<string, string> = {
  lights: "Lights",
  full_court: "Full court",
  half_court: "Half court",
  multiple: "Multi-court",
  water: "Water",
  parking: "Parking",
  fence: "Fenced",
  shade: "Shaded",
};

interface CourtDetailProps {
  court: Court | null;
  onClose: () => void;
  onQuickMatch?: (court: Court) => void;
}


export function CourtDetail({ court, onClose, onQuickMatch }: CourtDetailProps) {
  const favorites = useFavorites();
  const social = useCourtSocial();
  const [reviewText, setReviewText] = useState("");
  const [reviewStars, setReviewStars] = useState(5);
  const [woOpen, setWoOpen] = useState(false);
  const [woKind, setWoKind] = useState<WorkOrderKind>("broken_rim");
  const [woMsg, setWoMsg] = useState<string | null>(null);
  const [woPhotos, setWoPhotos] = useState<string[]>([]);
  const [woPicking, setWoPicking] = useState(false);
  const woCamRef = useRef<HTMLInputElement>(null);
  const woLibRef = useRef<HTMLInputElement>(null);

  const authUser = useCurrentUser();
  const ov = useCourtAdmin((s) => (court ? s.overrides[court.id] : undefined));
  const admin = isAdminEmail(authUser?.primaryEmail);

  if (!court) return null;

  const display = mergeCourtWithOverride(court, ov);
  const isFav = favorites.ids.includes(court.id);
  const images = courtImagesFor(court.id, 5, ov?.photos);
  const mapsUrl = directionsUrl(display.lat, display.lon, display.name);
  const favCount = favoriteCountFor(court.id, isFav, social.favoriteBonus);
  const courtReviews = reviewsFor(social.reviews, court.id);
  const avgReview =
    courtReviews.reduce((s, r) => s + r.rating, 0) /
    Math.max(1, courtReviews.length);
  const courtOrders = social.workOrders.filter((w) => w.courtId === court.id);

  const toggleFav = () => {
    const was = favorites.ids.includes(court.id);
    favorites.toggle(court.id);
    if (!was) social.bumpFavorite(court.id);
  };

  const submitReview = () => {
    if (!reviewText.trim()) return;
    social.addReview(court.id, reviewStars, reviewText);
    setReviewText("");
    setReviewStars(5);
  };

  const submitWorkOrder = () => {
    social.addWorkOrder(court.id, woKind, undefined, {
      courtName: display.name,
      reporter: "You",
      photos: woPhotos.length ? woPhotos : undefined,
      photoUrl: woPhotos[0],
    });
    setWoMsg(
      "Thank you for letting the city know. A ticket has been submitted. The mayor may be in touch with you to gather more details.",
    );
    setWoPhotos([]);
    window.setTimeout(() => setWoMsg(null), 10_000);
  };

  const pickWoPhoto = async (files: FileList | File[] | null) => {
    const list = files
      ? Array.from(files).filter((f) => f.type.startsWith("image/"))
      : [];
    if (!list.length) return;
    setWoPicking(true);
    setWoMsg(null);
    try {
      const urls: string[] = [];
      for (const f of list) urls.push(await compressWorkOrderPhoto(f));
      setWoPhotos((prev) => [...prev, ...urls]);
    } catch {
      setWoMsg("Couldn’t read one of those photos — try again.");
    } finally {
      setWoPicking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm fade-in"
        aria-label="Dismiss"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="court-detail-title"
        className="slide-up relative z-10 flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-bg-elevated shadow-soft sm:rounded-3xl"
      >
        {/* Grabber */}
        <div className="flex shrink-0 justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/25" />
        </div>

        {/* Hero photos — larger, matches list card ratio feel */}
        <div className="relative shrink-0 px-0">
          <ImageCarousel
            images={images}
            alt={display.name}
            className="aspect-[16/10] w-full max-h-[42dvh]"
            priority
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg-elevated via-bg-elevated/50 to-transparent" />
          <div className="absolute top-2.5 right-2.5 z-20 flex gap-2">
            {admin ? <AdminEditCourtButton court={display} /> : null}
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-full border border-border bg-bg/60 text-fg backdrop-blur-md"
              aria-label="Close"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>
          <div className="absolute bottom-2.5 left-3 z-10 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur-sm">
              <Navigation className="size-3.5" strokeWidth={2.25} />
              {formatDistance(display.distanceMeters)}
            </span>
            {display.neighborhood ? (
              <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
                {display.neighborhood}
              </span>
            ) : null}
          </div>
        </div>

        {/* Scroll body — single page, no tabs */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-2 [-webkit-overflow-scrolling:touch]">
          <div className="space-y-4">
            <div>
              <h2
                id="court-detail-title"
                className="font-display text-[22px] font-semibold tracking-tight text-fg"
              >
                {display.name}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-fg-muted">
                <span className="inline-flex items-center gap-1 font-semibold text-fg">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                  {courtReviews.length ? avgReview.toFixed(1) : "—"}
                  <span className="font-normal text-fg-subtle">
                    ({courtReviews.length})
                  </span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Heart
                    className={cn(
                      "size-3.5",
                      isFav ? "fill-court text-court" : "text-fg-subtle",
                    )}
                  />
                  <span className="tabular-nums text-fg">{favCount}</span> saved
                </span>
              </div>
              {display.address ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-start gap-1.5 text-[13px] text-court"
                >
                  <MapPin className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
                  <span>
                    <span className="underline decoration-court/35 underline-offset-2">
                      {display.address}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-medium text-fg-subtle no-underline">
                      Open in Maps
                    </span>
                  </span>
                </a>
              ) : null}
            </div>

            {/* Amenities */}
            <div className="flex flex-wrap gap-1.5">
              {display.amenities.map((a) => (
                <span
                  key={a}
                  className="rounded-full border border-border bg-bg-subtle px-2.5 py-1 text-[11px] font-medium text-fg-muted"
                >
                  {AMENITY_LABEL[a] ?? a}
                </span>
              ))}
              {display.surface !== "unknown" ? (
                <span className="rounded-full border border-border bg-bg-subtle px-2.5 py-1 text-[11px] font-medium capitalize text-fg-muted">
                  {display.surface}
                </span>
              ) : null}
              {display.hoops ? (
                <span className="rounded-full border border-border bg-bg-subtle px-2.5 py-1 text-[11px] font-medium text-fg-muted">
                  {display.hoops} hoops
                </span>
              ) : null}
            </div>

            {display.notes ? (
              <p className="text-[13px] leading-relaxed text-fg-muted">
                {display.notes}
              </p>
            ) : null}
            {(display.hours || display.lightsHours) && (
              <div className="space-y-0.5 text-[12px] text-fg-subtle">
                {display.hours ? <p>Hours · {display.hours}</p> : null}
                {display.lightsHours ? (
                  <p>Lights · {display.lightsHours}</p>
                ) : null}
              </div>
            )}


            {/* Reviews — inline, no tab */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold tracking-wide text-fg-subtle uppercase">
                  Reviews
                </p>
                <span className="text-[12px] font-semibold tabular-nums text-fg">
                  {courtReviews.length
                    ? `${avgReview.toFixed(1)} · ${courtReviews.length}`
                    : "No reviews yet"}
                </span>
              </div>

              {courtReviews.length === 0 ? (
                <p className="rounded-xl border border-border bg-bg-subtle px-3 py-3 text-[13px] text-fg-muted">
                  First to rate nets, shade, and rim quality?
                </p>
              ) : (
                <div className="space-y-2">
                  {courtReviews.slice(0, 4).map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-border bg-bg-subtle px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-fg">{r.author}</p>
                        <span className="flex items-center gap-0.5 text-xs font-medium text-gold">
                          {Array.from({ length: r.rating }, (_, i) => (
                            <Star
                              key={i}
                              className="size-3 fill-current"
                              strokeWidth={0}
                            />
                          ))}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-fg-muted">
                        {r.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-border bg-bg-subtle p-3 space-y-2">
                <p className="text-[11px] font-semibold text-fg-muted">
                  Write a review
                </p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setReviewStars(n)}
                      className={cn(
                        "p-1",
                        n <= reviewStars ? "text-gold" : "text-fg-subtle",
                      )}
                    >
                      <Star
                        className={cn(
                          "size-5",
                          n <= reviewStars && "fill-current",
                        )}
                        strokeWidth={1.75}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  rows={2}
                  placeholder="How’s the court?"
                  className="w-full resize-none rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm text-fg outline-none"
                />
                <button
                  type="button"
                  onClick={submitReview}
                  className="h-10 w-full rounded-xl bg-accent text-sm font-semibold text-accent-fg"
                >
                  Post review
                </button>
              </div>
            </div>

            {/* Work order — collapsed by default */}
            <div className="rounded-2xl border border-border bg-bg-subtle">
              <button
                type="button"
                onClick={() => setWoOpen((v) => !v)}
                className="flex w-full items-center gap-2.5 px-3 py-3 text-left"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-bg-elevated text-fg-muted">
                  <Wrench className="size-3.5" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-fg">
                    Court issue
                  </span>
                  <span className="block text-[11px] text-fg-subtle">
                    New net, broken rim, closed, and more
                  </span>
                </span>
                {woOpen ? (
                  <ChevronUp className="size-4 text-fg-subtle" />
                ) : (
                  <ChevronDown className="size-4 text-fg-subtle" />
                )}
              </button>

              {woOpen ? (
                <div className="space-y-3 border-t border-border px-3 pt-3 pb-3">
                  <div className="space-y-2">
                    {(
                      [
                        { id: "new_net" as const, label: "New net" },
                        { id: "broken_rim" as const, label: "Broken rim" },
                        {
                          id: "broken_backboard" as const,
                          label: "Broken backboard",
                        },
                        { id: "construction" as const, label: "Construction" },
                        { id: "event" as const, label: "Event" },
                        { id: "closed" as const, label: "Closed" },
                        { id: "other" as const, label: "Other" },
                      ] as const
                    ).map((opt) => (
                      <label
                        key={opt.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm",
                          woKind === opt.id
                            ? "border-court bg-court-soft text-fg"
                            : "border-border bg-bg-elevated text-fg-muted",
                        )}
                      >
                        <input
                          type="radio"
                          name="wo"
                          checked={woKind === opt.id}
                          onChange={() => setWoKind(opt.id)}
                          className="accent-[var(--color-court)]"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-fg-muted">
                      Photos (optional)
                    </p>
                    {woPhotos.length > 0 ? (
                      <div className="grid grid-cols-3 gap-1.5">
                        {woPhotos.map((src, i) => (
                          <div
                            key={`${i}-${src.slice(0, 16)}`}
                            className="relative aspect-square overflow-hidden rounded-lg border border-border"
                          >
                            <img
                              src={src}
                              alt=""
                              className="size-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setWoPhotos((prev) =>
                                  prev.filter((_, j) => j !== i),
                                )
                              }
                              className="absolute top-1 right-1 rounded-full bg-black/55 p-1 text-white"
                              aria-label="Remove photo"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <input
                        ref={woCamRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          void pickWoPhoto(e.target.files);
                          e.target.value = "";
                        }}
                      />
                      <input
                        ref={woLibRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          void pickWoPhoto(e.target.files);
                          e.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        disabled={woPicking}
                        onClick={() => woCamRef.current?.click()}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-elevated py-2.5 text-xs font-semibold text-fg disabled:opacity-60"
                      >
                        <Camera className="size-3.5" />
                        Camera
                      </button>
                      <button
                        type="button"
                        disabled={woPicking}
                        onClick={() => woLibRef.current?.click()}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-elevated py-2.5 text-xs font-semibold text-fg disabled:opacity-60"
                      >
                        <ImagePlus className="size-3.5" />
                        {woPhotos.length ? "Add more" : "Upload"}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={submitWorkOrder}
                    disabled={woPicking}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-fg disabled:opacity-60"
                  >
                    <Wrench className="size-4" strokeWidth={2} />
                    Submit court issue
                  </button>
                  {woMsg ? (
                    <p className="text-center text-xs text-fg-muted" role="status">
                      {woMsg}
                    </p>
                  ) : null}
                  {courtOrders.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      <p className="text-[10px] font-semibold tracking-wide text-fg-subtle uppercase">
                        Your requests
                      </p>
                      {courtOrders.map((w) => (
                        <div
                          key={w.id}
                          className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-xs text-fg-muted"
                        >
                          {WORK_ORDER_LABELS[w.kind]}
                          {w.detail ? ` — ${w.detail}` : ""} · {w.status}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* bottom spacer for sticky bar */}
            <div className="h-2" />
          </div>
        </div>

        {/* Sticky primary actions */}
        <div className="shrink-0 border-t border-border bg-bg-elevated/95 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center justify-center gap-1.5 rounded-full border border-border bg-bg-subtle text-[13px] font-semibold text-fg active:scale-[0.98]"
            >
              Directions
              <ExternalLink className="size-3.5 opacity-70" strokeWidth={1.75} />
            </a>
            <button
              type="button"
              onClick={toggleFav}
              className={cn(
                "flex size-11 items-center justify-center rounded-full border active:scale-[0.98]",
                isFav
                  ? "border-court/40 bg-court/20 text-court"
                  : "border-border bg-bg-subtle text-fg",
              )}
              aria-label={isFav ? "Unsave court" : "Save court"}
            >
              <Heart
                className={cn("size-4", isFav && "fill-current")}
                strokeWidth={1.75}
              />
            </button>
            <button
              type="button"
              onClick={() => onQuickMatch?.(display)}
              className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-court text-[13px] font-semibold text-white active:scale-[0.98]"
            >
              <Swords className="size-3.5" strokeWidth={2} />
              Play here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
