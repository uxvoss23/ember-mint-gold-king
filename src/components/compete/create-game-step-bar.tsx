import { cn } from "@/lib/utils";

const PICK_STEPS = [
  { n: 1 as const, label: "Details" },
  { n: 2 as const, label: "Court" },
  { n: 3 as const, label: "Overview" },
];

const PRESET_STEPS = [
  { n: 1 as const, label: "Details" },
  { n: 2 as const, label: "Overview" },
];

export function CreateGameStepBar({
  step,
  onStep,
  compact = false,
  courtLocked = false,
}: {
  step: 1 | 2 | 3;
  onStep: (n: 1 | 2 | 3) => void;
  compact?: boolean;
  courtLocked?: boolean;
}) {
  const steps = courtLocked ? PRESET_STEPS : PICK_STEPS;
  return (
    <ol className="flex items-center gap-1" aria-label="Create game steps">
      {steps.map((s, i) => {
        const done = step > s.n;
        const current = step === s.n;
        return (
          <li key={s.n} className="flex min-w-0 flex-1 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (s.n < step) onStep(s.n);
              }}
              disabled={s.n > step}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex min-w-0 items-center rounded-full text-left",
                compact ? "gap-1 px-1.5 py-0.5" : "gap-1.5 px-2 py-1",
                current ? "bg-court/15" : "",
              )}
            >
              <span
                className={cn(
                  "grid shrink-0 place-items-center rounded-full font-bold",
                  compact ? "size-4 text-[9px]" : "size-5 text-[10px]",
                  current || done
                    ? "bg-court text-white"
                    : "bg-bg-subtle text-fg-muted",
                )}
              >
                {s.n}
              </span>
              <span
                className={cn(
                  "truncate font-semibold",
                  compact ? "text-[10px]" : "text-[11px]",
                  current ? "text-fg" : "text-fg-muted",
                )}
              >
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 ? (
              <span className="h-px flex-1 bg-border" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
