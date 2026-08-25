import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Full-screen brand boot — rendered IN TREE (not portaled) so SSR/first
 * HTML paint covers rankings until the app is ready. Fully opaque until
 * unmount; no fade that flashes content without tabs.
 */
export function BootSplash({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  useEffect(() => {
    if (active) {
      document.documentElement.setAttribute("data-uc-booting", "1");
      document.documentElement.style.setProperty("--uc-tab-h", "0px");
    } else {
      document.documentElement.removeAttribute("data-uc-booting");
    }
  }, [active]);

  if (!active) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[2147483646] flex flex-col items-center justify-center bg-[#0c0c0d] px-6",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label="Loading Upset City"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% 42%, color-mix(in oklab, #c45c26 22%, transparent), transparent 70%)",
        }}
      />

      <div className="relative flex flex-col items-center text-center">
        <div className="uc-boot-mark relative mb-7 flex size-[5.5rem] items-center justify-center">
          <div className="uc-boot-ring absolute inset-0 rounded-full border border-court/35" />
          <div className="uc-boot-ring-2 absolute inset-[-6px] rounded-full border border-court/15" />
          <div className="relative flex size-[4.25rem] items-center justify-center rounded-full bg-gradient-to-b from-[#e0783a] to-[#c45c26] shadow-[0_12px_40px_rgba(196,92,38,0.45)]">
            <svg
              viewBox="0 0 64 64"
              className="size-10 text-white/95"
              aria-hidden
            >
              <circle
                cx="32"
                cy="32"
                r="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              />
              <path
                d="M32 10v44M10 32h44"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M18 16c8 6 20 6 28 0M18 48c8-6 20-6 28 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>

        <p className="font-display text-[13px] font-semibold tracking-[0.28em] text-court uppercase">
          Upset City
        </p>
        <h1 className="font-display mt-2 max-w-[16rem] text-[1.65rem] font-semibold leading-[1.15] tracking-tight text-fg sm:text-[1.85rem]">
          Where the best
          <br />
          hoopers emerge
        </h1>

        <div className="mt-10 w-40">
          <div className="h-[3px] overflow-hidden rounded-full bg-white/10">
            <div className="uc-boot-bar h-full rounded-full bg-court" />
          </div>
          <p className="mt-3 text-[11px] font-medium tracking-wide text-fg-subtle">
            Loading Austin…
          </p>
        </div>
      </div>
    </div>
  );
}

/** One-shot boot gate. Once dismissed, never re-shows this page lifetime. */
export function useBootSplash(
  ready: boolean,
  opts?: { minMs?: number; maxMs?: number },
) {
  const minMs = opts?.minMs ?? 1600;
  const maxMs = opts?.maxMs ?? 3500;
  const [active, setActive] = useState(true);
  const startRef = useRef(
    typeof performance !== "undefined" ? performance.now() : Date.now(),
  );
  const finishedRef = useRef(false);

  useEffect(() => {
    if (finishedRef.current) return;

    const finish = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setActive(false);
    };

    const maxT = window.setTimeout(finish, maxMs);
    let minT: number | null = null;

    if (ready) {
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const elapsed = now - startRef.current;
      const wait = Math.max(0, minMs - elapsed);
      minT = window.setTimeout(finish, wait);
    }

    return () => {
      window.clearTimeout(maxT);
      if (minT != null) window.clearTimeout(minT);
    };
  }, [ready, minMs, maxMs]);

  return active;
}
