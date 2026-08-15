import { useMemo, useState } from "react";
import { Flag, MessageSquare, Swords, X } from "lucide-react";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { namedAustinCourts } from "@/lib/courts/catalog";
import { displayRating } from "@/lib/rating/engine";
import { formatLocalWhen, useUpsetStore } from "@/lib/upset/store";
import type { Player } from "@/lib/upset/types";
import { formatHeightInches } from "@/lib/utils";

export function PlayerProfile({
  player,
  onClose,
  onChallenged,
}: {
  player: Player;
  onClose: () => void;
  onChallenged?: () => void;
}) {
  const store = useUpsetStore();
  const isMe = player.id === store.me.id;
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const courts = useMemo(() => namedAustinCourts(), []);
  const home = courts.find((c) => c.id === player.homeCourtId);
  const held = Object.values(store.courtMeta).filter(
    (m) => m.kingId === player.id,
  ).length;

  /** Already locked in with this player — no challenge option */
  const scheduledWith = useMemo(() => {
    return store.matches.find((m) => {
      if (
        m.status !== "scheduled" &&
        m.status !== "matched" &&
        m.status !== "open"
      )
        return false;
      const a = m.hostId;
      const b = m.opponentId;
      const me = store.me.id;
      // open: only if they host and I somehow joined roster, or mutual pending
      if (m.status === "open") {
        return (
          (a === me && b === player.id) ||
          (a === player.id && b === me) ||
          (a === player.id && (m.rosterIds ?? []).includes(me)) ||
          (a === me && (m.rosterIds ?? []).includes(player.id))
        );
      }
      return (
        (a === me && b === player.id) || (a === player.id && b === me)
      );
    });
  }, [store.matches, store.me.id, player.id]);

  const challenge = () => {
    if (scheduledWith) {
      setStatus("You already have a game scheduled with them.");
      return;
    }
    const court =
      courts.find((c) => c.id === player.homeCourtId) ??
      courts.find((c) => c.id === "cat-battle-bend") ??
      courts[0];
    if (!court) return;
    const r = store.challengePlayer(player.id, {
      courtId: court.id,
      courtName: court.name,
      lat: court.lat,
      lon: court.lon,
      preferredAt: new Date(Date.now() + 3600e3).toISOString(),
      notes: `Challenge from ${store.me.name}`,
    });
    if (r.ok) {
      setStatus("Challenge sent — private if they decline.");
      onChallenged?.();
    } else {
      setStatus(r.reason);
    }
  };

  const send = () => {
    const r = store.sendDm(player.id, msg);
    if (r.ok) {
      setMsg("");
      setStatus("Message sent (request inbox if first contact).");
    } else {
      setStatus(r.reason);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Dismiss"
      />
      <div className="slide-up relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-bg-elevated p-5 shadow-soft sm:rounded-3xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full border border-border text-fg-muted"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-4">
          <PlayerAvatar player={player} size="xl" />
          <div className="min-w-0">
            <h3 className="font-display text-xl font-semibold text-fg">
              {player.name}
              {isMe ? " (you)" : ""}
            </h3>
            <p className="text-sm text-fg-muted">
              @{player.handle} · {player.neighborhood ?? player.city}
            </p>
            {player.exiled ? (
              <p className="mt-1.5 rounded-lg bg-danger/15 px-2 py-1 text-[11px] font-bold text-danger">
                EXILED from the league
                {player.exiledReason ? ` · ${player.exiledReason}` : ""}
              </p>
            ) : (
              <p className="mt-1 text-xs capitalize text-fg-subtle">
                {player.availability}
                {home ? ` · home ${home.name}` : ""}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {(
            [
              ["Rating", String(displayRating(player.rating))],
              ["Record", `${player.wins}–${player.losses}`],
              ["Streak", String(player.streak)],
              ["Height", formatHeightInches(player.heightIn)],
              ["Weight", `${player.weightLb}`],
              ["Exp", `${player.experienceYears}y`],
              ["Sports", `${player.sportsmanship.toFixed(1)}★`],
              ["Show", `${player.reliability.toFixed(1)}★`],
              ["Crowns", String(held)],
            ] as const
          ).map(([l, v]) => (
            <div
              key={l}
              className="rounded-xl border border-border bg-bg-subtle px-2 py-2.5 text-center"
            >
              <p className="text-[10px] font-medium tracking-wide text-fg-subtle uppercase">
                {l}
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-fg">
                {v}
              </p>
            </div>
          ))}
        </div>

        {player.bio && (
          <p className="mt-4 text-sm leading-relaxed text-fg-muted">{player.bio}</p>
        )}

        {/* Private settle handles — only for stakes, never on map */}
        {isMe ? (
          <PayHandlesEditor
            player={player}
            onSave={(h) => {
              store.updateMyPayHandles(h);
              setStatus("Payment handles saved — only used for private settle.");
            }}
          />
        ) : player.payCashApp || player.payVenmo || player.payZelle ? (
          <div className="mt-4 rounded-2xl border border-border bg-bg-subtle px-3.5 py-3">
            <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
              Private settle
            </p>
            <p className="mt-1 text-[11px] text-fg-muted">
              For stakes games only — peer apps, not public on the map.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {player.payCashApp ? (
                <span className="rounded-full bg-bg-elevated px-2.5 py-1 text-[11px] font-semibold text-fg">
                  Cash App ${player.payCashApp.replace(/^\$/, "")}
                </span>
              ) : null}
              {player.payVenmo ? (
                <span className="rounded-full bg-bg-elevated px-2.5 py-1 text-[11px] font-semibold text-fg">
                  Venmo @{player.payVenmo.replace(/^@/, "")}
                </span>
              ) : null}
              {player.payZelle ? (
                <span className="rounded-full bg-bg-elevated px-2.5 py-1 text-[11px] font-semibold text-fg">
                  Zelle {player.payZelle}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {!isMe && (
          <div className="mt-5 space-y-3">
            {scheduledWith ? (
              <div className="rounded-xl border border-court/30 bg-court/10 px-3 py-3">
                <p className="text-sm font-semibold text-fg">
                  Game already scheduled
                </p>
                <p className="mt-0.5 text-xs text-fg-muted">
                  {scheduledWith.courtName}
                  {" · "}
                  {formatLocalWhen(
                    scheduledWith.scheduledAt ?? scheduledWith.preferredAt,
                  )}
                </p>
                <p className="mt-1 text-[11px] text-fg-subtle">
                  Challenge is disabled while you have a locked-in game with
                  them. Cancel that game first if you need to rebook.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={challenge}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-court text-sm font-semibold text-white"
                >
                  <Swords className="size-4" strokeWidth={2} />
                  Challenge
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (msg.trim()) send();
                    else setStatus("Type a message below first.");
                  }}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-bg-subtle text-sm font-semibold text-fg"
                >
                  <MessageSquare className="size-4" strokeWidth={2} />
                  Message
                </button>
              </div>
            )}

            {scheduledWith ? (
              <button
                type="button"
                onClick={() => {
                  if (msg.trim()) send();
                  else setStatus("Type a message below first.");
                }}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-bg-subtle text-sm font-semibold text-fg"
              >
                <MessageSquare className="size-4" strokeWidth={2} />
                Message
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                const isFriend = (store.friendIds ?? []).includes(player.id);
                if (isFriend) {
                  store.removeFriend(player.id);
                  setStatus("Removed from friends.");
                } else {
                  store.addFriend(player.id);
                  setStatus("Added as friend.");
                }
              }}
              className="flex h-10 w-full items-center justify-center rounded-xl border border-border text-sm font-semibold text-fg"
            >
              {(store.friendIds ?? []).includes(player.id)
                ? "Friends — tap to remove"
                : "Add friend"}
            </button>
            <div className="flex gap-2">
              <input
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="First message goes to requests…"
                className="h-11 flex-1 rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg outline-none"
              />
              <button
                type="button"
                onClick={send}
                className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg"
              >
                Send
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  store.blockPlayer(player.id);
                  setStatus("Blocked — removed from catalog and DMs.");
                  onClose();
                }}
                className="h-10 flex-1 rounded-xl border border-border text-xs font-medium text-fg-muted"
              >
                Block
              </button>
              <button
                type="button"
                onClick={() => {
                  store.reportPlayer(player.id, "user report");
                  setStatus("Report filed for review.");
                }}
                className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl border border-border text-xs font-medium text-fg-muted"
              >
                <Flag className="size-3.5" strokeWidth={2} />
                Report
              </button>
            </div>
          </div>
        )}

        {status && (
          <p className="mt-3 text-center text-xs text-fg-muted" role="status">
            {status}
          </p>
        )}
      </div>
    </div>
  );
}

function PayHandlesEditor({
  player,
  onSave,
}: {
  player: Player;
  onSave: (h: {
    payCashApp?: string;
    payVenmo?: string;
    payZelle?: string;
  }) => void;
}) {
  const [cash, setCash] = useState(player.payCashApp?.replace(/^\$/, "") ?? "");
  const [venmo, setVenmo] = useState(player.payVenmo?.replace(/^@/, "") ?? "");
  const [zelle, setZelle] = useState(player.payZelle ?? "");
  const [saved, setSaved] = useState(false);

  return (
    <div className="mt-4 rounded-2xl border border-border bg-bg-subtle px-3.5 py-3">
      <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
        Private settle handles
      </p>
      <p className="mt-1 text-[11px] leading-snug text-fg-muted">
        Cash App, Venmo, Zelle — only used when someone owes you on a stakes
        game. Never shown on the court map.
      </p>
      <div className="mt-2.5 space-y-2">
        <label className="block text-[10px] font-medium text-fg-muted">
          Cash App $cashtag
          <input
            value={cash}
            onChange={(e) => setCash(e.target.value.replace(/^\$/, ""))}
            placeholder="yourcashtag"
            className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-court"
          />
        </label>
        <label className="block text-[10px] font-medium text-fg-muted">
          Venmo username
          <input
            value={venmo}
            onChange={(e) => setVenmo(e.target.value.replace(/^@/, ""))}
            placeholder="username"
            className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-court"
          />
        </label>
        <label className="block text-[10px] font-medium text-fg-muted">
          Zelle (email or phone)
          <input
            value={zelle}
            onChange={(e) => setZelle(e.target.value)}
            placeholder="you@email.com"
            className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-court"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            onSave({
              payCashApp: cash || undefined,
              payVenmo: venmo || undefined,
              payZelle: zelle || undefined,
            });
            setSaved(true);
            window.setTimeout(() => setSaved(false), 1600);
          }}
          className="flex h-10 w-full items-center justify-center rounded-xl bg-fg text-xs font-semibold text-bg"
        >
          {saved ? "Saved" : "Save handles"}
        </button>
      </div>
    </div>
  );
}
