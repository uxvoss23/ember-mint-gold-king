import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

function keyboardInset(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
}

function pinBar(bar: HTMLElement) {
  bar.style.setProperty("position", "fixed", "important");
  bar.style.setProperty("left", "0px", "important");
  bar.style.setProperty("right", "0px", "important");
  bar.style.setProperty("bottom", "0px", "important");
  bar.style.setProperty("top", "auto", "important");
  bar.style.setProperty("transform", "none", "important");
  bar.style.setProperty("margin", "0px", "important");
}

/**
 * Bottom tabs portaled to document.body.
 * Always layout-bottom (100lvh). Hidden while keyboard or chat is open.
 */
export function BottomTabBar({ children }: { children: ReactNode }) {
  const [mount] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined" ? document.body : null,
  );

  useLayoutEffect(() => {
    if (!mount) return;
    let closeTimers: number[] = [];

    const measure = () => {
      const root = document.documentElement;
      const bar = document.getElementById("uc-bottom-tab-bar");
      const booting = root.getAttribute("data-uc-booting") === "1";
      const chatOpen = root.getAttribute("data-uc-chat-open") === "1";
      const kb = keyboardInset() >= 80;

      if (kb) root.setAttribute("data-uc-kb-open", "1");
      else root.removeAttribute("data-uc-kb-open");

      if (booting || chatOpen || kb) {
        root.style.setProperty("--uc-tab-h", "0px");
        return;
      }

      if (!bar) return;

      bar.style.removeProperty("display");
      bar.style.removeProperty("visibility");
      bar.style.removeProperty("pointer-events");
      bar.style.removeProperty("opacity");
      pinBar(bar);

      let safe = 0;
      try {
        const probe = document.createElement("div");
        probe.style.cssText =
          "position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px)";
        document.body.appendChild(probe);
        safe = Math.min(20, parseFloat(getComputedStyle(probe).paddingBottom) || 0);
        probe.remove();
      } catch {
        safe = 0;
      }

      bar.style.paddingBottom = `${Math.max(6, safe)}px`;
      const h = bar.offsetHeight || 72;
      root.style.setProperty("--uc-tab-h", `${h}px`);
    };

    const onViewport = () => {
      measure();
      // Keyboard close animates ~300–450ms — re-pin across it
      if (keyboardInset() < 80) {
        closeTimers.forEach((t) => window.clearTimeout(t));
        closeTimers = [0, 80, 180, 320, 500, 720].map((ms) =>
          window.setTimeout(measure, ms),
        );
      }
    };

    measure();
    const bootTimers = [0, 50, 200].map((ms) => window.setTimeout(measure, ms));

    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        onViewport();
      });
    };

    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    window.addEventListener("focusin", schedule);
    window.addEventListener("focusout", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    const mo = new MutationObserver(schedule);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-uc-chat-open", "data-uc-booting"],
    });
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    const bar = document.getElementById("uc-bottom-tab-bar");
    if (bar) ro?.observe(bar);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      bootTimers.forEach((t) => window.clearTimeout(t));
      closeTimers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      window.removeEventListener("focusin", schedule);
      window.removeEventListener("focusout", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      mo.disconnect();
      ro?.disconnect();
      document.documentElement.removeAttribute("data-uc-kb-open");
    };
  }, [mount]);

  if (!mount) return null;

  return createPortal(
    <nav
      id="uc-bottom-tab-bar"
      data-uc-tab-bar="true"
      aria-label="Main"
      className="pointer-events-none fixed right-0 bottom-0 left-0 z-[100] flex justify-center box-border px-2.5 pb-2"
      style={{ top: "auto", bottom: 0, transform: "none" }}
    >
      {children}
    </nav>,
    mount,
  );
}
