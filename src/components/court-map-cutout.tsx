import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Navigation, X } from "lucide-react";
import { directionsUrl } from "@/lib/maps/directions";
import { cn } from "@/lib/utils";

const AUSTIN = { lat: 30.2672, lon: -97.7431 };

/**
 * Small city-map cutout on court photos. Tap expands to full map.
 */
export function CourtMapCutout({
  lat,
  lon,
  name,
  address,
  className,
  size = 56,
  zoom = 12,
}: {
  lat: number;
  lon: number;
  name?: string;
  address?: string;
  neighborhood?: string;
  className?: string;
  size?: number;
  zoom?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const focus = useMemo(() => {
    const t = 0.25;
    return {
      lat: lat * (1 - t) + AUSTIN.lat * t,
      lon: lon * (1 - t) + AUSTIN.lon * t,
    };
  }, [lat, lon]);
  const layout = useMemo(
    () => tileMosaic(focus.lat, focus.lon, zoom, lat, lon),
    [focus.lat, focus.lon, zoom, lat, lon],
  );
  const labelId = useId();

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(true);
        }}
        className={cn(
          "relative block overflow-hidden rounded-lg border border-white/40 bg-bg-subtle shadow-sm ring-1 ring-black/15 transition-transform active:scale-[0.98]",
          className,
        )}
        style={{ width: size, height: size }}
        aria-label={
          name ? `Open Austin map of ${name}` : "Open full Austin map of this court"
        }
        aria-expanded={expanded}
        aria-controls={labelId}
      >
        <div
          className="absolute"
          style={{
            width: size * 2,
            height: size * 2,
            left: -layout.offsetX * size,
            top: -layout.offsetY * size,
          }}
        >
          {[0, 1].map((row) =>
            [0, 1].map((col) => {
              const tx = layout.baseX + col;
              const ty = layout.baseY + row;
              const host = ["a", "b", "c", "d"][(tx + ty) % 4];
              const url = `https://${host}.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${tx}/${ty}.png`;
              return (
                <img
                  key={`${tx}-${ty}`}
                  src={url}
                  alt=""
                  width={size}
                  height={size}
                  className="absolute object-cover"
                  style={{
                    left: col * size,
                    top: row * size,
                    width: size,
                    height: size,
                  }}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              );
            }),
          )}
        </div>
        <div
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${layout.pinX * 100}%`,
            top: `${layout.pinY * 100}%`,
          }}
        >
          <span className="block size-2.5 rounded-full border-2 border-white bg-court shadow-sm" />
        </div>
      </button>

      {expanded &&
        typeof document !== "undefined" &&
        createPortal(
          <CourtMapExpand
            id={labelId}
            lat={lat}
            lon={lon}
            name={name}
            address={address}
            onClose={() => setExpanded(false)}
          />,
          document.body,
        )}
    </>
  );
}

function CourtMapExpand({
  id,
  lat,
  lon,
  name,
  address,
  onClose,
}: {
  id: string;
  lat: number;
  lon: number;
  name?: string;
  address?: string;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let map: import("maplibre-gl").Map | null = null;
    let ro: ResizeObserver | null = null;

    (async () => {
      try {
        if (!containerRef.current || mapRef.current) return;
        const maplibregl = await import("maplibre-gl");
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled || !containerRef.current) return;

        map = new maplibregl.Map({
          container: containerRef.current,
          style: {
            version: 8,
            sources: {
              carto: {
                type: "raster",
                tiles: [
                  "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
                  "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
                ],
                tileSize: 256,
                attribution: "© OSM © CARTO",
              },
            },
            layers: [
              {
                id: "bg",
                type: "background",
                paint: { "background-color": "#d4cfc4" },
              },
              { id: "carto", type: "raster", source: "carto" },
            ],
          },
          center: [lon, lat],
          zoom: 13.5,
          attributionControl: { compact: true },
        });

        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          "top-right",
        );

        const pin = document.createElement("div");
        pin.innerHTML =
          '<div style="width:16px;height:16px;border-radius:999px;background:#c45c26;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>';
        new maplibregl.Marker({ element: pin, anchor: "center" })
          .setLngLat([lon, lat])
          .addTo(map);

        mapRef.current = map;

        const finish = () => {
          if (cancelled || !map) return;
          setReady(true);
          map.resize();
          map.jumpTo({ center: [lon, lat], zoom: 14.2 });
        };
        if (map.loaded()) finish();
        else map.once("load", finish);
        map.on("error", () => {
          if (!cancelled) setFailed(true);
        });

        ro = new ResizeObserver(() => map?.resize());
        ro.observe(containerRef.current);
        window.setTimeout(() => map?.resize(), 120);
        window.setTimeout(() => map?.resize(), 400);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, [lat, lon]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const routeUrl = directionsUrl(lat, lon, name ?? address);

  return (
    <div
      id={id}
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={name ? `Map of ${name}` : "Court map"}
    >
      <button
        type="button"
        className="absolute inset-0 bg-bg/80 backdrop-blur-sm fade-in"
        aria-label="Close map"
        onClick={onClose}
      />
      <div
        className="slide-up relative z-10 flex h-[min(90dvh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-bg-elevated shadow-soft sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-court uppercase">
              Austin, TX
            </p>
            <p className="truncate font-display text-base font-semibold text-fg">
              {name ?? "Court"}
            </p>
            {address && (
              <a
                href={routeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 flex items-start gap-1 text-xs text-court underline-offset-2 hover:underline"
              >
                <ExternalLink className="mt-0.5 size-3 shrink-0" />
                <span className="line-clamp-2">{address}</span>
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-bg-subtle text-fg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="relative min-h-0 w-full flex-1 overflow-hidden bg-[#d4cfc4]">
          <div
            ref={containerRef}
            className="absolute inset-0 h-full w-full"
            style={{ minHeight: 240 }}
          />
          {!ready && !failed && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-9 w-9 animate-pulse rounded-full bg-bg/40" />
            </div>
          )}
          {failed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm text-fg-muted">Map couldn’t load.</p>
              <a
                href={routeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-court underline"
              >
                Open in Maps instead
              </a>
            </div>
          )}
        </div>

        <div className="relative z-20 shrink-0 border-t border-border bg-bg-elevated p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <a
            href={routeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-court text-sm font-semibold text-white shadow-sm"
          >
            <Navigation className="size-4" strokeWidth={2.25} />
            Get directions
          </a>
        </div>
      </div>
    </div>
  );
}

function tileMosaic(
  focusLat: number,
  focusLon: number,
  zoom: number,
  courtLat: number,
  courtLon: number,
) {
  const n = 2 ** zoom;
  const toXY = (la: number, lo: number) => {
    const xFloat = ((lo + 180) / 360) * n;
    const latRad = (la * Math.PI) / 180;
    const yFloat =
      ((1 -
        Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
        2) *
      n;
    return { xFloat, yFloat };
  };

  const focus = toXY(focusLat, focusLon);
  const court = toXY(courtLat, courtLon);
  const baseX = Math.floor(focus.xFloat - 0.5);
  const baseY = Math.floor(focus.yFloat - 0.5);
  const fracX = focus.xFloat - baseX;
  const fracY = focus.yFloat - baseY;
  const offsetX = Math.min(1, Math.max(0, fracX - 0.5));
  const offsetY = Math.min(1, Math.max(0, fracY - 0.5));
  const pinX = Math.min(
    0.92,
    Math.max(0.08, court.xFloat - baseX - offsetX),
  );
  const pinY = Math.min(
    0.88,
    Math.max(0.12, court.yFloat - baseY - offsetY),
  );

  return {
    baseX: Math.max(0, baseX),
    baseY: Math.max(0, baseY),
    offsetX,
    offsetY,
    pinX,
    pinY,
  };
}
