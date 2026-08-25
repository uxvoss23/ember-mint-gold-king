import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Send } from "lucide-react";
import {
  formatCheckInTime,
  hoopChatMessages,
  type HoopCheckIn,
  useCourtSocial,
} from "@/lib/courts/social";
import { cn } from "@/lib/utils";

function unlockAppShell() {
  document.documentElement.removeAttribute("data-uc-chat-open");
  document.body.removeAttribute("data-uc-chat-open");
}

/**
 * Hooping-now chat overlay.
 * Header always visible (safe-area aware). Input clears on send.
 * Never resizes the main app shell.
 */
export function HoopingNowChat({
  checkIn,
  courtName,
  authorName,
  onClose,
}: {
  checkIn: HoopCheckIn;
  courtName: string;
  authorName: string;
  onClose: () => void;
}) {
  const live = useCourtSocial((s) =>
    s.checkIns.find((c) => c.id === checkIn.id),
  );
  const postHoopChat = useCourtSocial((s) => s.postHoopChat);

  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [kbInset, setKbInset] = useState(0);
  const [draft, setDraft] = useState("");
  const [headerH, setHeaderH] = useState(64);
  const [composerH, setComposerH] = useState(72);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const messages = hoopChatMessages(live ?? checkIn);

  useEffect(() => {
    setPortalEl(document.body);
  }, []);

  useLayoutEffect(() => {
    if (!portalEl) return;

    document.documentElement.setAttribute("data-uc-chat-open", "1");
    document.body.setAttribute("data-uc-chat-open", "1");

    const app = document.querySelector<HTMLElement>(".app-shell");
    if (app) app.style.pointerEvents = "none";

    const measureChrome = () => {
      if (headerRef.current) {
        setHeaderH(Math.ceil(headerRef.current.getBoundingClientRect().height));
      }
      if (composerRef.current) {
        // Height without keyboard pad — keyboard is applied via bottom offset
        const raw = composerRef.current.getBoundingClientRect().height;
        // When kbInset is applied as bottom, measured height is just the bar
        setComposerH(Math.max(64, Math.ceil(raw)));
      }
    };

    const measureKb = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setKbInset(0);
        return;
      }
      const raw = Math.round(window.innerHeight - vv.height - vv.offsetTop);
      setKbInset(raw >= 80 ? raw : 0);
    };

    measureChrome();
    measureKb();

    const ro = new ResizeObserver(() => measureChrome());
    if (headerRef.current) ro.observe(headerRef.current);
    if (composerRef.current) ro.observe(composerRef.current);

    const vv = window.visualViewport;
    vv?.addEventListener("resize", measureKb);
    vv?.addEventListener("scroll", measureKb);
    window.addEventListener("resize", measureChrome);

    return () => {
      ro.disconnect();
      vv?.removeEventListener("resize", measureKb);
      vv?.removeEventListener("scroll", measureKb);
      window.removeEventListener("resize", measureChrome);
      try {
        inputRef.current?.blur();
      } catch {
        /* ignore */
      }
      unlockAppShell();
      window.setTimeout(unlockAppShell, 120);
      window.setTimeout(unlockAppShell, 400);
    };
  }, [portalEl]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages.length, kbInset, headerH, composerH, portalEl]);

  const send = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    postHoopChat(checkIn.id, t, authorName);
    setDraft("");
    // Also wipe the DOM node in case iOS keeps ghost text
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  }, [authorName, checkIn.id, draft, postHoopChat]);

  const handleClose = useCallback(() => {
    try {
      inputRef.current?.blur();
      (document.activeElement as HTMLElement | null)?.blur?.();
    } catch {
      /* ignore */
    }
    unlockAppShell();
    onClose();
    window.setTimeout(unlockAppShell, 80);
    window.setTimeout(unlockAppShell, 300);
  }, [onClose]);

  if (!portalEl) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Hooping now chat · ${courtName}`}
      className="bg-bg text-fg"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 2147483000,
        background: "#0c0c0d",
      }}
    >
      {/* HEADER — min-height + safe padding so the back control never clips */}
      <header
        ref={headerRef}
        className="absolute inset-x-0 top-0 z-30 border-b border-border bg-bg"
        style={{
          paddingTop: "max(8px, env(safe-area-inset-top, 0px))",
        }}
      >
        <div className="flex items-center gap-2 px-2.5 py-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-bg-elevated text-fg active:bg-bg-subtle"
            aria-label="Back to court"
          >
            <ArrowLeft className="size-5" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="min-w-0 flex-1 text-left active:opacity-80"
          >
            <p className="truncate text-[15px] font-semibold leading-tight text-fg">
              {courtName}
            </p>
            <p className="text-[11px] font-medium text-emerald-500">
              Tap to go back to court
            </p>
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-full bg-court px-3.5 py-2.5 text-[12px] font-semibold text-white active:scale-95"
          >
            Done
          </button>
        </div>
      </header>

      {/* MESSAGES */}
      <div
        ref={listRef}
        className="absolute inset-x-0 space-y-2.5 overflow-y-auto overscroll-contain px-3 py-3"
        style={{
          top: headerH,
          bottom: composerH + kbInset,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {messages.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-fg-muted">
            No messages yet — say you’re on the way.
          </p>
        ) : (
          messages.map((m) => {
            const mine =
              !m.system &&
              (m.author === authorName ||
                m.author === "You" ||
                m.author.startsWith("You"));
            return (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  m.system
                    ? "justify-center"
                    : mine
                      ? "justify-end"
                      : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl px-3 py-2 text-[14px] leading-snug",
                    m.system
                      ? "w-full max-w-full border border-emerald-500/30 bg-emerald-500/10 text-fg"
                      : mine
                        ? "rounded-br-md bg-court text-white"
                        : "rounded-bl-md bg-bg-elevated text-fg",
                  )}
                >
                  {!mine && !m.system ? (
                    <span className="mb-0.5 block text-[10px] font-semibold opacity-70">
                      {m.author}
                    </span>
                  ) : null}
                  {m.system ? (
                    <span className="mb-0.5 block text-[10px] font-semibold tracking-wide text-emerald-500 uppercase">
                      Hooping now
                    </span>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  {m.photoUrl ? (
                    <img
                      src={m.photoUrl}
                      alt=""
                      className="mt-2 max-h-48 w-full rounded-xl object-cover"
                    />
                  ) : null}
                  <span
                    className={cn(
                      "mt-1 block text-[10px]",
                      mine && !m.system ? "text-white/70" : "text-fg-subtle",
                    )}
                  >
                    {formatCheckInTime(m.at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* COMPOSER */}
      <div
        ref={composerRef}
        className="absolute inset-x-0 z-30 border-t border-border bg-bg px-3 pt-2"
        style={{
          bottom: kbInset,
          paddingBottom: "max(10px, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message the run…"
            enterKeyHint="send"
            autoComplete="off"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-border bg-bg-elevated px-3.5 text-[16px] text-fg outline-none placeholder:text-fg-subtle focus:border-court"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-2xl active:scale-95",
              draft.trim()
                ? "bg-court text-white"
                : "bg-bg-elevated text-fg-subtle",
            )}
            aria-label="Send"
          >
            <Send className="size-4" strokeWidth={2} />
          </button>
        </form>
      </div>
    </div>,
    portalEl,
  );
}
