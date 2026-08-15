import { useEffect } from "react";

function isEditable(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type || "text";
    return ![
      "checkbox",
      "radio",
      "range",
      "file",
      "color",
      "hidden",
      "button",
      "submit",
      "reset",
      "image",
    ].includes(type);
  }
  return el.isContentEditable;
}

function scrollParents(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  let n: HTMLElement | null = el.parentElement;
  while (n && n !== document.documentElement) {
    const st = getComputedStyle(n);
    const oy = st.overflowY;
    const ox = st.overflowX;
    const scrollableY =
      (oy === "auto" || oy === "scroll" || oy === "overlay") &&
      n.scrollHeight > n.clientHeight + 2;
    const scrollableX =
      (ox === "auto" || ox === "scroll" || ox === "overlay") &&
      n.scrollWidth > n.clientWidth + 2;
    if (scrollableY || scrollableX) out.push(n);
    n = n.parentElement;
  }
  return out;
}

/**
 * Keep focused field fully inside the *visual* viewport (above keyboard).
 * With interactive-widget=overlays-content the layout does not shrink —
 * we must scroll the field into the visible frame ourselves.
 */
function keepInView(el: HTMLElement) {
  // Match chat pins its shell to visualViewport — don't fight it
  if (
    el.closest("[data-uc-match-chat]") ||
    el.closest("[data-uc-invite-sheet]") ||
    document.documentElement.getAttribute("data-uc-chat-open") === "1"
  ) {
    return;
  }
  const vv = window.visualViewport;
  const pad = 20;
  const visibleTop = vv ? vv.offsetTop + pad : pad;
  const visibleBottom = vv
    ? vv.offsetTop + vv.height - pad
    : window.innerHeight - pad;

  // 1) Prefer scrolling nearest overflow ancestors (app uses these)
  for (const parent of scrollParents(el)) {
    const eRect = el.getBoundingClientRect();
    if (eRect.bottom > visibleBottom) {
      parent.scrollTop += eRect.bottom - visibleBottom;
    } else if (eRect.top < visibleTop) {
      parent.scrollTop -= visibleTop - eRect.top;
    }
  }

  // 2) Fallback native scrollIntoView
  const r = el.getBoundingClientRect();
  if (r.bottom > visibleBottom || r.top < visibleTop) {
    try {
      el.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    } catch {
      /* ignore */
    }
  }

  // 3) If still covered (iOS sometimes needs a second pass), nudge again
  const r2 = el.getBoundingClientRect();
  if (r2.bottom > visibleBottom) {
    for (const parent of scrollParents(el)) {
      parent.scrollTop += r2.bottom - visibleBottom + 8;
    }
  }
  if (r2.top < visibleTop) {
    for (const parent of scrollParents(el)) {
      parent.scrollTop -= visibleTop - r2.top + 8;
    }
  }
}

/**
 * Mount once at app root.
 * - Blocks iOS focus-zoom caret desync (pairs with CSS 16px inputs)
 * - On focus + every visualViewport resize/scroll, keeps caret on-screen
 */
export function IosKeyboardGuard() {
  useEffect(() => {
    let focused: HTMLElement | null = null;
    const timers: number[] = [];

    const clearTimers = () => {
      while (timers.length) window.clearTimeout(timers.pop()!);
    };

    const run = () => {
      if (!focused || document.activeElement !== focused) return;
      if (!isEditable(focused)) return;
      keepInView(focused);
    };

    const schedule = () => {
      clearTimers();
      // Keyboard animation on iOS ~300–450ms — sample across it
      for (const ms of [0, 50, 100, 180, 280, 400, 560, 720]) {
        timers.push(window.setTimeout(run, ms));
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!isEditable(e.target)) return;
      focused = e.target;
      // Defensive: ensure computed font-size never triggers zoom mid-session
      try {
        const cs = getComputedStyle(focused);
        const px = parseFloat(cs.fontSize) || 0;
        if (px > 0 && px < 16) {
          focused.style.fontSize = "16px";
        }
      } catch {
        /* ignore */
      }
      schedule();
    };

    const onFocusOut = () => {
      focused = null;
      clearTimers();
    };

    const onVv = () => {
      if (focused && document.activeElement === focused) schedule();
    };

    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", onVv);
    vv?.addEventListener("scroll", onVv);
    window.addEventListener("resize", onVv);

    return () => {
      clearTimers();
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      vv?.removeEventListener("resize", onVv);
      vv?.removeEventListener("scroll", onVv);
      window.removeEventListener("resize", onVv);
    };
  }, []);

  return null;
}
