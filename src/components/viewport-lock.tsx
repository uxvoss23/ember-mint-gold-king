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
      // height lives in CSS (.app-shell { height: 100dvh })

      const booting =
        document.documentElement.getAttribute("data-uc-booting") === "1";
      if (booting) {
        el.style.paddingBottom = "0px";
      } else {
        el.style.paddingBottom = "var(--uc-tab-h, 0px)";
      }

      if (document.documentElement.getAttribute("data-uc-chat-open") !== "1") {
        el.style.removeProperty("pointer-events");
      }

      for (const node of [document.documentElement, document.body]) {
        node.style.removeProperty("height");
        node.style.removeProperty("max-height");
        node.style.position = "fixed";
        node.style.inset = "0";
        node.style.overflow = "hidden";
      }

      try {
        window.scrollTo(0, 0);
      } catch {
        /* ignore */
      }

      // After keyboard: snap tab bar back to the real bottom
      const bar = document.getElementById("uc-bottom-tab-bar");
      if (
        bar &&
        document.documentElement.getAttribute("data-uc-chat-open") !== "1" &&
        document.documentElement.getAttribute("data-uc-kb-open") !== "1"
      ) {
        bar.style.setProperty("bottom", "0px", "important");
        bar.style.setProperty("top", "auto", "important");
        bar.style.setProperty("transform", "none", "important");
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
