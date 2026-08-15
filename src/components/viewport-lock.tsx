import { useLayoutEffect } from "react";

/**
 * Strips stale inline pixel heights on .app-shell / html / body.
 * Never writes height from innerHeight or visualViewport.
 * Shell sizing is CSS-only (fixed + inset + 100dvh).
 */
export function ViewportLock() {
  useLayoutEffect(() => {
    let raf = 0;

    const pin = () => {
      // Root lock first — do not wait for .app-shell (splash can paint first)
      for (const node of [document.documentElement, document.body]) {
        node.style.removeProperty("height");
        node.style.removeProperty("max-height");
        node.style.removeProperty("position");
        node.style.removeProperty("inset");
        node.style.removeProperty("top");
        node.style.removeProperty("right");
        node.style.removeProperty("bottom");
        node.style.removeProperty("left");
        node.style.overflow = "hidden";
      }
      try {
        window.scrollTo(0, 0);
      } catch {
        /* ignore */
      }

      const el = document.querySelector<HTMLElement>(".app-shell");
      if (!el) return;

      // Strip leftover pixel heights only — do not set height via JS
      el.style.removeProperty("height");
      el.style.removeProperty("max-height");
      el.style.removeProperty("min-height");
      el.style.removeProperty("transform");
      el.style.removeProperty("margin-top");
      el.style.removeProperty("top");
      el.style.removeProperty("bottom");
      el.style.removeProperty("left");
      el.style.removeProperty("right");

      // Re-assert CSS contract without pixel heights
      el.style.position = "fixed";
      el.style.inset = "0";
      el.style.width = "100%";
      el.style.maxWidth = "32rem";
      el.style.marginLeft = "auto";
      el.style.marginRight = "auto";
      el.style.display = "flex";
      el.style.flexDirection = "column";
      el.style.overflow = "hidden";
      el.style.boxSizing = "border-box";

      const booting =
        document.documentElement.getAttribute("data-uc-booting") === "1";
      // Tab bar is an in-flow reserved row — do not pad the shell for it
      el.style.paddingBottom = "0px";
      void booting;

      if (document.documentElement.getAttribute("data-uc-chat-open") !== "1") {
        el.style.removeProperty("pointer-events");
      }
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        pin();
      });
    };

    pin();
    const timers = [0, 100, 400, 1000].map((ms) => window.setTimeout(pin, ms));

    // Watch booting flag flips
    const mo = new MutationObserver(schedule);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-uc-booting", "data-uc-chat-open", "style"],
    });

    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    window.addEventListener("pageshow", schedule);
    document.addEventListener("visibilitychange", schedule);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      mo.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      window.removeEventListener("pageshow", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, []);

  return null;
}
