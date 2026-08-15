import { LocateFixed, MapPinned } from "lucide-react";
import { CITY_PRESETS } from "@/lib/courts/catalog";
import type { UserLocation } from "@/lib/courts/types";
import { cn } from "@/lib/utils";

interface LocationGateProps {
  onLocated: (loc: UserLocation) => void;
  onPickCity: (loc: UserLocation) => void;
  locating: boolean;
  error?: string | null;
  requestLocation: () => void;
}

export function LocationGate({
  onPickCity,
  locating,
  error,
  requestLocation,
}: LocationGateProps) {
  return (
    <div className="fade-in flex min-h-[70dvh] flex-col justify-between px-1 py-2">
      <div className="pt-6">
        <div className="mb-6 inline-flex size-14 items-center justify-center rounded-2xl border border-border bg-bg-elevated shadow-card">
          <MapPinned className="size-6 text-court" strokeWidth={1.5} />
        </div>
        <h1 className="font-display text-[2rem] leading-tight font-semibold tracking-tight text-fg text-balance">
          Outdoor courts in Austin
        </h1>
        <p className="mt-3 max-w-sm text-base leading-relaxed text-fg-muted">
          Public basketball courts across ATX — Zilker, Bartholomew, Circle C,
          and more. Use GPS for exact distance from you.
        </p>
      </div>

      <div className="space-y-6 pb-2">
        <button
          type="button"
          onClick={requestLocation}
          disabled={locating}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 text-[15px] font-semibold text-accent-fg transition-transform active:scale-[0.98] disabled:opacity-70"
          style={{ height: 52 }}
        >
          <LocateFixed className="size-5" strokeWidth={1.75} />
          {locating ? "Finding you…" : "Use my location"}
        </button>

        <button
          type="button"
          onClick={() =>
            onPickCity({
              lat: 30.2672,
              lon: -97.7431,
              label: "Austin, TX",
            })
          }
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border-strong bg-bg-elevated px-5 text-sm font-medium text-fg transition-colors hover:bg-bg-subtle"
          style={{ height: 48 }}
        >
          Browse Austin courts
        </button>

        {error && (
          <p className="text-center text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div>
          <p className="mb-3 text-xs font-medium tracking-wide text-fg-subtle uppercase">
            Or another city
          </p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {CITY_PRESETS.map((city) => {
              const isAustin = city.id === "atx";
              return (
                <button
                  key={city.id}
                  type="button"
                  onClick={() =>
                    onPickCity({
                      lat: city.lat,
                      lon: city.lon,
                      label: city.id === "atx" ? "Austin, TX" : city.label,
                    })
                  }
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors active:scale-[0.98]",
                    isAustin
                      ? "border-court/40 bg-court/15 text-fg"
                      : "border-border-strong bg-bg-elevated text-fg hover:bg-bg-subtle",
                  )}
                >
                  {city.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
