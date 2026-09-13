import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Radio } from "lucide-react";
import {
  COURT_PLACEHOLDER,
  imagesForCourt,
  isPlaceholderPhoto,
  type CourtImageOverride,
} from "@/lib/courts/images";
import type { Court } from "@/lib/courts/types";
import { cn, formatDistance } from "@/lib/utils";

export type CourtsMapCarouselHandle = {
  scrollToId: (id: string, smooth?: boolean) => void;
};

export type CarouselCardMeta = {
  avg: number;
  reviews: number;
  favCount: number;
  live?: boolean;
};

type OverrideMap = Record<string, { photos?: CourtImageOverride | null }> | null;

type CourtsMapCarouselProps = {
  courts: Court[];
  selectedId: string | null;
  meta: Record<string, CarouselCardMeta>;
  overrides?: OverrideMap;
  ignoreRef: React.MutableRefObject<boolean>;
  onActiveChange: (court: Court) => void;
  onOpenDetails: (court: Court) => void;
};

function centeredCourtId(scroller: HTMLElement): string | null {
  const cards = scroller.querySelectorAll<HTMLElement>("[data-court-card]");
  if (cards.length === 0) return null;
  const mid = scroller.getBoundingClientRect().left + scroller.clientWidth / 2;
  let best: { id: string; dist: number } | null = null;
  for (const card of cards) {
    const id = card.dataset.courtId;
    if (!id) continue;
    const r = card.getBoundingClientRect();
    const dist = Math.abs((r.left + r.right) / 2 - mid);
    if (!best || dist < best.dist) best = { id, dist };
  }
  return best?.id ?? cards[0]?.dataset.courtId ?? null;
}

function scrollScrollerToId(
  scroller: HTMLElement,
  id: string,
  smooth: boolean,
) {
  const card = scroller.querySelector<HTMLElement>(`[data-court-id="${id}"]`);
  if (!card) return;
  const raw = card.offsetLeft - (scroller.clientWidth - card.offsetWidth) / 2;
  const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  const left = Math.max(0, Math.min(max, raw));
  if (Math.abs(scroller.scrollLeft - left) < 6) return;
  scroller.scrollTo({
    left,
    behavior: smooth ? "smooth" : "auto",
  });
}

const MapCarouselCard = memo(function MapCarouselCard({
  court,
  index,
  total,
  active,
  eager,
  meta,
  overrides,
}: {
  court: Court;
  index: number;
  total: number;
  active: boolean;
  eager: boolean;
  meta?: CarouselCardMeta;
  overrides: OverrideMap;
}) {
  const images = imagesForCourt(court.id, 1, overrides);
  const src = images[0] ?? COURT_PLACEHOLDER;
  const hasReal = !isPlaceholderPhoto(src);
  const distanceText = formatDistance(court.distanceMeters);
  const placeLine = [court.neighborhood, distanceText].filter(Boolean).join(" · ");

  return (
    <div
      data-court-card
      data-court-id={court.id}
      className="uc-map-carousel-item"
    >
      <div
        className={cn(
          "uc-preview-card uc-map-carousel-card w-full overflow-hidden rounded-2xl border bg-bg-elevated text-left shadow-card",
          active ? "border-court ring-2 ring-court/35" : "border-border",
        )}
        aria-label={
          active ? `${court.name}. View details` : `${court.name}`
        }
        aria-current={active ? "true" : undefined}
      >
        <div className="relative aspect-[2/1] w-full overflow-hidden bg-bg-subtle">
          {eager || active ? (
            <img
              src={src}
              alt=""
              draggable={false}
              className={cn(
                "absolute inset-0 h-full w-full",
                hasReal ? "object-cover" : "object-contain p-8 opacity-[0.16]",
              )}
              loading={active ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={active ? "high" : "low"}
            />
          ) : null}
          {meta?.live ? (
            <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-500/95 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
              <Radio className="size-2.5 animate-pulse" strokeWidth={2.5} />
              Hooping now
            </span>
          ) : null}
          <span className="absolute top-2 right-2 z-10 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/90">
            {index + 1} of {total}
          </span>
        </div>
        <div className="px-3 py-1">
          <h3 className="truncate font-display text-[15px] font-semibold leading-snug tracking-tight text-fg">
            {court.name}
          </h3>
          {placeLine ? (
            <p className="truncate text-[11px] text-fg-muted">{placeLine}</p>
          ) : null}
          <span className="mt-0.5 inline-flex items-center text-[11px] font-semibold text-court">
            View details
            <span aria-hidden className="ml-0.5">
              ›
            </span>
          </span>
        </div>
      </div>
    </div>
  );
});

export const CourtsMapCarousel = forwardRef<
  CourtsMapCarouselHandle,
  CourtsMapCarouselProps
>(function CourtsMapCarousel(
  {
    courts,
    selectedId,
    meta,
    overrides = null,
    ignoreRef,
    onActiveChange,
    onOpenDetails,
  },
  ref,
) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const centerRaf = useRef(0);
  const [visualId, setVisualId] = useState<string | null>(selectedId);
  const selectedIndex = useMemo(() => {
    const i = courts.findIndex((c) => c.id === (visualId ?? selectedId));
    return i < 0 ? 0 : i;
  }, [courts, visualId, selectedId]);
  const idsKey = useMemo(() => courts.map((c) => c.id).join(","), [courts]);
  const onActiveRef = useRef(onActiveChange);
  onActiveRef.current = onActiveChange;
  const onOpenRef = useRef(onOpenDetails);
  onOpenRef.current = onOpenDetails;
  const courtsRef = useRef(courts);
  courtsRef.current = courts;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const emittedRef = useRef<string | null>(selectedId);
  const touchingRef = useRef(false);
  const movedRef = useRef(false);
  const startXRef = useRef(0);

  const scrollToId = useCallback((id: string, smooth = true) => {
    const el = scrollerRef.current;
    if (!el) return;
    scrollScrollerToId(el, id, smooth);
  }, []);

  useImperativeHandle(ref, () => ({ scrollToId }), [scrollToId]);

  const emitCentered = useCallback((id: string) => {
    setVisualId(id);
    if (id === emittedRef.current) return;
    const court = courtsRef.current.find((c) => c.id === id);
    if (!court) return;
    emittedRef.current = id;
    onActiveRef.current(court);
  }, []);

  const syncCenter = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const id = centeredCourtId(el);
    if (id) emitCentered(id);
  }, [emitCentered]);

  const onScroll = useCallback(() => {
    if (centerRaf.current) return;
    centerRaf.current = requestAnimationFrame(() => {
      centerRaf.current = 0;
      syncCenter();
    });
  }, [syncCenter]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    touchingRef.current = true;
    movedRef.current = false;
    startXRef.current = e.clientX;
    ignoreRef.current = true;
  }, [ignoreRef]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!touchingRef.current) return;
    if (Math.abs(e.clientX - startXRef.current) > 7) movedRef.current = true;
  }, []);

  const onPointerUp = useCallback(() => {
    touchingRef.current = false;
    ignoreRef.current = false;
    syncCenter();
  }, [ignoreRef, syncCenter]);

  const onClickCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (movedRef.current) {
        e.preventDefault();
        e.stopPropagation();
        movedRef.current = false;
        return;
      }
      const card = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-court-card]",
      );
      const id = card?.dataset.courtId;
      if (!id) return;
      const court = courtsRef.current.find((c) => c.id === id);
      if (!court) return;
      emitCentered(id);
      onOpenRef.current(court);
    },
    [emitCentered],
  );

  useEffect(() => {
    return () => {
      if (centerRaf.current) cancelAnimationFrame(centerRaf.current);
    };
  }, []);

  const prevIdsKeyRef = useRef(idsKey);

  useLayoutEffect(() => {
    if (!selectedId) return;
    const el = scrollerRef.current;
    if (!el) return;
    const idsChanged = prevIdsKeyRef.current !== idsKey;
    prevIdsKeyRef.current = idsKey;
    if (selectedId === emittedRef.current && !idsChanged) return;
    if (centeredCourtId(el) === selectedId) {
      emittedRef.current = selectedId;
      setVisualId(selectedId);
      return;
    }
    if (!idsChanged && (touchingRef.current || ignoreRef.current)) return;
    emittedRef.current = selectedId;
    setVisualId(selectedId);
    scrollToId(selectedId, false);
  }, [idsKey, selectedId, ignoreRef, scrollToId]);

  useEffect(() => {
    const idx = selectedIndex;
    const neighbors = [courts[idx - 1], courts[idx + 1]];
    for (const c of neighbors) {
      if (!c) continue;
      const src = imagesForCourt(c.id, 1, overrides)[0];
      if (!src || isPlaceholderPhoto(src)) continue;
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    }
  }, [selectedIndex, courts, overrides]);

  if (courts.length === 0) return null;

  return (
    <div className="relative shrink-0 pb-1.5 pt-0" data-courts-scroll="carousel">
      <div
        ref={scrollerRef}
        className="uc-map-carousel"
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
      >
        {courts.map((court, i) => (
          <MapCarouselCard
            key={court.id}
            court={court}
            index={i}
            total={courts.length}
            active={court.id === visualId}
            eager={Math.abs(i - selectedIndex) <= 2}
            meta={meta[court.id]}
            overrides={overrides}
          />
        ))}
      </div>
    </div>
  );
});
