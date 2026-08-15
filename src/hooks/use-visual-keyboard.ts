import { useEffect, useState } from "react";

export type VisualKeyboard = {
  /** Pixels covered below the visual viewport (keyboard). 0 when closed. */
  inset: number;
  offsetTop: number;
  height: number;
  open: boolean;
};

/**
 * Track software keyboard via visualViewport (rAF-coalesced).
 * Do NOT CSS-transition properties driven by these values.
 */
export function useVisualKeyboard(threshold = 72): VisualKeyboard {
  const [state, setState] = useState<VisualKeyboard>(() => ({
    inset: 0,
    offsetTop: 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
    open: false,
  }));

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;

    const measure = () => {
      raf = 0;
      const inset = Math.max(
        0,
        Math.round(window.innerHeight - vv.height - vv.offsetTop),
      );
      setState((prev) => {
        const next = {
          inset,
          offsetTop: Math.round(vv.offsetTop),
          height: Math.round(vv.height),
          open: inset >= threshold,
        };
        if (
          prev.inset === next.inset &&
          prev.offsetTop === next.offsetTop &&
          prev.height === next.height &&
          prev.open === next.open
        ) {
          return prev;
        }
        return next;
      });
    };

    const sync = () => {
      if (raf) return;
      raf = requestAnimationFrame(measure);
    };

    measure();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [threshold]);

  return state;
}

/**
 * Pin element so its BOTTOM edge sits on the visual viewport bottom.
 * Element MUST be portaled to document.body (not inside transformed/filtered ancestors).
 * Uses `top` with no CSS transition — tracks keyboard 1:1.
 */
export function bindFixedBottomToVisualViewport(
  el: HTMLElement | null,
): () => void {
  if (!el) return () => {};
  const vv = window.visualViewport;

  el.style.position = "fixed";
  el.style.left = "0";
  el.style.right = "0";
  el.style.bottom = "auto";
  el.style.transform = "none";
  el.style.transition = "none";
  el.style.margin = "0";
  el.style.width = "100%";
  el.style.zIndex = "2147483000";
  el.style.willChange = "top";

  let raf = 0;
  const apply = () => {
    raf = 0;
    const h = el.offsetHeight || 0;
    if (vv) {
      // Bottom of visual viewport minus panel height
      const top = Math.round(vv.offsetTop + vv.height - h);
      el.style.top = `${Math.max(0, top)}px`;
    } else {
      el.style.top = "auto";
      el.style.bottom = "0px";
    }
  };
  const onChange = () => {
    if (raf) return;
    raf = requestAnimationFrame(apply);
  };

  apply();
  requestAnimationFrame(apply);
  // Keyboard animation fires multiple resizes — keep locked on
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onChange) : null;
  ro?.observe(el);
  vv?.addEventListener("resize", onChange);
  vv?.addEventListener("scroll", onChange);
  window.addEventListener("resize", onChange);
  // Extra passes while keyboard animates (~0.4s)
  const t1 = window.setTimeout(apply, 100);
  const t2 = window.setTimeout(apply, 250);
  const t3 = window.setTimeout(apply, 450);

  return () => {
    if (raf) cancelAnimationFrame(raf);
    window.clearTimeout(t1);
    window.clearTimeout(t2);
    window.clearTimeout(t3);
    ro?.disconnect();
    vv?.removeEventListener("resize", onChange);
    vv?.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
  };
}

/**
 * Pin a composer to the TOP of the visual viewport (always above keyboard).
 * Most reliable pattern when users must read what they type.
 */
export function bindFixedTopToVisualViewport(
  el: HTMLElement | null,
  margin = 8,
): () => void {
  if (!el) return () => {};
  const vv = window.visualViewport;

  el.style.position = "fixed";
  el.style.left = "0";
  el.style.right = "0";
  el.style.bottom = "auto";
  el.style.transform = "none";
  el.style.transition = "none";
  el.style.margin = "0";
  el.style.zIndex = "2147483000";
  el.style.maxHeight = vv ? `${Math.round(vv.height * 0.55)}px` : "55dvh";
  el.style.overflow = "auto";

  let raf = 0;
  const apply = () => {
    raf = 0;
    if (vv) {
      el.style.top = `${Math.round(vv.offsetTop + margin)}px`;
      el.style.maxHeight = `${Math.round(vv.height * 0.55)}px`;
    } else {
      el.style.top = `${margin}px`;
      el.style.maxHeight = "55dvh";
    }
  };
  const onChange = () => {
    if (raf) return;
    raf = requestAnimationFrame(apply);
  };

  apply();
  requestAnimationFrame(apply);
  vv?.addEventListener("resize", onChange);
  vv?.addEventListener("scroll", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    if (raf) cancelAnimationFrame(raf);
    vv?.removeEventListener("resize", onChange);
    vv?.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
  };
}

export function scrollFieldAboveKeyboard(
  el: HTMLElement | null | undefined,
  delayMs = 100,
) {
  if (!el) return;
  window.setTimeout(() => {
    try {
      el.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "auto",
      });
    } catch {
      el.scrollIntoView();
    }
  }, delayMs);
}
