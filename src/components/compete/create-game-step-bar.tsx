import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1 as const, label: "Court" },
  { n: 2 as const, label: "Details" },
  { n: 3 as const, label: "Review" },
];

export function CreateGameStepBar({
  step,
  onStep,
}: {
  step: 1 | 2 | 3;
  onStep: (n: 1 | 2 | 3) => void;
}) {
  return (
    <ol className="flex items-center gap-1" aria-label="Create game steps">
      {STEPS.map((s, i) => {
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
                "flex min-w-0 items-center gap-1.5 rounded-full px-2 py-1 text-left",
                current ? "bg-court/15" : "",
              )}
            >
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                  current || done
                    ? "bg-court text-white"
                    : "bg-bg-subtle text-fg-muted",
                )}
              >
                {s.n}
              </span>
              <span
                className={cn(
                  "truncate text-[11px] font-semibold",
                  current ? "text-fg" : "text-fg-muted",
                )}
              >
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 ? (
              <span className="h-px flex-1 bg-border" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
