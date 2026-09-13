import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPlaceholderPhoto } from "@/lib/courts/images";

interface ImageCarouselProps {
  images: string[];
  alt?: string;
  className?: string;
  priority?: boolean;
  showControls?: boolean;
  /** Shorter frame so CTAs fit above the fold on court select */
  compact?: boolean;
  /** Tap the photo to open a near-full-screen viewer */
  allowFullscreen?: boolean;
  /** Fill a parent with an explicit height instead of using aspect padding */
  fill?: boolean;
}

/**
 * Court photos inside a vertical list:
 * - Vertical drag → list scrolls (never sticks on the image)
 * - Horizontal drag → photos follow finger L/R, then snap
 * - Arrows + dots always work
 */
export function ImageCarousel({
  images,
  alt = "",
  className,
  priority,
  showControls = true,
  compact = false,
  allowFullscreen = false,
  fill = false,
}: ImageCarouselProps) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const indexRef = useRef(0);
  indexRef.current = index;
  const count = images.length;
  const widthRef = useRef(0);
  const allowFsRef = useRef(allowFullscreen);
  allowFsRef.current = allowFullscreen;
  const openFsRef = useRef(() => {});
  openFsRef.current = () => setFullscreen(true);

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    widthRef.current = el?.clientWidth || 0;
    return widthRef.current;
  }, []);

  const goTo = useCallback(
    (i: number, animate: boolean) => {
      const next = ((i % count) + count) % count;
      const w = measure() || 1;
      const track = trackRef.current;
      if (track) {
        track.style.transition = animate
          ? "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)"
          : "none";
        track.style.transform = `translate3d(${-next * w}px,0,0)`;
      }
      setIndex(next);
      indexRef.current = next;
    },
    [count, measure],
  );

  const go = useCallback(
    (dir: -1 | 1) => {
      goTo(indexRef.current + dir, true);
    },
    [goTo],
  );

  // Keep width + position correct on resize / image set change
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const sync = () => {
      measure();
      goTo(indexRef.current, false);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [count, goTo, measure]);

  useEffect(() => {
    setIndex(0);
    indexRef.current = 0;
    goTo(0, false);
  }, [images.join("|"), goTo]);

  /**
   * Axis lock:
   * vertical → abandon, list scrolls natively (touch-action pan-y)
   * horizontal → transform follows finger; release snaps to photo
   *
   * Direction: finger left → next photo; finger right → previous
   * (content follows finger — not inverted)
   */
  useEffect(() => {
    const el = scrollerRef.current;
    const track = trackRef.current;
    if (!el || !track || count <= 1) return;

    let active = false;
    let axis: null | "x" | "y" = null;
    let startX = 0;
    let startY = 0;
    let startIndex = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0; // px / ms, + = finger moving right
    let pointerId: number | null = null;
    let dragging = false;

    const wOf = () => measure() || el.clientWidth || 1;

    const paint = (i: number, offsetPx: number, animate: boolean) => {
      const w = wOf();
      track.style.transition = animate
        ? "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)"
        : "none";
      // offsetPx: positive = finger moved right → content shifts right → show prev
      track.style.transform = `translate3d(${-(i * w) + offsetPx}px,0,0)`;
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("button")) return;
      active = true;
      axis = null;
      dragging = false;
      startX = e.clientX;
      startY = e.clientY;
      lastX = e.clientX;
      lastT = performance.now();
      velocity = 0;
      startIndex = indexRef.current;
      pointerId = e.pointerId;
      measure();
    };

    const onMove = (e: PointerEvent) => {
      if (!active || pointerId !== e.pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      velocity = velocity * 0.6 + ((e.clientX - lastX) / dt) * 0.4;
      lastX = e.clientX;
      lastT = now;

      if (!axis) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        // Prefer vertical → list wins, no capture
        if (Math.abs(dy) >= Math.abs(dx) * 0.85) {
          axis = "y";
          active = false;
          pointerId = null;
          return;
        }
        if (Math.abs(dx) > Math.abs(dy) * 1.1) {
          axis = "x";
          dragging = true;
          try {
            el.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        } else {
          return;
        }
      }

      if (axis !== "x") return;
      e.preventDefault();
      // Rubber-band at ends
      const w = wOf();
      let offset = dx;
      if (startIndex === 0 && offset > 0) offset *= 0.35;
      if (startIndex >= count - 1 && offset < 0) offset *= 0.35;
      paint(startIndex, offset, false);
    };

    const onUp = (e: PointerEvent) => {
      if (pointerId != null && e.pointerId !== pointerId) return;
      if (axis === "x" && dragging) {
        const dx = e.clientX - startX;
        const w = wOf();
        const threshold = Math.min(56, w * 0.18);
        // velocity: + finger right, - finger left
        let next = startIndex;
        if (dx < -threshold || velocity < -0.45) {
          next = startIndex + 1; // swipe left → next
        } else if (dx > threshold || velocity > 0.45) {
          next = startIndex - 1; // swipe right → previous
        }
        next = Math.max(0, Math.min(count - 1, next));
        goTo(next, true);
      } else if (allowFsRef.current && !dragging) {
        const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
        if (dist < 12) openFsRef.current();
      }
      active = false;
      axis = null;
      dragging = false;
      pointerId = null;
    };

    el.addEventListener("pointerdown", onDown, { passive: true });
    el.addEventListener("pointermove", onMove, { passive: false });
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [count, goTo, measure]);

  if (count === 0) return null;

  const allQuiet = images.every((src) => isPlaceholderPhoto(src));

  return (
    <div
      className={cn(
        "group/carousel relative w-full overflow-hidden",
        allQuiet ? "bg-bg-subtle" : "bg-black",
        fill ? "h-full" : "w-full",
        className,
      )}
    >
      <div
        className={cn("relative w-full", fill && "h-full")}
        style={
          fill
            ? undefined
            : { paddingBottom: allQuiet ? "34%" : compact ? "54%" : "62.5%" }
        }
      >
        <div
          ref={scrollerRef}
          className="absolute inset-0 overflow-hidden touch-pan-y"
          onClick={() => {
            if (allowFullscreen && count <= 1) setFullscreen(true);
          }}
          style={{
            // Vertical list scroll always works from the photo
            touchAction: "pan-y",
            WebkitUserSelect: "none",
            userSelect: "none",
          }}
        >
          <div
            ref={trackRef}
            className="flex h-full will-change-transform"
            style={{
              width: `${count * 100}%`,
              transform: `translate3d(0,0,0)`,
            }}
          >
            {images.map((src, i) => (
              <div
                key={`${src}-${i}`}
                className="relative h-full shrink-0"
                style={{ width: `${100 / count}%` }}
              >
                <img
                  src={Math.abs(i - index) <= 1 ? src : undefined}
                  alt={i === 0 ? alt : ""}
                  draggable={false}
                  className={cn(
                    "pointer-events-none block h-full w-full select-none",
                    fill && allQuiet
                      ? "object-contain p-12 opacity-[0.16]"
                      : "object-cover object-center",
                  )}
                  loading={priority && i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={priority && i === 0 ? "high" : "low"}
                />
                {isPlaceholderPhoto(src) && !allQuiet ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pb-3 pt-8">
                    <p className="text-center text-[11px] font-semibold tracking-wide text-white/90">
                      No verified photo of this court
                    </p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {count > 1 ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-7 bg-gradient-to-t from-black/35 to-transparent" />
          <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Photo ${i + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(i, true);
                }}
                className={cn(
                  "size-1.5 rounded-full transition-all",
                  i === index ? "w-3 bg-white" : "bg-white/45",
                )}
              />
            ))}
          </div>
          {showControls ? (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                className="absolute top-1/2 left-0 z-20 flex h-11 w-7 -translate-y-1/2 items-center justify-start rounded-r-full bg-black/30 pl-0.5 text-white/90"
              >
                <ChevronLeft className="size-4" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                className="absolute top-1/2 right-0 z-20 flex h-11 w-7 -translate-y-1/2 items-center justify-end rounded-l-full bg-black/30 pr-0.5 text-white/90"
              >
                <ChevronRight className="size-4" strokeWidth={2.5} />
              </button>
            </>
          ) : null}
        </>
      ) : null}
      {allowFullscreen ? (
        <button
          type="button"
          aria-label="View full photo"
          onClick={(e) => {
            e.stopPropagation();
            setFullscreen(true);
          }}
          className="absolute top-2 left-2 z-20 rounded-full bg-black/45 p-1.5 text-white"
        >
          <Maximize2 className="size-3.5" strokeWidth={2.25} />
        </button>
      ) : null}
      {fullscreen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[600] flex flex-col bg-black"
              role="dialog"
              aria-modal="true"
              aria-label={alt || "Court photo"}
            >
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-10 flex size-10 items-center justify-center rounded-full bg-white/15 text-white"
                aria-label="Close photo"
              >
                <X className="size-5" strokeWidth={2.25} />
              </button>
              <div className="flex min-h-0 flex-1 items-center justify-center px-2">
                <img
                  src={images[index]}
                  alt={alt}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              {count > 1 ? (
                <>
                  <button
                    type="button"
                    aria-label="Previous photo"
                    onClick={() => go(-1)}
                    className="absolute top-1/2 left-1 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white"
                  >
                    <ChevronLeft className="size-6" strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next photo"
                    onClick={() => go(1)}
                    className="absolute top-1/2 right-1 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white"
                  >
                    <ChevronRight className="size-6" strokeWidth={2.5} />
                  </button>
                  <p className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-0 right-0 text-center text-[12px] font-medium tabular-nums text-white/80">
                    {index + 1} / {count}
                  </p>
                </>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
