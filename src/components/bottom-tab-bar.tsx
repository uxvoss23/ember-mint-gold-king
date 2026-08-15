import { useLayoutEffect, type ReactNode } from "react";

function keyboardInset(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
}

/**
 * Bottom tabs — in-flow reserved row in the app shell.
 * Hidden (unmounted by parent, or CSS) while keyboard or chat is open.
 */
export function BottomTabBar({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
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

    measure();
    const bootTimers = [0, 50, 200].map((ms) => window.setTimeout(measure, ms));

    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };

    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    window.addEventListener("focusin", schedule);
    window.addEventListener("focusout", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
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
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      window.removeEventListener("focusin", schedule);
      window.removeEventListener("focusout", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      mo.disconnect();
      ro?.disconnect();
      document.documentElement.removeAttribute("data-uc-kb-open");
    };
  }, []);

  return (
    <nav
      id="uc-bottom-tab-bar"
      data-uc-tab-bar="true"
      aria-label="Main"
      className="pointer-events-none relative z-20 flex w-full shrink-0 justify-center box-border px-2.5 pt-1 pb-2"
    >
      {children}
    </nav>
  );
}