import { useState } from "react";
import { Bell, BellOff, ChevronLeft, MapPin } from "lucide-react";
import {
  PICKUP_RADIUS_OPTIONS,
  usePickupPrefs,
} from "@/lib/courts/pickup-prefs";
import { cn } from "@/lib/utils";

/**
 * Slide questionnaire (match-style): opt into nearby pickup alerts + radius.
 * Shown once until completed.
 */
export function PickupNotifyOnboarding({
  playerId,
  onDone,
}: {
  playerId: string;
  onDone?: () => void;
}) {
  const setPrefs = usePickupPrefs((s) => s.setPrefs);
  const existing = usePickupPrefs((s) => s.getPrefs(playerId));
  const [step, setStep] = useState(0);
  const [want, setWant] = useState(true);
  const [radius, setRadius] = useState(existing.radiusMi || 10);

  const finish = (notify: boolean, radiusMi: number) => {
    setPrefs(playerId, {
      completed: true,
      notify,
      radiusMi,
    });
    onDone?.();
  };

  return (
    <div className="mx-3 mb-2 overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-card">
      <div className="border-b border-border px-3 py-2.5">
        <p className="text-[10px] font-bold tracking-wide text-emerald-400 uppercase">
          Quick setup · {step + 1}/3
        </p>
        <p className="mt-0.5 font-display text-[15px] font-semibold text-fg">
          {step === 0 && "Pickup alerts"}
          {step === 1 && "Want the heads-up?"}
          {step === 2 && "How far should we look?"}
        </p>
      </div>

      <div className="space-y-3 p-3">
        {step === 0 ? (
          <>
            <p className="text-[13px] leading-relaxed text-fg-muted">
              When someone posts that pickup is live at a court near you, we
              can ping you once — so you can roll through or pass.
            </p>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex h-11 w-full items-center justify-center rounded-full bg-emerald-600 text-[13px] font-semibold text-white"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => finish(false, 10)}
              className="w-full text-center text-[12px] font-medium text-fg-subtle"
            >
              Not now
            </button>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <p className="text-[13px] leading-relaxed text-fg-muted">
              Get notified when there are pickup games near you?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setWant(true);
                  setStep(2);
                }}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-4 text-[13px] font-semibold active:scale-[0.98]",
                  "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
                )}
              >
                <Bell className="size-5" />
                Yes, notify me
              </button>
              <button
                type="button"
                onClick={() => finish(false, radius)}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-bg-soft px-3 py-4 text-[13px] font-semibold text-fg active:scale-[0.98]"
              >
                <BellOff className="size-5 text-fg-muted" />
                No thanks
              </button>
            </div>
            <button
              type="button"
              onClick={() => setStep(0)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-fg-subtle"
            >
              <ChevronLeft className="size-3.5" />
              Back
            </button>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <p className="text-[13px] leading-relaxed text-fg-muted">
              Only courts within this distance of your area. One alert per
              court — we won’t spam you.
            </p>
            <div className="flex items-center justify-center gap-2 py-2">
              <MapPin className="size-4 text-emerald-400" />
              <span className="font-display text-3xl font-semibold tabular-nums text-fg">
                {radius}
              </span>
              <span className="text-sm font-medium text-fg-muted">miles</span>
            </div>
            <input
              type="range"
              min={0}
              max={PICKUP_RADIUS_OPTIONS.length - 1}
              value={Math.max(
                0,
                PICKUP_RADIUS_OPTIONS.indexOf(
                  radius as (typeof PICKUP_RADIUS_OPTIONS)[number],
                ),
              )}
              onChange={(e) => {
                const i = Number(e.target.value);
                setRadius(PICKUP_RADIUS_OPTIONS[i] ?? 10);
              }}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-fg-subtle">
              <span>1 mi</span>
              <span>25 mi</span>
            </div>
            <button
              type="button"
              onClick={() => finish(want, radius)}
              className="flex h-11 w-full items-center justify-center rounded-full bg-emerald-600 text-[13px] font-semibold text-white"
            >
              Save · notify within {radius} mi
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-fg-subtle"
            >
              <ChevronLeft className="size-3.5" />
              Back
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
