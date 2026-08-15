import { useRef, useState } from "react";
import { ChevronDown, ChevronLeft, SlidersHorizontal } from "lucide-react";
import {
  browseFilterActiveCount,
  DEFAULT_BROWSE_FILTERS,
  ETHNICITY_OPTIONS,
  GENDER_OPTIONS,
  type BrowseFilters,
  type GenderFilter,
} from "@/lib/upset/browse-filters";
import { cn, formatHeightInches } from "@/lib/utils";

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-tight transition",
        active
          ? "bg-fg text-bg shadow-sm"
          : "bg-bg-soft/80 text-fg-muted hover:bg-bg-soft hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function snap(n: number, min: number, max: number, step: number) {
  const s = Math.round((n - min) / step) * step + min;
  return Math.max(min, Math.min(max, s));
}

function DualRangeSlider({
  label,
  min,
  max,
  step,
  valueMin,
  valueMax,
  onChange,
  format,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  valueMin: number | null;
  valueMax: number | null;
  onChange: (lo: number | null, hi: number | null) => void;
  format: (n: number) => string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<"lo" | "hi" | null>(null);
  const lo = valueMin ?? min;
  const hi = valueMax ?? max;
  const span = max - min || 1;
  const leftPct = ((lo - min) / span) * 100;
  const rightPct = ((hi - min) / span) * 100;

  const commit = (nextLo: number, nextHi: number) => {
    let a = Math.min(nextLo, nextHi);
    let b = Math.max(nextLo, nextHi);
    a = snap(a, min, max, step);
    b = snap(b, min, max, step);
    if (a <= min && b >= max) onChange(null, null);
    else if (a <= min) onChange(null, b);
    else if (b >= max) onChange(a, null);
    else onChange(a, b);
  };

  const valueAt = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return snap(min + t * span, min, max, step);
  };

  const onPointerDown = (which: "lo" | "hi" | "track") =>
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const v = valueAt(e.clientX);
      const pick =
        which === "track"
          ? Math.abs(v - lo) <= Math.abs(v - hi)
            ? "lo"
            : "hi"
          : which;
      drag.current = pick;
      if (pick === "lo") commit(v, hi);
      else commit(lo, v);
    };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const v = valueAt(e.clientX);
    if (drag.current === "lo") commit(Math.min(v, hi), hi);
    else commit(lo, Math.max(v, lo));
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-medium text-fg-muted">{label}</span>
        <span className="text-[12px] font-semibold tabular-nums tracking-tight text-fg">
          {format(lo)} – {format(hi)}
        </span>
      </div>
      <div
        ref={trackRef}
        className="relative h-11 touch-none select-none"
        onPointerDown={onPointerDown("track")}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="pointer-events-none absolute top-1/2 right-1 left-1 h-1.5 -translate-y-1/2 rounded-full bg-white/[0.1]" />
        <div
          className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-court/80 to-court"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />
        <button
          type="button"
          aria-label={`${label} minimum`}
          className="absolute top-1/2 z-20 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/20 bg-gradient-to-b from-[#f0ece7] to-[#c9c4bc] shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
          style={{ left: `${leftPct}%` }}
          onPointerDown={onPointerDown("lo")}
        />
        <button
          type="button"
          aria-label={`${label} maximum`}
          className="absolute top-1/2 z-30 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/20 bg-gradient-to-b from-[#f0ece7] to-[#c9c4bc] shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
          style={{ left: `${rightPct}%` }}
          onPointerDown={onPointerDown("hi")}
        />
      </div>
    </div>
  );
}

function MaxMilesSlider({
  value,
  onChange,
  max = 25,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  max?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const shown = value ?? max;
  const pct = (shown / max) * 100;

  const apply = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const v = Math.max(1, Math.round(t * max));
    onChange(v >= max ? null : v);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-medium text-fg-muted">Distance</span>
        <span className="text-[12px] font-semibold tabular-nums tracking-tight text-fg">
          Within {shown} mi
        </span>
      </div>
      <div
        ref={trackRef}
        className="relative h-11 touch-none select-none"
        onPointerDown={(e) => {
          e.preventDefault();
          dragging.current = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          apply(e.clientX);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          apply(e.clientX);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        <div className="pointer-events-none absolute top-1/2 right-1 left-1 h-1.5 -translate-y-1/2 rounded-full bg-white/[0.1]" />
        <div
          className="pointer-events-none absolute top-1/2 left-1 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-court/80 to-court"
          style={{ width: `calc(${pct}% - 4px)` }}
        />
        <button
          type="button"
          aria-label="Max miles away"
          className="absolute top-1/2 z-20 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/20 bg-gradient-to-b from-[#f0ece7] to-[#c9c4bc] shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function PlayerBrowseFilters({
  value,
  onChange,
  className,
  saved = false,
  onSavedChange,
  onReset,
  iconOnly = false,
}: {
  value: BrowseFilters;
  onChange: (next: BrowseFilters) => void;
  className?: string;
  saved?: boolean;
  onSavedChange?: (saved: boolean) => void;
  onReset?: () => void;
  /** Header icon trigger — no full-width Filters bar */
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const active = browseFilterActiveCount(value);

  const set = (patch: Partial<BrowseFilters>) =>
    onChange({ ...value, ...patch });

  const toggleGender = (g: GenderFilter) => {
    const has = value.genders.includes(g);
    set({
      genders: has
        ? value.genders.filter((x) => x !== g)
        : [...value.genders, g],
    });
  };

  const toggleEth = (e: string) => {
    const has = value.ethnicities.includes(e);
    set({
      ethnicities: has
        ? value.ethnicities.filter((x) => x !== e)
        : [...value.ethnicities, e],
    });
  };

  return (
    <div
      className={cn(
        "relative overflow-visible",
        !iconOnly &&
          "rounded-2xl border border-white/[0.06] bg-bg-elevated/90 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]",
        className,
      )}
    >
      {iconOnly ? (
        <button
          type="button"
          aria-label={active > 0 ? `Filters, ${active} active` : "Filters"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="relative flex size-10 items-center justify-center rounded-full border border-border bg-bg-elevated"
        >
          <SlidersHorizontal className="size-4 text-fg" strokeWidth={1.75} />
          {active > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-court text-[9px] font-bold text-white">
              {active}
            </span>
          ) : null}
        </button>
      ) : (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-white/[0.02]"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-white/[0.06]">
          <SlidersHorizontal className="size-3.5 text-fg" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold tracking-tight text-fg">
            Filters
          </p>
          {!open ? (
            <p className="truncate text-[11px] text-fg-subtle">
              {active > 0
                ? `${active} active · tap to edit`
                : "Age, rating, height, distance…"}
            </p>
          ) : null}
        </div>
        {active > 0 ? (
          <span className="flex size-5 items-center justify-center rounded-full bg-court text-[10px] font-bold text-white">
            {active}
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            "size-4 text-fg-subtle transition duration-200",
            open && "rotate-180",
          )}
          strokeWidth={1.75}
        />
      </button>
      )}

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close filters"
            className="fixed inset-0 z-40 bg-black/45"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed inset-x-3 z-50 flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-bg-elevated shadow-2xl"
            style={{
              top: "max(5.5rem, env(safe-area-inset-top, 0px) + 4.5rem)",
              bottom: "calc(var(--uc-tab-h, 72px) + 10px)",
              maxHeight: "calc(100dvh - var(--uc-tab-h, 72px) - 6.5rem)",
            }}
          >
            <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.06] px-2 py-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex items-center gap-0.5 rounded-full px-2 py-2 text-[14px] font-semibold text-fg"
              >
                <ChevronLeft className="size-5" />
                Back
              </button>
              <p className="min-w-0 flex-1 pr-12 text-center text-[14px] font-semibold text-fg">
                Filters
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 pt-3.5 [-webkit-overflow-scrolling:touch]">
              <div className="space-y-4 pb-2">
                <DualRangeSlider
                  label="Age"
                  min={18}
                  max={55}
                  step={1}
                  valueMin={value.ageMin}
                  valueMax={value.ageMax}
                  onChange={(lo, hi) => set({ ageMin: lo, ageMax: hi })}
                  format={(n) => (n >= 55 ? "55+" : String(n))}
                />
                <DualRangeSlider
                  label="Rating"
                  min={1000}
                  max={2200}
                  step={25}
                  valueMin={value.ratingMin}
                  valueMax={value.ratingMax}
                  onChange={(lo, hi) => set({ ratingMin: lo, ratingMax: hi })}
                  format={(n) => String(n)}
                />
                <DualRangeSlider
                  label="Height"
                  min={60}
                  max={84}
                  step={1}
                  valueMin={value.heightMinIn}
                  valueMax={value.heightMaxIn}
                  onChange={(lo, hi) => set({ heightMinIn: lo, heightMaxIn: hi })}
                  format={(n) => formatHeightInches(n)}
                />
                <MaxMilesSlider
                  value={value.milesMax}
                  onChange={(v) => set({ milesMax: v })}
                  max={25}
                />
              </div>

              <div className="h-px bg-white/[0.05]" />

              <div className="space-y-2.5 py-3">
                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-fg-muted">
                    Gender
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {GENDER_OPTIONS.map((g) => (
                      <Chip
                        key={g.id}
                        active={value.genders.includes(g.id)}
                        onClick={() => toggleGender(g.id)}
                      >
                        {g.label}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-fg-muted">
                    Ethnicity
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ETHNICITY_OPTIONS.map((e) => (
                      <Chip
                        key={e}
                        active={value.ethnicities.includes(e)}
                        onClick={() => toggleEth(e)}
                      >
                        {e}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>

              <label className="mb-3 flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-bg-soft/60 px-3 py-2">
                <input
                  type="checkbox"
                  checked={saved}
                  onChange={(e) => onSavedChange?.(e.target.checked)}
                  className="size-3.5 accent-[var(--color-court)]"
                />
                <span className="min-w-0 flex-1 text-[11px] leading-snug text-fg-muted">
                  <span className="font-semibold text-fg">Save filters</span>
                  {" — "}
                  otherwise they reset after 24 hours
                </span>
              </label>
            </div>

            <div className="flex shrink-0 items-center gap-2 border-t border-white/[0.06] bg-bg-elevated px-3.5 py-2.5">
              <button
                type="button"
                onClick={() => {
                  if (onReset) onReset();
                  else onChange({ ...DEFAULT_BROWSE_FILTERS });
                }}
                disabled={active === 0 && !saved}
                className="flex-1 rounded-full py-2.5 text-[12px] font-medium text-fg-muted transition hover:text-fg disabled:opacity-40"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-[1.4] rounded-full bg-fg py-2.5 text-[12px] font-semibold text-bg shadow-sm transition active:scale-[0.98]"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
