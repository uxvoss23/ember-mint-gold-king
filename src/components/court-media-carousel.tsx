import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Pin = { lat: number; lon: number; color: string; label?: string };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function latLonToTile(lat: number, lon: number, zoom: number) {
  const n = 2 ** zoom;
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 -
      Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
      2) *
    n;
  return { x, y };
}

function zoomForPins(pins: Pin[]) {
  if (pins.length <= 1) return 15;
  const lats = pins.map((p) => p.lat);
  const lons = pins.map((p) => p.lon);
  const span = Math.max(
    Math.max(...lats) - Math.min(...lats),
    Math.max(...lons) - Math.min(...lons),
    0.008,
  );
  if (span < 0.012) return 15;
  if (span < 0.03) return 14;
  if (span < 0.07) return 13;
  if (span < 0.15) return 12;
  return 11;
}

/**
 * Carto-tile map slide — court + you + opponent pins.
 * Reliable in-browser (no blocked OSM staticmap).
 */
function ContextMapSlide({
  courtLat,
  courtLon,
  userLat,
  userLon,
  opponentLat,
  opponentLon,
}: {
  courtLat: number;
  courtLon: number;
  userLat?: number;
  userLon?: number;
  opponentLat?: number;
  opponentLon?: number;
}) {
  const pins = useMemo(() => {
    const list: Pin[] = [
      { lat: courtLat, lon: courtLon, color: "#f97316", label: "Court" },
    ];
    if (
      userLat != null &&
      userLon != null &&
      Number.isFinite(userLat) &&
      Number.isFinite(userLon)
    ) {
      list.push({ lat: userLat, lon: userLon, color: "#38bdf8", label: "You" });
    }
    if (
      opponentLat != null &&
      opponentLon != null &&
      Number.isFinite(opponentLat) &&
      Number.isFinite(opponentLon)
    ) {
      // skip if same as court
      if (
        Math.abs(opponentLat - courtLat) > 1e-5 ||
        Math.abs(opponentLon - courtLon) > 1e-5
      ) {
        list.push({
          lat: opponentLat,
          lon: opponentLon,
          color: "#f43f5e",
          label: "Them",
        });
      }
    }
    return list;
  }, [courtLat, courtLon, userLat, userLon, opponentLat, opponentLon]);

  const zoom = zoomForPins(pins);
  const center = useMemo(() => {
    // bias toward court
    const avgLat = pins.reduce((s, p) => s + p.lat, 0) / pins.length;
    const avgLon = pins.reduce((s, p) => s + p.lon, 0) / pins.length;
    return {
      lat: courtLat * 0.55 + avgLat * 0.45,
      lon: courtLon * 0.55 + avgLon * 0.45,
    };
  }, [pins, courtLat, courtLon]);

  const layout = useMemo(() => {
    const ct = latLonToTile(center.lat, center.lon, zoom);
    // 3x3 mosaic for fuller slide
    const baseX = Math.floor(ct.x) - 1;
    const baseY = Math.floor(ct.y) - 1;
    const fracX = ct.x - Math.floor(ct.x);
    const fracY = ct.y - Math.floor(ct.y);
    // center tile is (1,1) in 3x3; pin offset within full mosaic
    const pinPositions = pins.map((p) => {
      const t = latLonToTile(p.lat, p.lon, zoom);
      const px = (t.x - baseX) / 3;
      const py = (t.y - baseY) / 3;
      return {
        ...p,
        x: clamp(px, 0.04, 0.96),
        y: clamp(py, 0.04, 0.96),
      };
    });
    return { baseX, baseY, fracX, fracY, pinPositions };
  }, [center.lat, center.lon, zoom, pins]);

  return (
    <div className="relative h-full w-full bg-[#d4cfc4]">
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => {
            const tx = layout.baseX + col;
            const ty = layout.baseY + row;
            const host = ["a", "b", "c", "d"][Math.abs(tx + ty) % 4];
            const url = `https://${host}.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${tx}/${ty}.png`;
            return (
              <img
                key={`${tx}-${ty}`}
                src={url}
                alt=""
                className="h-full w-full object-cover"
                loading="eager"
                decoding="async"
                draggable={false}
              />
            );
          }),
        )}
      </div>

      {layout.pinPositions.map((p, i) => (
        <div
          key={`${p.label}-${i}`}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
        >
          <span
            className="block size-3 rounded-full border-2 border-white shadow-md sm:size-3.5"
            style={{ backgroundColor: p.color }}
          />
          {p.label ? (
            <span className="absolute top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/60 px-1 py-px text-[8px] font-bold text-white">
              {p.label}
            </span>
          ) : null}
        </div>
      ))}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 pb-1.5 pt-6">
        <p className="text-[10px] font-semibold text-white">
          Map · court
          {userLat != null ? " · you" : ""}
          {opponentLat != null ? " · them" : ""}
        </p>
      </div>
    </div>
  );
}

type Slide =
  | { kind: "photo"; src: string }
  | {
      kind: "map";
      courtLat: number;
      courtLon: number;
      userLat?: number;
      userLon?: number;
      opponentLat?: number;
      opponentLon?: number;
    };

/**
 * Court carousel: photo 1 → map (you/court/them) → more photos.
 */
export function CourtMediaCarousel({
  photos,
  courtLat,
  courtLon,
  userLat,
  userLon,
  opponentLat,
  opponentLon,
  alt = "",
  className,
  showControls = true,
}: {
  photos: string[];
  courtLat: number;
  courtLon: number;
  userLat?: number;
  userLon?: number;
  opponentLat?: number;
  opponentLon?: number;
  alt?: string;
  className?: string;
  showControls?: boolean;
}) {
  const slides: Slide[] = useMemo(() => {
    const out: Slide[] = [];
    if (photos[0]) out.push({ kind: "photo", src: photos[0] });
    out.push({
      kind: "map",
      courtLat,
      courtLon,
      userLat,
      userLon,
      opponentLat,
      opponentLon,
    });
    for (const src of photos.slice(1)) out.push({ kind: "photo", src });
    if (out.length === 1) {
      // map only if no photos
    }
    return out;
  }, [photos, courtLat, courtLon, userLat, userLon, opponentLat, opponentLon]);

  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const count = slides.length;

  const goTo = useCallback(
    (i: number) => {
      const next = ((i % count) + count) % count;
      setIndex(next);
      const el = scrollerRef.current;
      if (!el) return;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    },
    [count],
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const w = el.clientWidth || 1;
        const i = Math.round(el.scrollLeft / w);
        setIndex((prev) => (i !== prev && i >= 0 && i < count ? i : prev));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [count]);

  useEffect(() => {
    setIndex(0);
    scrollerRef.current?.scrollTo({ left: 0 });
  }, [photos[0], courtLat, courtLon]);

  if (count === 0) return null;

  return (
    <div
      className={cn(
        "group/carousel relative isolate overflow-hidden bg-bg-subtle",
        className,
      )}
    >
      <div
        ref={scrollerRef}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            className="relative h-full w-full shrink-0 snap-center snap-always"
          >
            {slide.kind === "photo" ? (
              <img
                src={slide.src}
                alt={alt}
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <ContextMapSlide
                courtLat={slide.courtLat}
                courtLon={slide.courtLon}
                userLat={slide.userLat}
                userLon={slide.userLon}
                opponentLat={slide.opponentLat}
                opponentLon={slide.opponentLon}
              />
            )}
          </div>
        ))}
      </div>

      {showControls && count > 1 ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goTo(index - 1);
            }}
            className="absolute top-1/2 left-1 z-20 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-80"
            aria-label="Previous"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goTo(index + 1);
            }}
            className="absolute top-1/2 right-1 z-20 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-80"
            aria-label="Next"
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="absolute bottom-1.5 left-1/2 z-20 flex -translate-x-1/2 gap-1">
            {slides.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(i);
                }}
                className={cn(
                  "h-1 rounded-full transition-all",
                  i === index ? "w-3 bg-white" : "w-1.5 bg-white/50",
                )}
                aria-label={
                  s.kind === "map" ? "Map" : `Photo ${i + 1}`
                }
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
