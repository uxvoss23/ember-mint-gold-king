import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Heart,
  Info,
  LocateFixed,
  Radio,
  Search,
  SlidersHorizontal,
  Star,
  Swords,
  TreePine,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { CourtsMap } from "@/components/courts-map";
import {
  CourtsMapCarousel,
  type CarouselCardMeta,
  type CourtsMapCarouselHandle,
} from "@/components/courts-map-carousel";
import { ConfirmPickupPopup } from "@/components/confirm-pickup-popup";
import { ImageCarousel } from "@/components/image-carousel";
import { AdminEditCourtButton } from "@/components/admin-court-editor";
import { CourtAboutSheet } from "@/components/compete/court-about-sheet";
import { isModeratorMe } from "@/lib/auth/admin";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  mergeCourtWithOverride,
  useCourtAdmin,
  useHydrateCourtAdmin,
} from "@/lib/courts/admin-overrides";
import { useFavorites } from "@/lib/courts/favorites";
import { COURT_PLACEHOLDER, imagesForCourt, isPlaceholderPhoto } from "@/lib/courts/images";
import {
  confirmCount,
  courtIdsHoopingNow,
  favoriteCountFor,
  formatCheckInClock,
  formatCheckInTime,
  hasVerified,
  hoopingNowAnnounceText,
  latestLiveCheckIn,
  patternsForCourt,
  reviewsFor,
  useCourtSocial,
  useHydrateCourtSocial,
  type WorkOrderKind,
} from "@/lib/courts/social";
import type { Court, UserLocation } from "@/lib/courts/types";
import { useUpsetStore } from "@/lib/upset/store";
import { mutationError } from "@/lib/game/client-actions";
import { useRequireAuth } from "@/lib/game/use-require-auth";
import { cn, formatDistance, haversineMeters, milesToMeters } from "@/lib/utils";
import { ucMark } from "@/lib/perf/uc-mark";
import { publishCourts } from "@/lib/maps/court-layers";

/* ─── Sheet heights (% of courts root) ─────────────────────────────────── */

const SHEET_PEEK = 28;
const SHEET_MID = 58;
const SHEET_FULL = 94;
/** @deprecated alias — map select uses mid (2nd of 3 levels) */
const SHEET_PREVIEW = SHEET_MID;

const RADIUS_MILES = [1, 3, 5, 10, 15, 20] as const;
const RADIUS_ANY = 50;

const AREA_CHIPS = [
  { id: "all", label: "All areas" },
  { id: "East Austin", label: "East Side" },
  { id: "East", label: "East" },
  { id: "West", label: "West" },
  { id: "Downtown", label: "Downtown" },
  { id: "Domain", label: "Domain" },
  { id: "South Austin", label: "South" },
  { id: "Northwest", label: "Northwest" },
  { id: "Northeast", label: "Northeast" },
  { id: "Central", label: "Central" },
] as const;

const UC_PICK_IDS = new Set([
  "cat-zilker",
  "cat-battle-bend",
  "cat-pease",
  "cat-bartholomew",
  "cat-rosewood",
  "cat-reed",
  "cat-circle-c",
  "cat-west4",
  "cat-garrison",
  "cat-walnut-creek",
  "cat-hancock",
  "cat-searight",
  "cat-givens",
]);

function directionsUrl(lat: number, lon: number, name: string) {
  const q = encodeURIComponent(`${name} @${lat},${lon}`);
  return `https://maps.apple.com/?daddr=${lat},${lon}&q=${q}`;
}

async function geocodeAustinAddress(
  q: string,
): Promise<{ lat: number; lon: number; label: string } | null> {
  const query = q.trim();
  if (query.length < 3) return null;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${query}, Austin, Texas`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("viewbox", "-98.05,30.55,-97.45,30.05");
  url.searchParams.set("bounded", "1");
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    const hit = data[0];
    if (!hit) return null;
    return {
      lat: Number(hit.lat),
      lon: Number(hit.lon),
      label: hit.display_name.split(",").slice(0, 2).join(","),
    };
  } catch {
    return null;
  }
}

function chipClass(on: boolean) {
  return cn(
    "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition",
    on
      ? "bg-court text-white shadow-sm"
      : "border border-border bg-bg-elevated text-fg-muted hover:text-fg",
  );
}

function areaChipClass(on: boolean) {
  return cn(
    "inline-flex shrink-0 items-center rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition",
    on
      ? "border border-court bg-court/15 text-court"
      : "border border-border bg-bg-elevated text-fg-muted hover:text-fg",
  );
}

function matchesArea(court: Court, areaId: string) {
  if (areaId === "all") return true;
  const n = (court.neighborhood ?? "").toLowerCase();
  const id = areaId.toLowerCase();
  if (id === "east") return n.includes("east") && !n.includes("northeast");
  if (id === "west") return n.includes("west") || n.includes("southwest");
  return n.includes(id) || n === id;
}

function listFocusY(list: HTMLElement) {
  const root = list.getBoundingClientRect();
  return root.top + Math.min(148, Math.max(64, root.height * 0.22));
}

function primaryCourtId(list: HTMLElement): string | null {
  const cards = list.querySelectorAll<HTMLElement>("[data-court-card]");
  if (cards.length === 0) return null;
  const root = list.getBoundingClientRect();
  const focusY = listFocusY(list);
  let best: { id: string; score: number } | null = null;
  for (const card of cards) {
    const id = card.dataset.courtId;
    if (!id) continue;
    const r = card.getBoundingClientRect();
    if (r.bottom < root.top + 6 || r.top > root.bottom - 6) continue;
    const overlap = Math.min(r.bottom, root.bottom) - Math.max(r.top, root.top);
    if (overlap < 28) continue;
    const mid = (r.top + r.bottom) / 2;
    const onLine = r.top <= focusY && r.bottom >= focusY;
    const score = Math.abs(mid - focusY) - (onLine ? 420 : 0) - overlap * 0.12;
    if (!best || score < best.score) best = { id, score };
  }
  return best?.id ?? cards[0]?.dataset.courtId ?? null;
}

function cardStillPrimary(list: HTMLElement, id: string) {
  const card = list.querySelector<HTMLElement>(`[data-court-id="${id}"]`);
  if (!card) return false;
  const focusY = listFocusY(list);
  const r = card.getBoundingClientRect();
  return r.top <= focusY + 12 && r.bottom >= focusY - 12;
}

function scrollCardIntoList(
  list: HTMLElement,
  id: string,
  smooth: boolean,
  force = false,
) {
  const card = list.querySelector<HTMLElement>(`[data-court-id="${id}"]`);
  if (!card) return;
  const listRect = list.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  if (
    !force &&
    cardRect.top < listRect.top - 10 &&
    cardRect.bottom > listFocusY(list) + 24
  ) {
    return;
  }
  const top = list.scrollTop + (cardRect.top - listRect.top) - 6;
  if (Math.abs(list.scrollTop - top) < 10) return;
  list.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
}

/* ─── SelectedCourtPreview ────────────────────────────────────────────── */

const SelectedCourtPreview = memo(function SelectedCourtPreview({
  court,
  onDismiss,
  onQuickMatch,
  active = false,
  onActivate,
}: {
  court: Court;
  onDismiss?: () => void;
  onQuickMatch?: (court: Court) => void;
  active?: boolean;
  onActivate?: () => void;
}) {
  const social = useCourtSocial();
  const requireAuth = useRequireAuth();
  const favorites = useFavorites();
  const store = useUpsetStore();
  const me = store.me;
  const authUser = useCurrentUser();
  const admin = isModeratorMe(me?.role, authUser?.primaryEmail);
  const ov = useCourtAdmin((s) => s.overrides[court.id]);
  const display = mergeCourtWithOverride(court, ov);
  const images = imagesForCourt(court.id, 5, ov ? { [court.id]: ov } : null);
  const isFav = favorites.ids.includes(court.id);
  const favCount = favoriteCountFor(court.id, isFav, social.favoriteBonus);
  const courtReviews = reviewsFor(social.reviews, court.id);
  const avgReview =
    courtReviews.reduce((s, r) => s + r.rating, 0) /
    Math.max(1, courtReviews.length);
  const live = latestLiveCheckIn(social.checkIns, court.id);
  const pattern = patternsForCourt(social.checkIns, court.id);
  const courtOrders = social.workOrders.filter((w) => w.courtId === court.id);
  const mapsUrl = directionsUrl(display.lat, display.lon, display.name);
  const authorName = me?.name || "You";
  const authorFirst = authorName.split(" ")[0] || "You";

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [woKind, setWoKind] = useState<WorkOrderKind>("broken_rim");
  const [woMsg, setWoMsg] = useState<string | null>(null);
  const [livePhotoMode, setLivePhotoMode] = useState<
    "collapsed" | "compact" | "large"
  >("compact");

  const toggleFav = () => {
    favorites.toggle(court.id);
    if (!isFav) social.bumpFavorite(court.id);
  };

  const onVerify = async () => {
    if (!live) return;
    if (!requireAuth("check in")) return;
    try {
      await social.verifyCheckIn(live.id, authorFirst);
    } catch (err) {
      setWoMsg(mutationError(err));
    }
  };

  const submitPickup = async (input: { photoUrl: string }) => {
    if (!requireAuth("check in")) return;
    try {
      await social.addCheckIn({
        courtId: court.id,
        courtName: display.name,
        photoUrl: input.photoUrl,
        author: authorFirst,
      });
      setPostOpen(false);
    } catch (err) {
      setWoMsg(mutationError(err));
    }
  };

  const submitWo = async () => {
    if (!requireAuth("report")) return;
    try {
      await social.addWorkOrder(court.id, woKind, undefined, {
        courtName: display.name,
        reporter: authorFirst,
      });
      setWoMsg(
        "Thank you for letting the city know. A ticket has been submitted.",
      );
      window.setTimeout(() => setWoMsg(null), 10_000);
    } catch (err) {
      setWoMsg(mutationError(err));
    }
  };

  const verified = live ? hasVerified(live, authorFirst) : false;
  const compact = !!onDismiss;
  const hasRealPhoto = images.some((src) => !isPlaceholderPhoto(src));
  const distanceText = formatDistance(display.distanceMeters);
  const placeLine = [display.neighborhood, distanceText].filter(Boolean).join(" · ");

  return (
    <div
      data-court-card
      data-court-id={court.id}
      className={cn(
        "overflow-hidden rounded-2xl border bg-bg-elevated shadow-card transition-[border-color,box-shadow] duration-200",
        active
          ? "border-court shadow-[inset_3px_0_0_0_var(--color-court)]"
          : "border-border",
      )}
      onClick={(e) => {
        if (!onActivate) return;
        const t = e.target as HTMLElement;
        if (t.closest("button, a, input, [role='button']")) return;
        onActivate();
      }}
    >
      {hasRealPhoto ? (
        <div className="relative">
          <ImageCarousel
            images={images}
            alt={display.name}
            className="w-full"
            priority={active}
            compact
          />
          {live ? (
            <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-500/95 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm">
              <Radio className="size-2.5 animate-pulse" strokeWidth={2.5} />
              Hooping now
            </span>
          ) : null}
          {admin || onDismiss ? (
            <div className="absolute top-2 right-2 z-10 flex gap-1.5">
              {admin ? <AdminEditCourtButton court={display} /> : null}
              {onDismiss ? (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="flex size-8 items-center justify-center rounded-full border border-border bg-bg/70 text-fg backdrop-blur-md"
                  aria-label="Dismiss selection"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="relative h-12 overflow-hidden bg-bg-subtle">
          <img
            src={COURT_PLACEHOLDER}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-[0.14]"
          />
          {live ? (
            <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-500/95 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm">
              <Radio className="size-2.5 animate-pulse" strokeWidth={2.5} />
              Hooping now
            </span>
          ) : null}
          {admin ? (
            <div className="absolute top-1.5 right-2 z-10">
              <AdminEditCourtButton court={display} />
            </div>
          ) : null}
        </div>
      )}

      <div
        className={cn(
          "px-3",
          compact ? "space-y-1.5 pt-1.5 pb-2" : "space-y-2.5 pt-2.5 pb-2.5",
        )}
      >
        <div>
          <h3 className="font-display text-[15px] font-semibold leading-snug tracking-tight text-fg">
            {display.name}
          </h3>
          {placeLine ? (
            <p className="mt-0.5 truncate text-[12px] text-fg-muted">{placeLine}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-fg-muted">
            <span className="inline-flex items-center gap-1 font-semibold text-fg">
              <Star className="size-3 fill-amber-400 text-amber-400" />
              {courtReviews.length ? avgReview.toFixed(1) : "—"}
              <span className="font-normal text-fg-subtle">
                ({courtReviews.length})
              </span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart
                className={cn(
                  "size-3",
                  isFav ? "fill-court text-court" : "text-fg-subtle",
                )}
              />
              <span className="tabular-nums text-fg">{favCount}</span>
            </span>
          </div>
        </div>

        {/* CTAs first so they land in the map-select snap viewport */}
        <div className="flex gap-1.5">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-border bg-bg-subtle py-2 text-[12px] font-semibold text-fg"
          >
            <ExternalLink className="size-3.5" strokeWidth={1.75} />
            Directions
          </a>
          <button
            type="button"
            onClick={toggleFav}
            className={cn(
              "inline-flex size-10 shrink-0 items-center justify-center rounded-xl border",
              isFav
                ? "border-court/40 bg-court/15 text-court"
                : "border-border bg-bg-subtle text-fg-muted",
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
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-court py-2 text-[12px] font-semibold text-white"
          >
            <Swords className="size-3.5" strokeWidth={1.75} />
            Play
          </button>
        </div>

        {/* Pickup / hooping now */}
        <div
          className={cn(
            "rounded-xl border border-border bg-bg-subtle/80",
            compact ? "p-2" : "p-2.5",
          )}
        >
          {live ? (
            <div className="space-y-2">
              <div className="overflow-hidden rounded-xl border border-emerald-500/25 bg-bg-elevated">
                {livePhotoMode === "collapsed" ? (
                  <button
                    type="button"
                    onClick={() => setLivePhotoMode("compact")}
                    className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
                  >
                    <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white">
                      LIVE
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-fg">
                      {hoopingNowAnnounceText(live.courtName ?? display.name)}
                    </span>
                    <span className="text-[10px] font-medium text-fg-muted">
                      Show photo
                    </span>
                  </button>
                ) : (
                  <>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setLivePhotoMode((m) =>
                            m === "large" ? "compact" : "large",
                          )
                        }
                        className="block w-full"
                        aria-label={
                          livePhotoMode === "large"
                            ? "Shrink photo"
                            : "Enlarge photo"
                        }
                      >
                        <img
                          src={live.photoUrl}
                          alt=""
                          className={cn(
                            "w-full object-cover",
                            livePhotoMode === "large" ? "h-44" : "h-20",
                          )}
                        />
                      </button>
                      <span className="pointer-events-none absolute top-1.5 left-1.5 rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white shadow-sm">
                        LIVE
                      </span>
                      <div className="absolute top-1.5 right-1.5 flex gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setLivePhotoMode((m) =>
                              m === "large" ? "compact" : "large",
                            )
                          }
                          className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm"
                        >
                          {livePhotoMode === "large" ? "Shrink" : "Enlarge"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setLivePhotoMode("collapsed")}
                          className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm"
                        >
                          Hide
                        </button>
                      </div>
                    </div>
                    <div className="space-y-0.5 px-2.5 py-1.5">
                      <p className="text-[12px] font-semibold leading-snug text-fg">
                        {hoopingNowAnnounceText(live.courtName ?? display.name)}
                      </p>
                      <p className="text-[11px] text-fg-muted">
                        <span className="font-medium text-fg">{live.author}</span>
                        <span className="text-fg-subtle"> · </span>
                        {formatCheckInClock(live.at)}
                        <span className="text-fg-subtle"> · </span>
                        {formatCheckInTime(live.at)}
                        <span className="text-fg-subtle"> · </span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {confirmCount(live)} confirmed
                        </span>
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={verified}
                  onClick={onVerify}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                    verified
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "border border-emerald-500/70 bg-bg-elevated text-fg-muted hover:text-fg",
                  )}
                >
                  {verified ? "Confirmed ✓" : "Confirm Pick Game"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setPostOpen(true)}
                className="flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border px-2 py-2.5 text-fg"
              >
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold">
                  <Users className="size-3.5" strokeWidth={1.75} />
                  Confirm Pick Game
                </span>
                <span className="text-[11px] font-normal text-fg-muted">
                  Confirm if you see a pick up game happening
                </span>
              </button>
              {postOpen ? (
                <ConfirmPickupPopup
                  courtName={display.name}
                  onClose={() => setPostOpen(false)}
                  onSubmit={submitPickup}
                />
              ) : null}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          className="flex w-full items-center justify-between text-[11px] font-semibold text-fg-muted"
        >
          <span>Details · court issues</span>
          {detailsOpen ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>

        {detailsOpen ? (
          <div className="space-y-3 border-t border-border pt-2">
            {display.notes ? (
              <p className="text-[12px] leading-relaxed text-fg-muted">
                {display.notes}
              </p>
            ) : null}
            {pattern?.summary ? (
              <p className="text-[11px] text-fg-subtle">{pattern.summary}</p>
            ) : null}

            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold tracking-wide text-fg-subtle uppercase">
                Reviews
              </p>
              {courtReviews.length === 0 ? (
                <p className="text-[12px] text-fg-subtle">No reviews yet</p>
              ) : (
                courtReviews.slice(0, 4).map((r) => (
                  <div key={r.id} className="rounded-lg bg-bg-subtle px-2.5 py-1.5">
                    <p className="text-[12px] font-medium text-fg">
                      {r.author}{" "}
                      <span className="text-amber-400">
                        {"★".repeat(r.rating)}
                      </span>
                    </p>
                    <p className="text-[12px] text-fg-muted">{r.text}</p>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold tracking-wide text-fg-subtle uppercase">
                Court issue
              </p>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["new_net", "New net"],
                    ["broken_rim", "Broken rim"],
                    ["broken_backboard", "Broken backboard"],
                    ["construction", "Construction"],
                    ["event", "Event"],
                    ["closed", "Closed"],
                    ["other", "Other"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setWoKind(k)}
                    className={chipClass(woKind === k)}
                  >
                    <Wrench className="size-3" />
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={submitWo}
                className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-fg"
              >
                Submit court issue
              </button>
              {woMsg ? (
                <p className="text-[12px] leading-relaxed text-emerald-600 dark:text-emerald-400">
                  {woMsg}
                </p>
              ) : null}
              {courtOrders.length > 0 ? (
                <p className="text-[11px] text-fg-subtle">
                  {courtOrders.length} open report
                  {courtOrders.length === 1 ? "" : "s"} on this court
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
});

/* ─── CourtsFinder ─────────────────────────────────────────────────────── */

export interface CourtsFinderProps {
  courts: Court[];
  location: UserLocation;
  loading: boolean;
  locating: boolean;
  error: string | null;
  locError: string | null;
  radiusMi: number;
  dataSource: string;
  outOfArea?: boolean;
  onRadiusChange: (mi: number) => void;
  onRefresh: () => void;
  onNearMe: () => void;
  onQuickMatch?: (court: Court) => void;
  focusCourtId?: string | null;
  onFocusCourtConsumed?: () => void;
  /** True while the Courts tab is the visible home surface */
  active?: boolean;
}

export function CourtsFinder({
  courts,
  location,
  loading,
  locating,
  error,
  locError,
  radiusMi,
  dataSource,
  outOfArea = false,
  onRadiusChange,
  onRefresh,
  onNearMe,
  onQuickMatch,
  focusCourtId,
  onFocusCourtConsumed,
  active = true,
}: CourtsFinderProps) {
  useHydrateCourtSocial();
  useHydrateCourtAdmin();
  useEffect(() => {
    ucMark("courts:page-mount");
  }, []);
  const social = useCourtSocial();
  const favorites = useFavorites();
  const rootRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const carouselApiRef = useRef<CourtsMapCarouselHandle>(null);
  const ignoreCarouselRef = useRef(false);

  const [sheetH, setSheetH] = useState(SHEET_MID);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<Court | null>(null);
  const [browseMode, setBrowseMode] = useState<"map" | "list">("map");
  const overlayPctRef = useRef(42);
  const carouselWrapRef = useRef<HTMLDivElement>(null);
  const [aboutCourt, setAboutCourt] = useState<Court | null>(null);
  const [filters, setFilters] = useState<Set<string>>(() => new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [areas, setAreas] = useState<Set<string>>(() => new Set(["all"]));
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOrigin, setSearchOrigin] = useState<{
    lat: number;
    lon: number;
    label: string;
  } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);

  const dragRef = useRef<{
    startY: number;
    startH: number;
    pointerId: number;
  } | null>(null);

  const applySheetH = useCallback((h: number) => {
    const clamped = Math.min(SHEET_FULL, Math.max(SHEET_PEEK, h));
    setSheetH(clamped);
  }, []);

  const origin = searchOrigin ?? {
    lat: location.lat,
    lon: location.lon,
  };

  const hoopingIds = useMemo(
    () => courtIdsHoopingNow(social.checkIns),
    [social.checkIns],
  );
  const hoopingCount = hoopingIds.size;

  const filtered = useMemo(() => {
    let list = courts
      .map((c) => ({
        ...c,
        distanceMeters: haversineMeters(origin.lat, origin.lon, c.lat, c.lon),
      }))
      .filter((c) =>
        radiusMi >= RADIUS_ANY ? true : c.distanceMeters <= milesToMeters(radiusMi),
      );

    if (filters.has("hooping")) {
      list = list.filter((c) => hoopingIds.has(c.id));
    }
    if (filters.has("favorites")) {
      list = list.filter((c) => favorites.ids.includes(c.id));
    }
    if (filters.has("shade")) {
      list = list.filter((c) => (c.amenities ?? []).includes("shade"));
    }
    if (filters.has("uc_picks")) {
      list = list.filter((c) => UC_PICK_IDS.has(c.id));
    }
    if (!areas.has("all") && areas.size > 0) {
      list = list.filter((c) =>
        [...areas].some((a) => matchesArea(c, a)),
      );
    }

    list.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return list;
  }, [
    courts,
    origin.lat,
    origin.lon,
    radiusMi,
    filters,
    areas,
    favorites.ids,
    hoopingIds,
  ]);

  useEffect(() => {
    ucMark("courts:data");
  }, [courts.length]);
  useEffect(() => {
    ucMark("courts:filtered");
    publishCourts(filtered, hoopingIds, selected?.id ?? null);
  }, [filtered, hoopingIds, selected?.id]);

  const nameSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    return filtered
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, filtered]);

  const selectedVisible = !!selected && filtered.some((c) => c.id === selected.id);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;
  const browseModeRef = useRef(browseMode);
  browseModeRef.current = browseMode;
  const ignoreListScrollRef = useRef(false);
  const listScrollRaf = useRef(0);
  const snapTmr = useRef(0);
  const adminOverrides = useCourtAdmin((s) => s.overrides);

  const cardMeta = useMemo(() => {
    const out: Record<string, CarouselCardMeta> = {};
    const fav = favorites.ids;
    for (const c of filtered) {
      const courtReviews = reviewsFor(social.reviews, c.id);
      const avg =
        courtReviews.reduce((s, r) => s + r.rating, 0) /
        Math.max(1, courtReviews.length);
      const isFav = fav.includes(c.id);
      out[c.id] = {
        avg,
        reviews: courtReviews.length,
        favCount: favoriteCountFor(c.id, isFav, social.favoriteBonus),
        live: hoopingIds.has(c.id),
      };
    }
    return out;
  }, [filtered, favorites.ids, social.reviews, social.favoriteBonus, hoopingIds]);

  const filterCount =
    filters.size +
    (areas.has("all") ? 0 : areas.size) +
    (radiusMi < RADIUS_ANY ? 1 : 0);
  const filtersCompact =
    browseMode === "map" &&
    !filtersOpen &&
    !!selected &&
    filtered[0]?.id !== selected.id;

  const selectCourt = useCallback(
    (c: Court, from: "pin" | "card" | "scroll" | "focus" | "arrow" = "pin") => {
      setSelected(c);
      if (from === "scroll") return;
      if (browseModeRef.current === "list") {
        if (from === "pin" || from === "focus") applySheetH(SHEET_MID);
        ignoreListScrollRef.current = true;
        requestAnimationFrame(() => {
          const el = listRef.current;
          if (el) scrollCardIntoList(el, c.id, true, true);
          window.setTimeout(() => {
            ignoreListScrollRef.current = false;
          }, 420);
        });
        return;
      }
      ignoreCarouselRef.current = true;
      requestAnimationFrame(() => {
        carouselApiRef.current?.scrollToId(c.id, from !== "focus");
        window.setTimeout(() => {
          ignoreCarouselRef.current = false;
        }, 380);
      });
    },
    [applySheetH],
  );

  useLayoutEffect(() => {
    if (active && browseMode === "map") {
      document.documentElement.setAttribute("data-uc-courts-map", "1");
      return () => document.documentElement.removeAttribute("data-uc-courts-map");
    }
    document.documentElement.removeAttribute("data-uc-courts-map");
  }, [active, browseMode]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const target =
      browseMode === "map" ? carouselWrapRef.current : sheetRef.current;
    if (!root || !target) return;
    const publish = () => {
      const pct = (target.offsetHeight / Math.max(1, root.clientHeight)) * 100;
      overlayPctRef.current = Math.round(pct * 10) / 10;
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(target);
    ro.observe(root);
    return () => ro.disconnect();
  }, [browseMode]);

  useEffect(() => {
    if (!selected) return;
    if (browseMode === "list") {
      const el = listRef.current;
      if (el) scrollCardIntoList(el, selected.id, false, true);
    } else {
      ignoreCarouselRef.current = true;
      carouselApiRef.current?.scrollToId(selected.id, false);
      const t = window.setTimeout(() => {
        ignoreCarouselRef.current = false;
      }, 200);
      return () => window.clearTimeout(t);
    }
  }, [browseMode]); // eslint-disable-line react-hooks/exhaustive-deps -- only when toggling List/Map

  useEffect(() => {
    if (filtered.length === 0) {
      if (selected) setSelected(null);
      return;
    }
    if (selected && filtered.some((c) => c.id === selected.id)) return;
    selectCourt(filtered[0]!, "focus");
  }, [filtered, selected, selectCourt]);

  const onListScroll = useCallback(() => {
    if (ignoreListScrollRef.current || dragging) return;
    const list = listRef.current;
    if (!list) return;
    if (listScrollRaf.current) return;
    listScrollRaf.current = requestAnimationFrame(() => {
      listScrollRaf.current = 0;
      if (ignoreListScrollRef.current) return;
      const cur = selectedRef.current?.id ?? null;
      if (cur && cardStillPrimary(list, cur)) return;
      const next = primaryCourtId(list);
      if (!next || next === cur) return;
      const court = filteredRef.current.find((c) => c.id === next);
      if (court) selectCourt(court, "scroll");
    });
    window.clearTimeout(snapTmr.current);
    snapTmr.current = window.setTimeout(() => {
      if (ignoreListScrollRef.current || dragging) return;
      const el = listRef.current;
      const id = selectedRef.current?.id ?? (el ? primaryCourtId(el) : null);
      if (el && id) {
        ignoreListScrollRef.current = true;
        scrollCardIntoList(el, id, true);
        window.setTimeout(() => {
          ignoreListScrollRef.current = false;
        }, 320);
      }
    }, 150);
  }, [dragging, selectCourt]);

  useEffect(() => {
    if (!focusCourtId) return;
    const hit =
      filtered.find((c) => c.id === focusCourtId) ??
      courts.find((c) => c.id === focusCourtId);
    if (hit) {
      const withDist = {
        ...hit,
        distanceMeters: haversineMeters(
          origin.lat,
          origin.lon,
          hit.lat,
          hit.lon,
        ),
      };
      selectCourt(withDist, "focus");
    }
    onFocusCourtConsumed?.();
  }, [
    focusCourtId,
    filtered,
    courts,
    origin.lat,
    origin.lon,
    selectCourt,
    onFocusCourtConsumed,
  ]);

  const toggleFilter = (id: string) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setFilters(new Set());
    setAreas(new Set(["all"]));
  };

  const toggleArea = (id: string) => {
    setAreas((prev) => {
      if (id === "all") return new Set(["all"]);
      const next = new Set(prev);
      next.delete("all");
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) return new Set(["all"]);
      return next;
    });
  };

  const runGeocode = async () => {
    const q = query.trim();
    if (q.length < 3) return;
    setGeocoding(true);
    try {
      const hit = await geocodeAustinAddress(q);
      if (hit) {
        setSearchOrigin(hit);
        setSearchOpen(false);
      }
    } finally {
      setGeocoding(false);
    }
  };

  const onHandlePointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-sheet-drag]")) return;
    const startY = e.clientY;
    const startH = sheetH;
    dragRef.current = { startY, startH, pointerId: e.pointerId };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current || ev.pointerId !== dragRef.current.pointerId)
        return;
      const rootH = rootRef.current?.clientHeight || window.innerHeight;
      const dy = dragRef.current.startY - ev.clientY;
      const deltaPct = (dy / rootH) * 100;
      applySheetH(dragRef.current.startH + deltaPct);
    };
    const onUp = (ev: PointerEvent) => {
      if (!dragRef.current || ev.pointerId !== dragRef.current.pointerId)
        return;
      dragRef.current = null;
      setDragging(false);
      const stops = [SHEET_PEEK, SHEET_MID, SHEET_FULL];
      const cur = sheetH;
      // snap to nearest after release — use latest via rAF read
      requestAnimationFrame(() => {
        const h =
          Number(
            (sheetRef.current?.style.height || "").replace("%", ""),
          ) || cur;
        let best = stops[0];
        let bestD = Math.abs(h - best);
        for (const s of stops) {
          const d = Math.abs(h - s);
          if (d < bestD) {
            best = s;
            bestD = d;
          }
        }
        applySheetH(best);
      });
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const listMapToggle = (
    <div
      className="flex shrink-0 rounded-full border border-border bg-bg-elevated p-0.5"
      data-no-sheet-drag
    >
      <button
        type="button"
        onClick={() => {
          setBrowseMode("list");
          applySheetH(SHEET_MID);
        }}
        className={cn(
          "rounded-full px-2.5 py-1 text-[11px] font-semibold",
          browseMode === "list" ? "bg-fg text-bg" : "text-fg-muted",
        )}
        style={{ touchAction: "manipulation" }}
        aria-pressed={browseMode === "list"}
      >
        List
      </button>
      <button
        type="button"
        onClick={() => setBrowseMode("map")}
        className={cn(
          "rounded-full px-2.5 py-1 text-[11px] font-semibold",
          browseMode === "map" ? "bg-fg text-bg" : "text-fg-muted",
        )}
        style={{ touchAction: "manipulation" }}
        aria-pressed={browseMode === "map"}
      >
        Map
      </button>
    </div>
  );

  const iconBtn =
    "flex size-9 shrink-0 items-center justify-center rounded-full text-fg-muted";

  const mapChrome = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => {
          setSearchOpen((v) => !v);
          setFiltersOpen(false);
        }}
        className={cn(iconBtn, searchOpen && "bg-fg text-bg")}
        aria-label="Search"
      >
        <Search className="size-3.5" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={onNearMe}
        disabled={locating}
        className={cn(iconBtn, "disabled:opacity-60")}
        aria-label="Near me"
      >
        <LocateFixed className="size-3.5" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => {
          setFiltersOpen((v) => !v);
          setSearchOpen(false);
        }}
        className={cn(
          "uc-press relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold",
          filtersOpen ? "bg-fg text-bg" : "text-fg",
        )}
        aria-expanded={filtersOpen}
        aria-label={filtersOpen ? "Hide filters" : "Show filters"}
      >
        <SlidersHorizontal className="size-3.5" strokeWidth={1.75} />
        {filtersCompact ? null : <span>Filters</span>}
        {filterCount > 0 ? (
          <span
            className={cn(
              "flex min-w-4 items-center justify-center rounded-full bg-court px-1 text-[10px] font-bold leading-4 text-white",
              filtersCompact &&
                "absolute -top-0.5 -right-0.5 min-w-3.5 px-0.5 leading-none",
            )}
          >
            {filterCount}
          </span>
        ) : null}
      </button>
      <div className="min-w-0 flex-1" />
      {listMapToggle}
    </div>
  );

  const chromeRow = (
    <div className="flex min-h-10 items-center gap-1">
      <button
        type="button"
        onClick={() => {
          setSearchOpen((v) => !v);
          setFiltersOpen(false);
          if (browseMode === "list" && !searchOpen) applySheetH(SHEET_PEEK);
        }}
        className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-bg-elevated text-fg-muted"
        aria-label="Search"
        data-no-sheet-drag
      >
        <Search className="size-3.5" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={onNearMe}
        disabled={locating}
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg disabled:opacity-60"
        aria-label="Near me"
        data-no-sheet-drag
      >
        <LocateFixed className="size-3.5" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => {
          setFiltersOpen((v) => !v);
          setSearchOpen(false);
        }}
        className="uc-press relative flex min-h-10 min-w-0 flex-1 items-center rounded-lg py-0.5 pr-1 text-left"
        aria-expanded={filtersOpen}
        aria-label={filtersOpen ? "Hide filters" : "Show filters"}
        data-no-sheet-drag
      >
        <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-fg">
          <SlidersHorizontal className="size-3.5 shrink-0" strokeWidth={1.75} />
          Filters
          {filterCount > 0 ? (
            <span className="flex min-w-4 items-center justify-center rounded-full bg-court px-1 text-[10px] font-bold leading-4 text-white">
              {filterCount}
            </span>
          ) : null}
        </span>
      </button>
      {listMapToggle}
    </div>
  );

  const filterPanel = (
    <div className="space-y-1.5">
      <div className="flex flex-nowrap gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button type="button" onClick={clearFilters} className={chipClass(filters.size === 0)} data-no-sheet-drag>
          All
        </button>
        <button
          type="button"
          onClick={() => toggleFilter("hooping")}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition",
            filters.has("hooping")
              ? "bg-emerald-500 text-white shadow-sm"
              : "border border-emerald-500/70 bg-bg-elevated text-fg-muted hover:text-fg",
          )}
          data-no-sheet-drag
        >
          <Radio className="size-3" strokeWidth={2} />
          Hooping now
          {hoopingCount > 0 ? (
            <span className="tabular-nums opacity-90">{hoopingCount}</span>
          ) : null}
        </button>
        <button type="button" onClick={() => toggleFilter("favorites")} className={chipClass(filters.has("favorites"))} data-no-sheet-drag>
          <Heart className={cn("size-3", filters.has("favorites") && "fill-current")} strokeWidth={1.75} />
          Saved
        </button>
        <button type="button" onClick={() => toggleFilter("shade")} className={chipClass(filters.has("shade"))} data-no-sheet-drag>
          <TreePine className="size-3" strokeWidth={1.75} />
          Shade
        </button>
        <button type="button" onClick={() => toggleFilter("uc_picks")} className={chipClass(filters.has("uc_picks"))} data-no-sheet-drag>
          UC picks
        </button>
      </div>
      <div className="flex flex-nowrap gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {AREA_CHIPS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => toggleArea(a.id)}
            className={areaChipClass(a.id === "all" ? areas.has("all") : areas.has(a.id))}
            data-no-sheet-drag
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        <p className="px-0.5 text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
          Distance
        </p>
        <div className="flex flex-wrap gap-1">
          {RADIUS_MILES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onRadiusChange(m)}
              className={chipClass(radiusMi === m)}
              data-no-sheet-drag
            >
              {m} mi
            </button>
          ))}
          <button
            type="button"
            onClick={() => onRadiusChange(RADIUS_ANY)}
            className={chipClass(radiusMi >= RADIUS_ANY)}
            data-no-sheet-drag
          >
            Any
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          className="text-[11px] font-medium text-court underline-offset-2 hover:underline"
          data-no-sheet-drag
        >
          Refresh
        </button>
      </div>
    </div>
  );

  const searchPanel = searchOpen ? (
    <div className="space-y-1.5" data-no-sheet-drag>
      <div className="flex gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void runGeocode();
            }
          }}
          placeholder="Court name or address…"
          className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-bg-elevated px-3 text-[16px] text-fg outline-none"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => void runGeocode()}
          disabled={geocoding}
          className="rounded-xl bg-court px-3 text-[12px] font-semibold text-white disabled:opacity-50"
        >
          {geocoding ? "…" : "Go"}
        </button>
      </div>
      {nameSuggestions.length > 0 ? (
        <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-bg-elevated">
          {nameSuggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                selectCourt(c);
                setSearchOpen(false);
                setQuery("");
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] text-fg hover:bg-bg-subtle"
            >
              <span className="truncate font-medium">{c.name}</span>
              <span className="text-[11px] text-fg-subtle">
                {formatDistance(c.distanceMeters)}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {searchOrigin ? (
        <button
          type="button"
          onClick={() => setSearchOrigin(null)}
          className="text-[11px] font-medium text-court"
        >
          Clear address · {searchOrigin.label}
        </button>
      ) : null}
    </div>
  ) : null;

  const mapCarousel = loading && courts.length === 0 ? (
    <div className="px-3 pb-2">
      <div className="overflow-hidden rounded-2xl border border-border bg-bg-elevated">
        <div className="aspect-[16/9] w-full animate-pulse bg-bg-subtle" />
        <div className="space-y-2 p-3">
          <div className="h-4 w-2/3 animate-pulse rounded bg-bg-subtle" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-bg-subtle" />
        </div>
      </div>
    </div>
  ) : filtered.length === 0 ? (
    <div className="mx-3 mb-2 flex flex-col items-center rounded-2xl border border-border bg-bg-elevated px-5 py-5 text-center">
      <h2 className="font-display text-base font-semibold text-fg">
        {outOfArea
          ? "Austin-first for now"
          : filters.has("favorites")
            ? "No saved courts yet"
            : filters.size > 0
              ? "No courts match these filters"
              : "No courts in range"}
      </h2>
      <p className="mt-1.5 max-w-xs text-sm text-fg-muted">
        {outOfArea
          ? "Upset City lists outdoor courts in the Austin area. You’re outside that zone, so nothing is shown as near you."
          : "Widen the radius, clear a filter, or search an address."}
      </p>
      <div className="mt-3 flex gap-2">
        {filters.size > 0 || !areas.has("all") ? (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full bg-court px-3.5 py-1.5 text-sm font-semibold text-white"
          >
            Clear filters
          </button>
        ) : (
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-full bg-court px-3.5 py-1.5 text-sm font-semibold text-white"
          >
            Refresh
          </button>
        )}
      </div>
    </div>
  ) : (
    <CourtsMapCarousel
      ref={carouselApiRef}
      courts={filtered}
      selectedId={selectedVisible ? selected!.id : null}
      meta={cardMeta}
      overrides={adminOverrides}
      ignoreRef={ignoreCarouselRef}
      onActiveChange={(c) => selectCourt(c, "scroll")}
      onOpenDetails={(c) => {
        selectCourt(c, "card");
        setAboutCourt(c);
      }}
    />
  );

  return (
    <div
      ref={rootRef}
      data-uc-browse={browseMode}
      className="relative z-0 isolate flex h-full min-h-0 w-full flex-col overflow-hidden bg-bg"
    >
      {/* Map */}
      <div className="absolute inset-0">
        <CourtsMap
          courts={filtered}
          location={
            searchOrigin
              ? {
                  lat: searchOrigin.lat,
                  lon: searchOrigin.lon,
                  label: searchOrigin.label,
                }
              : location
          }
          selectedId={selectedVisible ? selected!.id : undefined}
          onSelect={(c) => selectCourt(c, "pin")}
          variant="finder"
          bare
          followSelection
          followBottomPct={browseMode === "map" ? overlayPctRef.current : sheetH}
          mapClassName="h-full w-full"
          styleToggleClassName={
            browseMode === "map"
              ? "!top-[calc(env(safe-area-inset-top)+3.35rem)]"
              : undefined
          }
          hoopingNowIds={hoopingIds}
        />
      </div>

      {browseMode === "map" ? (
        <>
          <div className="absolute right-2 left-2 z-30 pt-[max(0.35rem,env(safe-area-inset-top))]">
            <div className="rounded-full border border-border bg-bg/90 px-1 py-0.5 shadow-soft backdrop-blur-md">
              {mapChrome}
            </div>
            {filtersOpen ? (
              <div
                className="mt-1.5 max-h-[min(40dvh,18rem)] overflow-y-auto rounded-2xl border border-border bg-bg-elevated p-2.5 shadow-soft"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {filterPanel}
              </div>
            ) : null}
            {searchOpen ? (
              <div className="mt-1.5 rounded-2xl border border-border bg-bg-elevated p-2.5 shadow-soft">
                {searchPanel}
              </div>
            ) : null}
            {error ? (
              <div className="mt-1.5 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px]">
                {error}
                <button
                  type="button"
                  className="ml-2 font-medium text-court underline-offset-2 hover:underline"
                  onClick={onRefresh}
                >
                  Retry
                </button>
              </div>
            ) : null}
          </div>
          <div
            ref={carouselWrapRef}
            className="pointer-events-none absolute inset-x-0 bottom-0 z-20"
          >
            <div className="pointer-events-auto">{mapCarousel}</div>
          </div>
        </>
      ) : null}

      {/* List sheet */}
      {browseMode === "list" ? (
      <div
        ref={sheetRef}
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-3xl border border-border-strong border-b-0 bg-bg/95 shadow-soft backdrop-blur-md",
          !dragging && "transition-[height] duration-220 ease-out",
        )}
        style={{
          height: `${sheetH}%`,
          willChange: dragging ? "height" : undefined,
        }}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none select-none flex-col items-center active:cursor-grabbing"
          style={{ touchAction: "none" }}
          onPointerDown={onHandlePointerDown}
          role="slider"
          aria-label="Drag court list"
          aria-valuemin={SHEET_PEEK}
          aria-valuemax={SHEET_FULL}
          aria-valuenow={Math.round(sheetH)}
          aria-valuetext={
            sheetH < 43 ? "Compact" : sheetH < 76 ? "Browse" : "Expanded"
          }
        >
          <div className="flex w-full flex-col items-center pt-2 pb-1">
            <div className="h-1.5 w-12 rounded-full bg-white/55" />
          </div>
        </div>

        <div
          className="flex shrink-0 cursor-grab touch-none select-none items-center px-2 pb-1.5 active:cursor-grabbing"
          style={{ touchAction: "none" }}
          onPointerDown={onHandlePointerDown}
        >
          {chromeRow}
        </div>

        {searchOpen ? (
          <div className="shrink-0 px-2.5 pb-1.5">{searchPanel}</div>
        ) : null}

        {filtersOpen ? (
          <div
            className="shrink-0 px-2.5 pb-1.5"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {filterPanel}
          </div>
        ) : null}

        {error ? (
          <div className="mx-2.5 mb-1.5 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px]">
            {error}
            <button
              type="button"
              className="ml-2 font-medium text-court underline-offset-2 hover:underline"
              onClick={onRefresh}
            >
              Retry
            </button>
          </div>
        ) : null}

        <div
          ref={listRef}
          data-courts-scroll="list"
          onScroll={onListScroll}
          className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-2.5 pt-0.5 pb-24 [-webkit-overflow-scrolling:touch] [touch-action:pan-y] [overflow-anchor:none] [scroll-padding-bottom:6rem]"
        >
          {loading && courts.length === 0 ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-2xl border border-border bg-bg-elevated"
                >
                  <div className="aspect-[16/10] w-full animate-pulse bg-bg-subtle" />
                  <div className="space-y-2 p-3">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-bg-subtle" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-bg-subtle" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-border bg-bg-elevated px-6 py-10 text-center">
              <h2 className="font-display text-base font-semibold text-fg">
                {outOfArea
                  ? "Austin-first for now"
                  : filters.has("favorites")
                    ? "No saved courts yet"
                    : filters.size > 0
                      ? "No courts match these filters"
                      : "No courts in range"}
              </h2>
              <p className="mt-1.5 max-w-xs text-sm text-fg-muted">
                {outOfArea
                  ? "Upset City lists outdoor courts in the Austin area. You’re outside that zone, so nothing is shown as near you."
                  : "Widen the radius, clear a filter, or search an address."}
              </p>
              <div className="mt-4 flex gap-2">
                {filters.size > 0 || !areas.has("all") ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-full bg-court px-3.5 py-1.5 text-sm font-semibold text-white"
                  >
                    Clear filters
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="rounded-full bg-court px-3.5 py-1.5 text-sm font-semibold text-white"
                  >
                    Refresh
                  </button>
                )}
              </div>
            </div>
          ) : (
            filtered.map((court) => (
              <SelectedCourtPreview
                key={court.id}
                court={court}
                active={court.id === selected?.id}
                onQuickMatch={onQuickMatch}
                onActivate={() => selectCourt(court, "card")}
              />
            ))
          )}
        </div>
      </div>
      ) : null}

      <CourtAboutSheet
        court={aboutCourt}
        onClose={() => setAboutCourt(null)}
        onPlay={
          aboutCourt && onQuickMatch
            ? () => {
                const c = aboutCourt;
                setAboutCourt(null);
                onQuickMatch(c);
              }
            : undefined
        }
        userLat={origin.lat}
        userLon={origin.lon}
      />
    </div>
  );
}
