import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Check,
  Copy,
  ExternalLink,
  Heart,
  Shield,
  Smartphone,
} from "lucide-react";
import type { Match, Player } from "@/lib/upset/types";
import {
  ALZHEIMERS_CHARITY,
  formatMoney,
  settleTargets,
  stakesChipLabel,
  stakesChipParts,
  stakesExplain,
  type SettleMethodId,
} from "@/lib/upset/stakes";
import { cn } from "@/lib/utils";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

const METHODS: {
  id: SettleMethodId;
  label: string;
  sub: string;
  icon: "cashapp" | "venmo" | "zelle" | "cash" | "charity";
}[] = [
  { id: "cashapp", label: "Cash App", sub: "Fast · private", icon: "cashapp" },
  { id: "venmo", label: "Venmo", sub: "Set to Private", icon: "venmo" },
  { id: "zelle", label: "Zelle", sub: "Bank-to-bank", icon: "zelle" },
  { id: "cash", label: "Cash", sub: "At the court", icon: "cash" },
];

/**
 * Premium settle experience — peer apps / cash / charity.
 * Upset City never holds money.
 */
export function StakeSettleCard({
  match,
  me,
  host,
  opp,
  onMarkSettled,
  onRequestExtension,
  onReportUnpaid,
  compact,
}: {
  match: Match;
  me: Player;
  host?: Player | null;
  opp?: Player | null;
  onMarkSettled: (method: SettleMethodId | "other") => void;
  onRequestExtension?: (note: string) => { ok: boolean; reason?: string };
  onReportUnpaid?: () => { ok: boolean; reason?: string };
  compact?: boolean;
}) {
  const stakes = match.stakes;
  const [method, setMethod] = useState<SettleMethodId | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [extOpen, setExtOpen] = useState(false);
  const [extNote, setExtNote] = useState("");
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (!stakes || stakes.mode === "fun") return;
    if (stakes.mode === "charity") setMethod("charity");
    else setMethod("cashapp");
  }, [stakes?.mode, match.id]);

  if (!stakes || stakes.mode === "fun" || stakes.mode === "stakes") {
    if (compact) return null;
    if (stakes?.mode === "stakes") {
      return (
        <p className="text-[11px] text-fg-muted">
          Peer cash games are no longer offered. Play for fun or Alzheimer's.
        </p>
      );
    }
    return (
      <p className="text-[11px] text-fg-muted">Just for fun · rating only</p>
    );
  }

  const amount =
    stakes.amountDollars ?? stakes.fixedPriceDollars ?? null;
  /** Fixed price known up front for charity + stakes */
  const hasPayout = amount != null && amount > 0;
  const scoreLocked = stakes.loserId != null;
  const payeeId = null;
  const payee = null;
  const iOwe =
    scoreLocked && hasPayout && stakes.loserId === me.id && !stakes.settled;
  const iWon = false;
  const isParty =
    me.id === match.hostId || me.id === match.opponentId;

  const note = `Upset City · ${match.courtName}`;
  const targets = useMemo(() => {
    if (!method || amount == null) return null;
    return settleTargets(method, amount, payee, stakes, note);
  }, [method, amount, payee, stakes, note]);

  const doCopy = async (value: string, key: string) => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(key);
      setFlash("Copied");
      window.setTimeout(() => {
        setCopied(null);
        setFlash(null);
      }, 1400);
    } else {
      setFlash("Couldn’t copy — long-press instead");
      window.setTimeout(() => setFlash(null), 2000);
    }
  };

  const methods =
    stakes.mode === "charity"
      ? ([
          {
            id: "charity" as const,
            label: "Donate",
            sub: ALZHEIMERS_CHARITY.short,
            icon: "charity" as const,
          },
        ] as const)
      : METHODS;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border",
        stakes.mode === "charity"
          ? "border-violet-500/25 bg-gradient-to-b from-violet-500/10 to-bg-elevated"
          : "border-amber-500/25 bg-gradient-to-b from-amber-500/10 to-bg-elevated",
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-3.5 pt-3.5 pb-2">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm",
            stakes.mode === "charity" ? "bg-violet-600" : "bg-amber-600",
          )}
        >
          {stakes.mode === "charity" ? (
            <Heart className="size-4" strokeWidth={2} />
          ) : (
            <Banknote className="size-4" strokeWidth={2} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-[0.12em] text-fg-subtle uppercase">
            {stakes.mode === "charity" ? "Charity game" : "Stakes game"}
          </p>
          <p className="text-sm font-semibold text-fg">
            {(() => {
              const parts = stakesChipParts(stakes);
              if (!parts) return null;
              return (
                <>
                  {parts.kind}
                  {parts.money ? (
                    <>
                      {" · "}
                      <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {parts.money}
                      </span>
                    </>
                  ) : null}
                </>
              );
            })()}
          </p>
          {!hasPayout ? (
            <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">
              {stakesExplain(stakes)}
            </p>
          ) : null}
        </div>
      </div>

      {/* Amount hero — stakes show named price immediately; charity after scores */}
      {hasPayout ? (
        <div className="mx-3.5 mb-3 rounded-2xl border border-border/80 bg-bg px-4 py-4 text-center shadow-sm">
          <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
            {stakes.settled
              ? "Settled"
              : stakes.mode === "charity"
                ? "Donation due"
                : !scoreLocked
                  ? "On the line"
                  : iOwe
                    ? "You owe"
                    : iWon
                      ? "You’re owed"
                      : "Amount"}
          </p>
          <p className="mt-1 font-display text-[2.75rem] leading-none font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums drop-shadow-sm">
            {formatMoney(amount!)}
          </p>
          <p className="mt-2 text-[11px] font-medium text-fg-muted">
            Fixed gift · Alzheimer's research
          </p>
          {stakes.settled || stakes.paymentStatus === "settled" ? (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-success">
              <Check className="size-3.5" strokeWidth={2.5} />
              Marked complete
              {stakes.settleMethod ? ` · ${stakes.settleMethod}` : ""}
            </p>
          ) : stakes.paymentStatus === "exiled" ? (
            <p className="mt-2 text-[11px] font-bold text-danger">
              Non-payment · player permanently exiled from the league
            </p>
          ) : stakes.paymentStatus === "extension_requested" ? (
            <p className="mt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              More time requested
              {stakes.payDeadlineAt
                ? ` · due ${new Date(stakes.payDeadlineAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                : ""}
            </p>
          ) : stakes.payDeadlineAt ? (
            <p className="mt-2 text-[11px] text-fg-muted">
              Settle by{" "}
              {new Date(stakes.payDeadlineAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Pre-game rules */}
      {!hasPayout ? (
        <div className="mx-3.5 mb-3 rounded-xl bg-bg/70 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <Shield className="mt-0.5 size-3.5 shrink-0 text-fg-muted" />
            <p className="text-[11px] leading-snug text-fg-muted">
              After scores confirm, the loser donates the amount shown to
              Alzheimer's research. Upset City never holds money.
            </p>
          </div>
        </div>
      ) : null}

      {/* Settle actions — only after score lock */}
      {hasPayout && scoreLocked && !stakes.settled && isParty ? (
        <div className="space-y-3 border-t border-border/60 px-3.5 py-3">
          {iOwe || stakes.mode === "charity" ? (
            <>
              <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
                {stakes.mode === "charity"
                  ? "Donate privately"
                  : "Settle privately"}
              </p>
              <div
                className={cn(
                  "grid gap-1.5",
                  methods.length === 1 ? "grid-cols-1" : "grid-cols-2",
                )}
              >
                {methods.map((m) => {
                  const on = method === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left transition-colors",
                        on
                          ? "border-fg bg-fg text-bg"
                          : "border-border bg-bg text-fg hover:border-border-strong",
                      )}
                    >
                      <p className="text-xs font-semibold">{m.label}</p>
                      <p
                        className={cn(
                          "text-[10px]",
                          on ? "text-bg/70" : "text-fg-muted",
                        )}
                      >
                        {m.sub}
                      </p>
                    </button>
                  );
                })}
              </div>

              {method && targets ? (
                <div className="space-y-2 rounded-xl border border-border bg-bg p-3">
                  <p className="text-[11px] leading-snug text-fg-muted">
                    {targets.hint}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void doCopy(moneyOrHandle(targets.copyPrimary), "p")
                      }
                      className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-elevated px-3 text-xs font-semibold text-fg"
                    >
                      {copied === "p" ? (
                        <Check className="size-3.5 text-success" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      {targets.copyLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void doCopy(moneyAmountString(amount!), "a")
                      }
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-elevated px-3 text-xs font-semibold text-fg"
                    >
                      {copied === "a" ? (
                        <Check className="size-3.5 text-success" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatMoney(amount!)}
                      </span>
                    </button>
                  </div>
                  {targets.openUrl ? (
                    <a
                      href={targets.openUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-fg text-sm font-semibold text-bg active:scale-[0.99]"
                    >
                      {stakes.mode === "charity" ? (
                        <Heart className="size-4" />
                      ) : (
                        <Smartphone className="size-4" />
                      )}
                      {stakes.mode === "charity"
                        ? "Open donate page"
                        : method === "cashapp"
                          ? "Open Cash App"
                          : method === "venmo"
                            ? "Open Venmo"
                            : "Open"}
                      <ExternalLink className="size-3.5 opacity-70" />
                    </a>
                  ) : null}
                  {(iOwe || (stakes.mode === "charity" && stakes.loserId === me.id)) && (
                    <button
                      type="button"
                      onClick={() => onMarkSettled(method)}
                      className={cn(
                        "flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white active:scale-[0.99]",
                        stakes.mode === "charity"
                          ? "bg-violet-600"
                          : "bg-court",
                      )}
                    >
                      <Check className="size-4" strokeWidth={2.5} />
                      {stakes.mode === "charity"
                        ? "I donated — mark complete"
                        : "I paid — mark settled"}
                    </button>
                  )}
                  {iOwe && onRequestExtension ? (
                    <button
                      type="button"
                      onClick={() => setExtOpen((v) => !v)}
                      className="w-full py-1.5 text-center text-[11px] font-semibold text-fg-muted underline-offset-2 hover:underline"
                    >
                      Need more time? Tell us what’s going on
                    </button>
                  ) : null}
                  {extOpen && iOwe ? (
                    <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                      <p className="text-[11px] leading-snug text-fg-muted">
                        Communicate and we can work with you. Silence after a
                        confirmed game can lead to permanent exile.
                      </p>
                      <textarea
                        value={extNote}
                        onChange={(e) => setExtNote(e.target.value)}
                        rows={3}
                        placeholder="What’s going on? When can you settle?"
                        className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-fg outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const r = onRequestExtension?.(extNote);
                          if (r && !r.ok) {
                            setFlash(r.reason ?? "Couldn’t send");
                            return;
                          }
                          setExtOpen(false);
                          setExtNote("");
                          setFlash("Extension posted — community & winner notified");
                          window.setTimeout(() => setFlash(null), 2200);
                        }}
                        className="flex h-10 w-full items-center justify-center rounded-xl bg-fg text-xs font-semibold text-bg"
                      >
                        Request more time
                      </button>
                    </div>
                  ) : null}
                  {flash ? (
                    <p className="text-center text-[11px] font-medium text-success">
                      {flash}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
                    ) : iWon ? (
            <div className="space-y-2 rounded-xl border border-border bg-bg px-3 py-3">
              <p className="text-xs font-semibold text-fg">Waiting on them</p>
              <p className="mt-1 text-[11px] leading-snug text-fg-muted">
                They’ll settle{" "}
                <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatMoney(amount!)}
                </span>{" "}
                privately
                {me.payCashApp || me.payVenmo || me.payZelle
                  ? " using your payment handles."
                  : ". Add Cash App / Venmo / Zelle on your profile so this is seamless next time."}
              </p>
              {stakes.paymentStatus === "extension_requested" && stakes.extensionNote ? (
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-2">
                  <p className="text-[10px] font-bold uppercase text-amber-800 dark:text-amber-200">
                    They asked for more time
                  </p>
                  <p className="mt-0.5 text-[11px] text-fg-muted">
                    “{stakes.extensionNote}”
                  </p>
                </div>
              ) : null}
              {(me.payCashApp || me.payVenmo || me.payZelle) && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {me.payCashApp ? (
                    <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-[10px] font-semibold text-fg">
                      ${me.payCashApp.replace(/^\$/, "")}
                    </span>
                  ) : null}
                  {me.payVenmo ? (
                    <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-[10px] font-semibold text-fg">
                      @{me.payVenmo.replace(/^@/, "")}
                    </span>
                  ) : null}
                  {me.payZelle ? (
                    <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-[10px] font-semibold text-fg">
                      Zelle · {me.payZelle}
                    </span>
                  ) : null}
                </div>
              )}
              <div className="border-t border-border pt-2">
                <p className="text-[10px] leading-snug text-fg-subtle">
                  No pay after a confirmed game = permanent exile from the
                  league. The community is notified. Only report if they truly
                  ghosted payment.
                </p>
                {!reportOpen ? (
                  <button
                    type="button"
                    onClick={() => setReportOpen(true)}
                    className="mt-2 w-full rounded-xl border border-danger/40 py-2.5 text-xs font-semibold text-danger"
                  >
                    They didn’t pay — report & exile
                  </button>
                ) : (
                  <div className="mt-2 space-y-2">
                    <p className="text-[11px] font-medium text-danger">
                      This permanently exiles them and posts to Media for the
                      whole league. Continue?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setReportOpen(false)}
                        className="flex-1 rounded-xl border border-border py-2 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const r = onReportUnpaid?.();
                          if (r && !r.ok) {
                            setFlash(r.reason ?? "Failed");
                            return;
                          }
                          setReportOpen(false);
                          setFlash("Reported — they are exiled. Community notified.");
                        }}
                        className="flex-1 rounded-xl bg-danger py-2 text-xs font-semibold text-white"
                      >
                        Confirm exile
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
) : (
            <p className="text-[11px] text-fg-muted">
              Settlement is between the two players after scores lock.
            </p>
          )}
        </div>
      ) : null}

      <p className="px-3.5 pb-3 text-center text-[9px] text-fg-subtle">
        Private peer settle · Upset City never processes payments
      </p>
    </div>
  );
}

function moneyAmountString(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function moneyOrHandle(s: string) {
  return s;
}

/** Compact list label — green money only, no pill background */
export function StakeChip({ stakes }: { stakes?: Match["stakes"] }) {
  const parts = stakesChipParts(stakes);
  if (!parts) return null;
  const charity = stakes?.mode === "charity";
  return (
    <span className="inline-flex max-w-full items-baseline gap-1.5 text-[11px] font-semibold">
      <span className={charity ? "text-violet-700 dark:text-violet-300" : "text-fg-muted"}>
        {parts.kind}
      </span>
      {parts.money ? (
        <span
          className={cn(
            "tabular-nums tracking-tight",
            charity
              ? "text-[12px] font-bold text-violet-700 dark:text-violet-300"
              : "text-[13px] font-extrabold text-emerald-600 dark:text-emerald-400",
          )}
        >
          {parts.money}
        </span>
      ) : null}
    </span>
  );
}
