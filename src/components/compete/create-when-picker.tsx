import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SoftTimeBand } from "@/lib/upset/hoop-now";
import { SOFT_TIME_BANDS } from "@/lib/upset/hoop-now";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
export function toLocalDateTimeValue(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
export function parseLocalDateTime(value: string): Date {
  const [datePart, timePart = "12:00"] = value.split("T");
  const [y, mo, da] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  return new Date(y, (mo || 1) - 1, da || 1, h || 0, mi || 0, 0, 0);
}
function sameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function hourToBand(h: number): SoftTimeBand {
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "late";
}

const TIME_SLOTS: { h: number; m: number; label: string }[] = (() => {
  const out: { h: number; m: number; label: string }[] = [];
  for (let h = 6; h <= 22; h++)
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) continue;
      const d = new Date();
      d.setHours(h, m, 0, 0);
      out.push({
        h,
        m,
        label: d.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        }),
      });
    }
  return out;
})();

export type CreateWhenGuide = {
  opponentName?: string;
  /** YYYY-MM-DD days they cannot play */
  blockedDates?: string[];
  /** Times of day they usually play */
  preferredBands?: SoftTimeBand[];
};

export function CreateWhenPicker({
  value,
  onChange,
  guide,
  roomy,
  variant = "default",
}: {
  value: string;
  onChange: (v: string) => void;
  guide?: CreateWhenGuide | null;
  /** Taller time-slot grid so more hours stay on screen */
  roomy?: boolean;
  /** Plan screen: always open, no legend, orange selected time */
  variant?: "default" | "plan";
}) {
  const isPlan = variant === "plan";
  const [open, setOpen] = useState(() => Boolean(guide) || isPlan);
  const [dayDraft, setDayDraft] = useState<Date | null>(null);
  const hasValue = Boolean(value);
  const selected = hasValue ? parseLocalDateTime(value) : null;
  const activeDay = selected ?? dayDraft;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        return d;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [today.getTime()],
  );

  const blocked = useMemo(
    () => new Set(guide?.blockedDates ?? []),
    [guide?.blockedDates],
  );
  const preferred = useMemo(
    () => new Set(guide?.preferredBands ?? []),
    [guide?.preferredBands],
  );
  const firstName = guide?.opponentName?.split(" ")[0] ?? "They";

  const blockedLabels = useMemo(() => {
    return (guide?.blockedDates ?? [])
      .slice()
      .sort()
      .map((key) => {
        const [y, m, d] = key.split("-").map(Number);
        const dt = new Date(y, (m || 1) - 1, d || 1);
        return dt.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
      });
  }, [guide?.blockedDates]);

  const preferredLabels = (guide?.preferredBands ?? [])
    .map((id) => SOFT_TIME_BANDS.find((b) => b.id === id)?.label ?? id)
    .filter(Boolean);

  const setDay = (day: Date) => {
    const key = dateKey(day);
    if (blocked.has(key)) return;
    if (selected) {
      const next = new Date(day);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      onChange(toLocalDateTimeValue(next));
    } else {
      const d = new Date(day);
      d.setHours(0, 0, 0, 0);
      setDayDraft(d);
    }
  };

  const setTime = (h: number, m: number) => {
    const base = activeDay ?? new Date();
    if (blocked.has(dateKey(base))) return;
    const next = new Date(base);
    next.setHours(h, m, 0, 0);
    onChange(toLocalDateTimeValue(next));
    setDayDraft(null);
    if (!isPlan) setOpen(false);
  };

  const dayShort =
    selected == null
      ? null
      : sameCalendarDay(selected, new Date())
        ? "Today"
        : selected.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
  const timeShort =
    selected == null
      ? null
      : selected.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        });

  // Fit check for current selection
  let fit: "good" | "blocked" | "offband" | "unknown" | null = null;
  if (selected) {
    const key = dateKey(selected);
    if (blocked.has(key)) fit = "blocked";
    else if (preferred.size === 0) fit = "unknown";
    else if (preferred.has(hourToBand(selected.getHours()))) fit = "good";
    else fit = "offband";
  }

  return (
    <div className="space-y-2.5">
      {isPlan ? (
        hasValue && dayShort && timeShort ? (
          <p className="text-[13px] font-semibold text-fg">
            {dayShort} · {timeShort}
            <span className="ml-1.5 text-court">✓</span>
          </p>
        ) : null
      ) : (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-wide text-fg-subtle uppercase">
            Tip-off
          </p>
          {hasValue && dayShort && timeShort ? (
            <p className="truncate text-sm font-semibold tabular-nums text-fg">
              {dayShort}
              <span className="mx-1.5 text-fg-subtle">·</span>
              {timeShort}
            </p>
          ) : (
            <p className="text-sm font-medium text-fg-muted">
              Choose day & time
            </p>
          )}
          {fit === "good" ? (
            <p className="mt-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              ✓ In {firstName}'s usual window
            </p>
          ) : fit === "blocked" ? (
            <p className="mt-0.5 text-[11px] font-semibold text-rose-600">
              They marked this day not available
            </p>
          ) : fit === "offband" ? (
            <p className="mt-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              Outside their usual free times
            </p>
          ) : null}
        </div>
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-fg-subtle transition-transform",
            open && "rotate-90",
          )}
        />
      </button>
      )}

      {open ? (
        <div
          className={cn(
            "space-y-2.5",
            !isPlan && "rounded-xl border border-border bg-bg p-2",
          )}
        >
          <div className="-mx-0.5 flex gap-1 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {days.map((d) => {
              const key = dateKey(d);
              const isBlocked = blocked.has(key);
              const isSel = activeDay ? sameCalendarDay(d, activeDay) : false;
              const isToday = sameCalendarDay(d, new Date());
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  disabled={isBlocked}
                  onClick={() => setDay(d)}
                  title={
                    isBlocked
                      ? `${firstName} not available`
                      : d.toLocaleDateString()
                  }
                  className={cn(
                    "relative flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl border",
                    isBlocked
                      ? "cursor-not-allowed border-rose-500/40 bg-rose-500/10 text-rose-700/80 opacity-90 dark:text-rose-300"
                      : isSel
                        ? "border-court bg-court text-white"
                        : "border-border bg-bg-elevated text-fg",
                  )}
                >
                  <span
                    className={cn(
                      "text-[8px] font-bold uppercase leading-none",
                      isBlocked
                        ? "text-rose-600 dark:text-rose-400"
                        : isSel
                          ? "text-white/80"
                          : "text-fg-subtle",
                    )}
                  >
                    {isToday
                      ? "Now"
                      : d.toLocaleDateString(undefined, { weekday: "short" })}
                  </span>
                  <span className="mt-0.5 text-sm font-bold tabular-nums leading-none">
                    {d.getDate()}
                  </span>
                  {isBlocked ? (
                    <span className="mt-0.5 text-[7px] font-black tracking-wide text-rose-600 uppercase dark:text-rose-400">
                      Off
                    </span>
                  ) : preferred.size > 0 ? (
                    <span
                      className={cn(
                        "mt-0.5 size-1 rounded-full",
                        isSel ? "bg-white/80" : "bg-emerald-500",
                      )}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          {guide ? (
            <div className="space-y-0.5">
              {preferredLabels.length > 0 ? (
                <p className="text-[12px] leading-snug text-fg-muted">
                  <span className="font-semibold text-fg">
                    {firstName} is usually free
                  </span>
                  {activeDay
                    ? ` ${activeDay.toLocaleDateString(undefined, { weekday: "long" })}`
                    : ""}
                  <span className="block text-fg-muted">
                    {preferredLabels.join(" · ")}
                  </span>
                </p>
              ) : (
                <p className="text-[12px] text-fg-muted">
                  {firstName} hasn’t set usual free times.
                </p>
              )}
              {!isPlan ? (
                <p className="text-[10px] text-fg-subtle">
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    Red days
                  </span>{" "}
                  = not available · green times = best chance they accept
                </p>
              ) : null}
            </div>
          ) : null}

          {isPlan ? (
            <p className="text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">
              Suggested times
            </p>
          ) : null}

          <div
            className={cn(
              "grid gap-1.5 overflow-y-auto overscroll-contain pr-0.5",
              isPlan
                ? "grid-cols-2 max-h-[min(32dvh,240px)]"
                : roomy
                  ? "grid-cols-4 max-h-[min(38dvh,280px)]"
                  : "grid-cols-4 max-h-36",
            )}
          >
            {TIME_SLOTS.filter((slot) => {
              const day = activeDay ?? new Date();
              if (sameCalendarDay(day, new Date())) {
                const now = new Date();
                if (slot.h * 60 + slot.m <= now.getHours() * 60 + now.getMinutes())
                  return false;
              }
              if (isPlan) {
                if (preferred.size > 0) return preferred.has(hourToBand(slot.h));
                return slot.h >= 16 && slot.h <= 21;
              }
              return true;
            }).map((slot) => {
              const active =
                selected != null &&
                selected.getHours() === slot.h &&
                selected.getMinutes() === slot.m;
              const band = hourToBand(slot.h);
              const inPref = preferred.size === 0 || preferred.has(band);
              const dayBlocked = activeDay
                ? blocked.has(dateKey(activeDay))
                : false;
              return (
                <button
                  key={`${slot.h}-${slot.m}`}
                  type="button"
                  disabled={dayBlocked}
                  onClick={() => setTime(slot.h, slot.m)}
                  className={cn(
                    "relative rounded-lg border font-semibold tabular-nums",
                    isPlan ? "h-11 text-[13px]" : "h-9 text-[11px]",
                    dayBlocked
                      ? "cursor-not-allowed border-border bg-bg-subtle text-fg-subtle opacity-40"
                      : active
                        ? "border-court bg-court text-white"
                        : inPref
                          ? "border-emerald-500/45 bg-emerald-500/12 text-fg"
                          : "border-border bg-bg-elevated text-fg-muted opacity-70",
                  )}
                >
                  {slot.label}
                  {inPref && !active && !dayBlocked ? (
                    <span className="absolute top-0.5 right-0.5 size-1 rounded-full bg-emerald-500" />
                  ) : null}
                </button>
              );
            })}
          </div>
          {!hasValue && !isPlan ? (
            <p className="text-center text-[10px] text-fg-subtle">
              Pick an open day, then a green time slot
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
