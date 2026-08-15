import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ArrowUp, ChevronLeft, MapPin } from "lucide-react";
import type { HoopChatMsg, HoopMatch } from "@/lib/upset/hoop-now";
import type { Player } from "@/lib/upset/types";
import { displayRating } from "@/lib/rating/engine";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { cn } from "@/lib/utils";

function courtShort(name: string) {
  return name.replace(/\s*Courts?\s*$/i, "") || name;
}

function unlockShell() {
  document.body.style.removeProperty("overflow");
  document.documentElement.style.removeProperty("overflow");
  document.documentElement.removeAttribute("data-uc-chat-open");
  document.body.removeAttribute("data-uc-chat-open");
  document.documentElement.removeAttribute("data-uc-match-chat-open");
  try {
    window.dispatchEvent(new Event("resize"));
    window.scrollTo(0, 0);
  } catch {
    /* ignore */
  }
}

export function MatchChat({
  me,
  opponent,
  hoopMatch,
  draft,
  onDraftChange,
  onSend,
  onBack,
  onEditPlan,
  onApprove,
  error,
}: {
  me: Player;
  opponent: Player;
  hoopMatch: HoopMatch;
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  onBack: () => void;
  onEditPlan: () => void;
  onApprove: (asDemo?: boolean) => void;
  error?: string | null;
}) {
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [kbInset, setKbInset] = useState(0);
  const [headerH, setHeaderH] = useState(56);
  const [composerH, setComposerH] = useState(64);
  const [tabH, setTabH] = useState(72);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const firstName = opponent.name.split(" ")[0];
  const chat = hoopMatch.chat ?? [];
  const pendingProp = chat.find(
    (c) => c.kind === "proposal" && c.proposal?.status === "pending",
  );
  const latestProp =
    pendingProp ??
    [...chat].reverse().find((c) => c.kind === "proposal" && c.proposal);
  const prop = latestProp?.proposal;
  const iProposed = prop?.proposedById === me.id;
  const confirmed =
    Boolean(hoopMatch.gameMatchId) ||
    hoopMatch.status === "locked" ||
    prop?.status === "approved";

  const thread = chat.filter((m) => m.kind !== "proposal");

  useEffect(() => {
    setPortalEl(document.body);
  }, []);

  useLayoutEffect(() => {
    if (!portalEl) return;

    const bar = document.getElementById("uc-bottom-tab-bar");
    if (bar && bar.offsetHeight > 40) setTabH(bar.offsetHeight);

    document.documentElement.setAttribute("data-uc-chat-open", "1");
    document.body.setAttribute("data-uc-chat-open", "1");
    document.documentElement.setAttribute("data-uc-match-chat-open", "1");

    const app = document.querySelector<HTMLElement>(".app-shell");
    if (app) app.style.pointerEvents = "none";

    const measureChrome = () => {
      if (headerRef.current) {
        setHeaderH(Math.ceil(headerRef.current.getBoundingClientRect().height));
      }
      if (composerRef.current) {
        setComposerH(
          Math.max(56, Math.ceil(composerRef.current.getBoundingClientRect().height)),
        );
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
      if (app) app.style.removeProperty("pointer-events");
      unlockShell();
      window.setTimeout(unlockShell, 120);
      window.setTimeout(unlockShell, 400);
    };
  }, [portalEl]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [chat.length, kbInset, headerH, composerH, draft, portalEl]);

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const send = useCallback(() => {
    if (!draft.trim()) return;
    onSend();
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, [draft, onSend]);

  const handleBack = useCallback(() => {
    try {
      inputRef.current?.blur();
      (document.activeElement as HTMLElement | null)?.blur?.();
    } catch {
      /* ignore */
    }
    unlockShell();
    onBack();
  }, [onBack]);

  if (!portalEl) return null;

  const kbOpen = kbInset >= 80;
  const overlayBottom = kbOpen ? 0 : tabH;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Chat with ${opponent.name}`}
      data-uc-match-chat="1"
      className="bg-bg text-fg"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: overlayBottom,
        width: "100%",
        maxWidth: "32rem",
        marginLeft: "auto",
        marginRight: "auto",
        zIndex: 80,
        overflow: "hidden",
        background: "var(--color-bg)",
      }}
    >
      <header
        ref={headerRef}
        className="absolute inset-x-0 top-0 z-30 border-b border-border bg-bg"
        style={{
          paddingTop: "max(8px, env(safe-area-inset-top, 0px))",
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={handleBack}
            className="flex h-11 items-center gap-0.5 rounded-full border border-border pr-3 pl-1.5 text-[13px] font-semibold text-fg"
          >
            <ChevronLeft className="size-5" />
            Back
          </button>
          <PlayerAvatar player={opponent} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight text-fg">
              {opponent.name}
            </p>
            <p className="text-[11px] text-fg-muted">
              {displayRating(opponent.rating)}
            </p>
          </div>
        </div>
      </header>

      <div
        ref={listRef}
        className="absolute inset-x-0 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-3"
        style={{
          top: headerH,
          bottom: composerH,
          WebkitOverflowScrolling: "touch",
        }}
        onPointerDown={() => {
          if (kbOpen) inputRef.current?.blur();
        }}
      >
        <div className="space-y-3">
          {prop ? (
            <CompactMatchCard
              courtName={courtShort(prop.courtName)}
              whenLabel={prop.whenLabel}
              waitingName={firstName}
              iProposed={iProposed}
              confirmed={confirmed}
              pending={prop.status === "pending" && !confirmed}
              onEdit={onEditPlan}
              onApprove={() => onApprove(false)}
              onDemoApprove={iProposed ? () => onApprove(true) : undefined}
            />
          ) : null}

          {thread.map((m) => (
            <ThreadItem
              key={m.id}
              msg={m}
              mine={m.authorId === me.id}
              onReview={onEditPlan}
            />
          ))}

          {error ? (
            <p className="text-center text-[12px] text-danger">{error}</p>
          ) : null}
        </div>
      </div>

      <div
        ref={composerRef}
        data-uc-match-composer="1"
        className="absolute inset-x-0 z-30 border-t border-border bg-bg px-3 pt-2"
        style={{
          bottom: kbInset,
          paddingBottom: kbOpen
            ? 8
            : "max(8px, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            rows={1}
            enterKeyHint="enter"
            autoComplete="off"
            autoCorrect="on"
            autoCapitalize="sentences"
            onChange={(e) => {
              onDraftChange(e.target.value);
              grow(e.target);
            }}
            placeholder={`Message ${firstName}…`}
            className="max-h-[120px] min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-border bg-bg-elevated px-4 py-2.5 text-[16px] leading-snug text-fg outline-none placeholder:text-fg-subtle focus:border-court"
          />
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim()}
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full",
              draft.trim()
                ? "bg-court text-white"
                : "bg-bg-elevated text-fg-subtle",
            )}
            aria-label="Send"
          >
            <ArrowUp className="size-5" strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </div>,
    portalEl,
  );
}

function CompactMatchCard({
  courtName,
  whenLabel,
  waitingName,
  iProposed,
  confirmed,
  pending,
  onEdit,
  onApprove,
  onDemoApprove,
}: {
  courtName: string;
  whenLabel: string;
  waitingName: string;
  iProposed: boolean;
  confirmed: boolean;
  pending: boolean;
  onEdit: () => void;
  onApprove: () => void;
  onDemoApprove?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg-elevated px-3.5 py-3">
      <p className="text-[10px] font-bold tracking-[0.14em] text-court uppercase">
        Match
      </p>
      <div className="mt-1.5 flex items-start gap-2">
        <MapPin className="mt-0.5 size-4 shrink-0 text-court" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-fg">{courtName}</p>
          <p className="mt-0.5 text-[13px] text-fg-muted">{whenLabel}</p>
          {confirmed ? (
            <p className="mt-1.5 text-[12px] font-medium text-court">
              Game confirmed
            </p>
          ) : pending ? (
            <p className="mt-1.5 text-[12px] text-fg-muted">
              {iProposed
                ? `Waiting for ${waitingName} to approve`
                : "Waiting for your approval"}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {pending && !iProposed ? (
          <button
            type="button"
            onClick={onApprove}
            className="rounded-full bg-court px-4 py-2 text-[12px] font-semibold text-white"
          >
            Approve
          </button>
        ) : null}
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full border border-border px-4 py-2 text-[12px] font-semibold text-fg"
        >
          {confirmed ? "View plan" : "View / Edit Plan"}
        </button>
        {pending && onDemoApprove ? (
          <button
            type="button"
            onClick={onDemoApprove}
            className="rounded-full border border-border px-3 py-2 text-[11px] font-medium text-fg-muted"
          >
            Approve as {waitingName} (demo)
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ThreadItem({
  msg,
  mine,
  onReview,
}: {
  msg: HoopChatMsg;
  mine: boolean;
  onReview: () => void;
}) {
  if (msg.kind === "proposal") return null;

  if (msg.kind === "proposal_update") {
    return (
      <div className="mx-auto max-w-[88%] rounded-2xl border border-border bg-bg-elevated px-3.5 py-2.5 text-center">
        <p className="whitespace-pre-wrap text-[13px] leading-snug text-fg">
          {msg.text}
        </p>
        <button
          type="button"
          onClick={onReview}
          className="mt-1.5 text-[12px] font-semibold text-court"
        >
          Review
        </button>
      </div>
    );
  }

  if (msg.system) {
    const confirmed = /game confirmed/i.test(msg.text);
    return (
      <div
        className={cn(
          "mx-auto max-w-[88%] rounded-2xl px-3.5 py-2.5 text-center",
          confirmed
            ? "border border-court/40 bg-court/10"
            : "border border-border bg-bg-elevated",
        )}
      >
        <p className="whitespace-pre-wrap text-[13px] leading-snug text-fg">
          {msg.text}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug break-words whitespace-pre-wrap",
          mine
            ? "rounded-br-md bg-court text-white"
            : "rounded-bl-md bg-bg-elevated text-fg",
        )}
      >
        {msg.text}
      </div>
    </div>
  );
}
