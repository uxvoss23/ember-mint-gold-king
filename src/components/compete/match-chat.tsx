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
import { useTabBarGate } from "@/lib/ui/tab-bar-gate";
import { cn } from "@/lib/utils";
import { isDemoMode } from "@/lib/config";

function courtShort(name: string) {
  return name.replace(/\s*Courts?\s*$/i, "") || name;
}

function updateChatViewport() {
  const vv = window.visualViewport;
  const height = Math.round(vv?.height ?? window.innerHeight);
  const offsetTop = Math.round(vv?.offsetTop ?? 0);
  const root = document.documentElement;
  root.style.setProperty("--chat-vh", `${height}px`);
  root.style.setProperty("--viewport-offset-top", `${offsetTop}px`);
}

function clearChatViewport() {
  const root = document.documentElement;
  root.style.removeProperty("--chat-vh");
  root.style.removeProperty("--viewport-offset-top");
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
  const [focused, setFocused] = useState(false);
  const [tabH, setTabH] = useState(72);
  const setTabsHidden = useTabBarGate((s) => s.setHidden);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const closedVv = useRef({ height: 0, offsetTop: 0 });
  const pendingNav = useRef(false);
  const restoreTimers = useRef<number[]>([]);
  const restoreNavRef = useRef<() => void>(() => {});

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

  const snapshotClosedVv = () => {
    const vv = window.visualViewport;
    const height = Math.round(vv?.height ?? window.innerHeight);
    const offsetTop = Math.round(vv?.offsetTop ?? 0);
    if (!closedVv.current.height || height >= closedVv.current.height - 8) {
      closedVv.current = { height, offsetTop };
    }
  };

  const viewportRestored = () => {
    const vv = window.visualViewport;
    const height = Math.round(vv?.height ?? window.innerHeight);
    const offsetTop = Math.round(vv?.offsetTop ?? 0);
    const closed = closedVv.current;
    if (closed.height < 100) return true;
    return (
      Math.abs(height - closed.height) <= 24 &&
      Math.abs(offsetTop - closed.offsetTop) <= 16
    );
  };

  restoreNavRef.current = () => {
    if (!pendingNav.current) return;
    updateChatViewport();
    if (!viewportRestored()) return;
    pendingNav.current = false;
    restoreTimers.current.forEach((t) => window.clearTimeout(t));
    restoreTimers.current = [];
    setFocused(false);
    setTabsHidden(false);
  };

  useEffect(() => {
    setPortalEl(document.body);
  }, []);

  useLayoutEffect(() => {
    if (!portalEl) return;

    const bar = document.getElementById("uc-bottom-tab-bar");
    if (bar && bar.offsetHeight > 40) setTabH(bar.offsetHeight);

    snapshotClosedVv();
    updateChatViewport();
    document.documentElement.setAttribute("data-uc-match-chat-open", "1");

    const onVv = () => {
      updateChatViewport();
      restoreNavRef.current();
    };
    const vv = window.visualViewport;
    vv?.addEventListener("resize", onVv);
    vv?.addEventListener("scroll", onVv);
    window.addEventListener("resize", onVv);
    window.addEventListener("orientationchange", onVv);

    return () => {
      vv?.removeEventListener("resize", onVv);
      vv?.removeEventListener("scroll", onVv);
      window.removeEventListener("resize", onVv);
      window.removeEventListener("orientationchange", onVv);
      restoreTimers.current.forEach((t) => window.clearTimeout(t));
      restoreTimers.current = [];
      pendingNav.current = false;
      try {
        inputRef.current?.blur();
      } catch {
        /* ignore */
      }
      setTabsHidden(false);
      clearChatViewport();
      document.documentElement.removeAttribute("data-uc-match-chat-open");
    };
  }, [portalEl, setTabsHidden]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [chat.length, draft, focused, portalEl]);

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const send = useCallback(() => {
    if (!draft.trim()) return;
    onSend();
    if (inputRef.current) inputRef.current.style.height = "auto";
  }, [draft, onSend]);

  const handleFocus = () => {
    pendingNav.current = false;
    restoreTimers.current.forEach((t) => window.clearTimeout(t));
    restoreTimers.current = [];
    snapshotClosedVv();
    setFocused(true);
    setTabsHidden(true);
    updateChatViewport();
  };

  const handleBlur = () => {
    pendingNav.current = true;
    restoreTimers.current.forEach((t) => window.clearTimeout(t));
    restoreTimers.current = [
      window.setTimeout(() => restoreNavRef.current(), 280),
      window.setTimeout(() => {
        if (!pendingNav.current) return;
        pendingNav.current = false;
        updateChatViewport();
        setFocused(false);
        setTabsHidden(false);
      }, 800),
    ];
    restoreNavRef.current();
  };

  const handleBack = useCallback(() => {
    try {
      inputRef.current?.blur();
      (document.activeElement as HTMLElement | null)?.blur?.();
    } catch {
      /* ignore */
    }
    setTabsHidden(false);
    clearChatViewport();
    document.documentElement.removeAttribute("data-uc-match-chat-open");
    onBack();
  }, [onBack, setTabsHidden]);

  if (!portalEl) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Chat with ${opponent.name}`}
      data-uc-match-chat="1"
      className="bg-bg text-fg"
      style={{
        position: "fixed",
        top: "var(--viewport-offset-top, 0px)",
        left: 0,
        right: 0,
        width: "100%",
        maxWidth: "32rem",
        marginLeft: "auto",
        marginRight: "auto",
        height: focused
          ? "var(--chat-vh, 100dvh)"
          : `calc(var(--chat-vh, 100dvh) - ${tabH}px)`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 80,
        transform: "none",
        zoom: 1,
      }}
    >
      <header
        className="shrink-0 border-b border-border bg-bg"
        style={{
          paddingTop: "max(8px, env(safe-area-inset-top, 0px))",
          transform: "none",
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
        data-uc-chat-messages="1"
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-3"
        style={{ WebkitOverflowScrolling: "touch" }}
        onPointerDown={() => {
          if (focused) inputRef.current?.blur();
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
              onDemoApprove={
                iProposed && isDemoMode() ? () => onApprove(true) : undefined
              }
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
        data-uc-match-composer="1"
        className="shrink-0 border-t border-border bg-bg px-3 pt-2"
        style={{
          paddingBottom: focused
            ? 8
            : "max(8px, env(safe-area-inset-bottom, 0px))",
          transform: "none",
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
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={(e) => {
              onDraftChange(e.target.value);
              grow(e.target);
            }}
            placeholder={`Message ${firstName}…`}
            className="chat-input max-h-[120px] min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-border bg-bg-elevated px-4 py-2.5 text-[16px] text-fg outline-none placeholder:text-fg-subtle focus:border-court"
          />
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
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
    const isConfirmed = /game confirmed/i.test(msg.text);
    return (
      <div
        className={cn(
          "mx-auto max-w-[88%] rounded-2xl px-3.5 py-2.5 text-center",
          isConfirmed
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
