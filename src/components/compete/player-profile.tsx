import { useCallback, useMemo, useRef, useState } from "react";
import { Flag, MessageSquare, Swords, X } from "lucide-react";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { namedAustinCourts } from "@/lib/courts/catalog";
import { displayRating } from "@/lib/rating/engine";
import { applyFriendsAndDms, formatLocalWhen, upsertPlayer, useUpsetStore } from "@/lib/upset/store";
import type { Player } from "@/lib/upset/types";
import { cn, formatHeightInches } from "@/lib/utils";
import { isDemoMode } from "@/lib/config";
import { challengePlayerFn, blockPlayerFn, reportPlayerFn, updatePrivacyFn } from "@/lib/game/fns";
import { addFriendFn, removeFriendFn, sendDmFn } from "@/lib/game/dm-fns";
import { GUEST_PLAYER_ID } from "@/lib/game/guest";
import { mutationError, refreshCompetitiveSnapshot } from "@/lib/game/client-actions";
import { useRequireAuth } from "@/lib/game/use-require-auth";
import { ProfileCompleteForm } from "@/components/compete/profile-complete-form";
import { isProfileComplete, PROFILE_PRIVACY_NOTE } from "@/lib/game/profile";
import { DM_PRIVACY_OPTIONS, type DmPrivacy } from "@/lib/game/privacy";
import { useDialogFocus } from "@/hooks/use-dialog-focus";

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
  const requireAuth = useRequireAuth();
  const live = player.id === store.me.id ? store.me : player;
  const isMe = live.id === store.me.id && store.me.id !== GUEST_PLAYER_ID;
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onClose(), [onClose]);
  useDialogFocus(panelRef, close);
  const courts = useMemo(() => namedAustinCourts(), []);
  const home = courts.find((c) => c.id === player.homeCourtId);

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

  const challenge = async () => {
    if (!requireAuth("challenge")) return;
    if (scheduledWith) {
      setStatus("You already have a game scheduled with them.");
      return;
    }
    const court =
      courts.find((c) => c.id === player.homeCourtId) ??
      courts.find((c) => c.id === "cat-battle-bend") ??
      courts[0];
    if (!court) return;
    if (isDemoMode()) {
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
      return;
    }
    try {
      await challengePlayerFn({
        data: {
          targetId: player.id,
          courtId: court.id,
          courtName: court.name,
          lat: court.lat,
          lon: court.lon,
          preferredAt: new Date(Date.now() + 3600e3).toISOString(),
          notes: `Challenge from ${store.me.name}`,
        },
      });
      await refreshCompetitiveSnapshot();
      setStatus("Challenge sent.");
      onChallenged?.();
    } catch (err) {
      setStatus(mutationError(err));
    }
  };

  const send = async () => {
    if (!requireAuth("message")) return;
    const t = msg.trim();
    if (!t) {
      setStatus("Type a message below first.");
      return;
    }
    try {
      applyFriendsAndDms(
        await sendDmFn({ data: { targetId: player.id, text: t } }),
      );
      setMsg("");
      setStatus("Message sent.");
    } catch (err) {
      setStatus(mutationError(err));
    }
  };

  const toggleFriend = async () => {
    if (!requireAuth("challenge")) return;
    const isFriend = (store.friendIds ?? []).includes(player.id);
    try {
      applyFriendsAndDms(
        isFriend
          ? await removeFriendFn({ data: { targetId: player.id } })
          : await addFriendFn({ data: { targetId: player.id } }),
      );
      setStatus(isFriend ? "Removed from friends." : "Added as friend.");
    } catch (err) {
      setStatus(mutationError(err));
    }
  };

  const block = async () => {
    if (!requireAuth("challenge")) return;
    try {
      await blockPlayerFn({ data: { targetId: player.id } });
      await refreshCompetitiveSnapshot();
      setStatus("Blocked.");
      onClose();
    } catch (err) {
      setStatus(mutationError(err));
    }
  };

  const report = async () => {
    if (!requireAuth("challenge")) return;
    try {
      await reportPlayerFn({
        data: { targetId: player.id, reason: "user report" },
      });
      setStatus("Report filed for review.");
    } catch (err) {
      setStatus(mutationError(err));
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        onClick={close}
        aria-label="Dismiss"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-profile-title"
        className="slide-up relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-bg-elevated p-5 shadow-soft sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full border border-border text-fg-muted"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-4">
          <PlayerAvatar player={player} size="xl" />
          <div className="min-w-0">
            <h3 id="player-profile-title" className="font-display text-xl font-semibold text-fg">
              {player.name}
              {isMe ? " (you)" : ""}
            </h3>
            <p className="text-sm text-fg-muted">
              @{player.handle} · {player.neighborhood ?? player.city}
            </p>
            <p className="mt-1 text-xs capitalize text-fg-subtle">
                {player.availability}
                {home ? ` · home ${home.name}` : ""}
              </p>
          </div>
        </div>

        {isMe && !isProfileComplete(live) ? (
          <div className="mt-5 rounded-2xl border border-border bg-bg-subtle p-4">
            <ProfileCompleteForm me={live} />
          </div>
        ) : null}

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
              ["Games", String(player.gamesPlayed)],
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

        {isMe && isProfileComplete(live) ? (
          <p className="mt-3 text-[11px] leading-relaxed text-fg-subtle">
            {PROFILE_PRIVACY_NOTE}
          </p>
        ) : null}

        {isMe ? <PrivacyAndDiscovery me={live} /> : null}

        {player.bio && (
          <p className="mt-4 text-sm leading-relaxed text-fg-muted">{player.bio}</p>
        )}

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
                  onClick={() => void challenge()}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-court text-sm font-semibold text-white"
                >
                  <Swords className="size-4" strokeWidth={2} />
                  Challenge
                </button>
                <button
                  type="button"
                  onClick={() => void send()}
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
              onClick={() => void toggleFriend()}
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
                placeholder="Send a direct message…"
                className="h-11 flex-1 rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg outline-none"
              />
              <button
                type="button"
                onClick={() => void send()}
                className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg"
              >
                Send
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void block()}
                className="h-10 flex-1 rounded-xl border border-border text-xs font-medium text-fg-muted"
              >
                Block
              </button>
              <button
                type="button"
                onClick={() => void report()}
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

function PrivacyAndDiscovery({ me }: { me: Player }) {
  const [dmPrivacy, setDmPrivacy] = useState<DmPrivacy>(me.dmPrivacy);
  const [hideFromCatalog, setHideFromCatalog] = useState(me.hideFromCatalog);
  const [openToChallenges, setOpenToChallenges] = useState(me.openToChallenges);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const save = async (next: {
    dmPrivacy: DmPrivacy;
    hideFromCatalog: boolean;
    openToChallenges: boolean;
  }) => {
    setBusy(true);
    setNote(null);
    try {
      const saved = await updatePrivacyFn({ data: next });
      upsertPlayer(saved);
      setNote("Saved.");
    } catch (err) {
      setNote(mutationError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-5 space-y-3 rounded-2xl border border-border bg-bg-subtle p-4">
      <div>
        <h4 className="text-sm font-semibold text-fg">Privacy and discovery</h4>
        <p className="mt-0.5 text-[11px] text-fg-muted">
          Only you can change these. Other players never see your age, gender, or ethnicity.
        </p>
      </div>
      <div>
        <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
          Direct messages
        </p>
        <div className="mt-1.5 flex flex-col gap-1.5">
          {DM_PRIVACY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={busy}
              onClick={() => {
                setDmPrivacy(opt.id);
                void save({
                  dmPrivacy: opt.id,
                  hideFromCatalog,
                  openToChallenges,
                });
              }}
              className={cn(
                "rounded-xl border px-3 py-2 text-left",
                dmPrivacy === opt.id
                  ? "border-court bg-court/10"
                  : "border-border bg-bg",
              )}
              aria-pressed={dmPrivacy === opt.id}
            >
              <span className="block text-[13px] font-semibold text-fg">{opt.label}</span>
              <span className="block text-[11px] text-fg-muted">{opt.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-start gap-2.5 text-[13px] text-fg">
        <input
          type="checkbox"
          checked={!hideFromCatalog}
          disabled={busy}
          onChange={(e) => {
            const next = !e.target.checked;
            setHideFromCatalog(next);
            void save({ dmPrivacy, hideFromCatalog: next, openToChallenges });
          }}
        />
        <span>
          Show me in player discovery
          <span className="mt-0.5 block text-[11px] text-fg-muted">
            Off hides you from the catalog and Match Mode.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2.5 text-[13px] text-fg">
        <input
          type="checkbox"
          checked={openToChallenges}
          disabled={busy}
          onChange={(e) => {
            setOpenToChallenges(e.target.checked);
            void save({
              dmPrivacy,
              hideFromCatalog,
              openToChallenges: e.target.checked,
            });
          }}
        />
        <span>
          Open to challenges
          <span className="mt-0.5 block text-[11px] text-fg-muted">
            Off blocks new direct challenges. Existing games stay.
          </span>
        </span>
      </label>
      {note ? <p className="text-[11px] text-fg-muted">{note}</p> : null}
    </section>
  );
}
