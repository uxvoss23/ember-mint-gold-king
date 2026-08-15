import { useMemo, useState } from "react";
import {
  ChevronLeft,
  MapPin,
  Plus,
  Swords,
  Users,
  X,
} from "lucide-react";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { namedAustinCourts } from "@/lib/courts/catalog";
import {
  useSquads,
  type Squad,
  type SquadSize,
} from "@/lib/upset/squads";
import type { Player } from "@/lib/upset/types";
import { displayRating } from "@/lib/rating/engine";
import { cn, formatHeightInches } from "@/lib/utils";

const LOGOS = ["🏀", "🔥", "⚡", "👑", "🐺", "🦅", "💪", "🌟", "🎯", "🖤", "🧡", "🟢"];

interface SquadsHubProps {
  me: Player;
  players: Player[];
}

export function SquadsHub({ me, players }: SquadsHubProps) {
  const store = useSquads();
  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  );
  const mySquad =
    store.squads.find((s) => s.id === store.mySquadId) ??
    store.squads.find((s) => s.captainId === me.id) ??
    store.squads.find((s) =>
      s.members.some((m) => m.playerId === me.id && m.status === "active"),
    );

  const [creating, setCreating] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [challengeTarget, setChallengeTarget] = useState<Squad | null>(null);

  if (creating) {
    return (
      <CreateSquad
        me={me}
        onCancel={() => setCreating(false)}
        onCreated={() => setCreating(false)}
      />
    );
  }

  if (!mySquad) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-court uppercase">
            Squads
          </p>
          <h3 className="font-display text-lg font-semibold text-fg">
            Build your team
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-fg-muted">
            Create a 3- or 5-player squad, pick a logo and home court, then
            challenge other Austin crews.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-court text-sm font-semibold text-white"
        >
          <Plus className="size-4" strokeWidth={2} />
          Create a squad
        </button>

        <OtherSquadsPreview squads={store.squads.slice(0, 3)} />
      </div>
    );
  }

  const activeMembers = mySquad.members.filter((m) => m.status === "active");
  const invited = mySquad.members.filter((m) => m.status === "invited");
  const spotsLeft = mySquad.size - activeMembers.length - invited.length;
  const others = store.squads.filter((s) => s.id !== mySquad.id);

  const myChallenges = store.challenges.filter(
    (c) => c.fromSquadId === mySquad.id || c.toSquadId === mySquad.id,
  );

  return (
    <div className="space-y-4">
      {/* Squad header card */}
      <div className="rounded-2xl border border-border bg-bg-elevated p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-bg-subtle text-3xl">
            {mySquad.logo}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-semibold text-fg">
              {mySquad.name}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-fg-muted">
              <MapPin className="size-3" strokeWidth={1.75} />
              {mySquad.homeCourtName}
            </p>
            <p className="mt-1 text-xs text-fg-subtle">
              {mySquad.size}-man · {mySquad.record.wins}W–{mySquad.record.losses}L
              · captain
            </p>
          </div>
        </div>
      </div>

      {/* Roster */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
            Roster · {activeMembers.length}/{mySquad.size}
          </p>
          {spotsLeft > 0 && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="text-xs font-semibold text-court"
            >
              + Invite
            </button>
          )}
        </div>
        <div className="space-y-2">
          {activeMembers.map((m) => {
            const p = playerMap.get(m.playerId);
            if (!p) return null;
            return (
              <div
                key={m.playerId}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-3 py-2.5",
                  m.playerId === me.id
                    ? "border-court/40 bg-court-soft"
                    : "border-border bg-bg-elevated",
                )}
              >
                <PlayerAvatar player={p} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">
                    {p.name}
                    {m.role === "captain" ? " · C" : ""}
                    {m.playerId === me.id ? " · you" : ""}
                  </p>
                  <p className="text-[11px] text-fg-muted">
                    {displayRating(p.rating)} · {formatHeightInches(p.heightIn)}
                  </p>
                </div>
              </div>
            );
          })}
          {invited.map((m) => {
            const p = playerMap.get(m.playerId);
            if (!p) return null;
            return (
              <div
                key={m.playerId}
                className="flex items-center gap-2.5 rounded-xl border border-dashed border-border-strong px-3 py-2.5"
              >
                <PlayerAvatar player={p} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">{p.name}</p>
                  <p className="text-[11px] text-fg-muted">Invite pending</p>
                </div>
              </div>
            );
          })}
          {Array.from({ length: Math.max(0, spotsLeft) }).map((_, i) => (
            <button
              key={`open-${i}`}
              type="button"
              onClick={() => setInviteOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-border-strong px-3 py-2.5 text-left"
            >
              <div className="flex size-9 items-center justify-center rounded-full border border-dashed border-border-strong text-fg-subtle">
                <Users className="size-4" strokeWidth={1.5} />
              </div>
              <span className="text-sm text-fg-muted">Open roster spot</span>
            </button>
          ))}
        </div>
      </div>

      {/* Challenges out/in */}
      {myChallenges.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
            Challenges
          </p>
          {myChallenges.slice(0, 5).map((c) => {
            const from = store.squads.find((s) => s.id === c.fromSquadId);
            const to = store.squads.find((s) => s.id === c.toSquadId);
            const isIncoming = c.toSquadId === mySquad.id;
            const other = isIncoming ? from : to;
            if (!other) return null;
            return (
              <div
                key={c.id}
                className="rounded-xl border border-border bg-bg-elevated px-3 py-2.5"
              >
                <p className="text-sm font-semibold text-fg">
                  {other.logo} {other.name}
                </p>
                <p className="text-[11px] text-fg-muted">
                  {isIncoming ? "Challenged you" : "You challenged them"} ·{" "}
                  {c.status}
                  {c.courtName ? ` · ${c.courtName}` : ""}
                </p>
                {isIncoming && c.status === "pending" && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => store.respondChallenge(c.id, "declined")}
                      className="h-9 rounded-xl border border-border text-xs font-semibold text-fg-muted"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => store.respondChallenge(c.id, "accepted")}
                      className="h-9 rounded-xl bg-court text-xs font-semibold text-white"
                    >
                      Accept
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Challenge other squads */}
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Challenge a squad
        </p>
        {others.map((sq) => (
          <div
            key={sq.id}
            className="flex items-center gap-3 rounded-2xl border border-border bg-bg-elevated p-3"
          >
            <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-bg-subtle text-2xl">
              {sq.logo}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">{sq.name}</p>
              <p className="text-[11px] text-fg-muted">
                {sq.size}-man · {sq.record.wins}W–{sq.record.losses}L ·{" "}
                {sq.homeCourtName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setChallengeTarget(sq)}
              className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-fg"
            >
              Challenge
            </button>
          </div>
        ))}
      </div>

      {inviteOpen && (
        <InviteRosterSheet
          squad={mySquad}
          me={me}
          players={players}
          onInvite={(id) => {
            store.inviteMember(mySquad.id, id);
          }}
          onClose={() => setInviteOpen(false)}
        />
      )}

      {challengeTarget && (
        <ChallengeModal
          mine={mySquad}
          target={challengeTarget}
          onConfirm={() => {
            store.challengeSquad(
              mySquad.id,
              challengeTarget.id,
              mySquad.homeCourtName,
            );
            setChallengeTarget(null);
          }}
          onClose={() => setChallengeTarget(null)}
        />
      )}
    </div>
  );
}

function CreateSquad({
  me,
  onCancel,
  onCreated,
}: {
  me: Player;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const createSquad = useSquads((s) => s.createSquad);
  const courts = useMemo(() => namedAustinCourts(), []);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState(LOGOS[0]);
  const [size, setSize] = useState<SquadSize>(5);
  const [courtId, setCourtId] = useState(courts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const court = courts.find((c) => c.id === courtId) ?? courts[0];

  const submit = () => {
    const n = name.trim();
    if (n.length < 2) {
      setError("Give your squad a name.");
      return;
    }
    if (!court) {
      setError("Pick a home court.");
      return;
    }
    createSquad({
      name: n,
      logo,
      size,
      homeCourtId: court.id,
      homeCourtName: court.name,
      captainId: me.id,
    });
    onCreated();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex size-9 items-center justify-center rounded-full border border-border bg-bg-elevated text-fg-muted"
          aria-label="Back"
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
        </button>
        <h3 className="font-display text-lg font-semibold text-fg">
          Create squad
        </h3>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Team name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Southside 5"
          maxLength={24}
          className="h-12 w-full rounded-2xl border border-border bg-bg-elevated px-4 text-sm text-fg outline-none focus:border-border-strong"
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Logo
        </p>
        <div className="flex flex-wrap gap-2">
          {LOGOS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLogo(l)}
              className={cn(
                "flex size-11 items-center justify-center rounded-xl border text-xl",
                logo === l
                  ? "border-court bg-court-soft ring-2 ring-court/30"
                  : "border-border bg-bg-elevated",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Squad size
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { n: 3 as SquadSize, label: "3 players", blurb: "3v3 crew" },
              { n: 5 as SquadSize, label: "5 players", blurb: "Full team" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.n}
              type="button"
              onClick={() => setSize(opt.n)}
              className={cn(
                "rounded-2xl border p-3 text-left",
                size === opt.n
                  ? "border-court bg-court-soft"
                  : "border-border bg-bg-elevated",
              )}
            >
              <p className="text-sm font-semibold text-fg">{opt.label}</p>
              <p className="text-[11px] text-fg-muted">{opt.blurb}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Home court
        </p>
        <div className="max-h-40 space-y-1.5 overflow-y-auto">
          {courts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCourtId(c.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm",
                courtId === c.id
                  ? "border-court bg-court-soft font-semibold text-fg"
                  : "border-border bg-bg-elevated text-fg-muted",
              )}
            >
              <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-border bg-bg-subtle p-3">
        <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-bg-elevated text-2xl">
          {logo}
        </div>
        <div>
          <p className="text-sm font-semibold text-fg">
            {name.trim() || "Your squad"}
          </p>
          <p className="text-xs text-fg-muted">
            {size}-man · {court?.name ?? "Home court"} · you captain
          </p>
        </div>
      </div>

      {error && (
        <p className="text-center text-xs text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-court text-sm font-semibold text-white"
      >
        Create squad
      </button>
    </div>
  );
}

function InviteRosterSheet({
  squad,
  me,
  players,
  onInvite,
  onClose,
}: {
  squad: Squad;
  me: Player;
  players: Player[];
  onInvite: (id: string) => void;
  onClose: () => void;
}) {
  const taken = new Set(squad.members.map((m) => m.playerId));
  const candidates = players
    .filter((p) => p.id !== me.id && !taken.has(p.id) && p.city === "Austin")
    .sort((a, b) => b.rating - a.rating);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[80dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-bg-elevated shadow-soft sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display text-base font-semibold text-fg">
            Fill roster
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full border border-border text-fg-muted"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {candidates.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-bg-subtle px-3 py-2.5"
            >
              <PlayerAvatar player={p} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-fg">{p.name}</p>
                <p className="text-[11px] text-fg-muted">
                  {displayRating(p.rating)} · {formatHeightInches(p.heightIn)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onInvite(p.id)}
                className="rounded-full bg-court px-3 py-1.5 text-[11px] font-semibold text-white"
              >
                Invite
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChallengeModal({
  mine,
  target,
  onConfirm,
  onClose,
}: {
  mine: Squad;
  target: Squad;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl border border-border bg-bg-elevated p-5 shadow-soft sm:rounded-3xl">
        <p className="text-[11px] font-semibold tracking-wide text-court uppercase">
          Challenge
        </p>
        <h3 className="mt-1 font-display text-lg font-semibold text-fg">
          {mine.logo} {mine.name}{" "}
          <span className="text-fg-muted">vs</span> {target.logo} {target.name}
        </h3>
        <p className="mt-2 text-sm text-fg-muted">
          {mine.size}-man vs {target.size}-man · proposed at your home court (
          {mine.homeCourtName}). They’ll accept or decline.
        </p>
        {mine.size !== target.size && (
          <p className="mt-2 text-xs text-fg-subtle">
            Different roster sizes — agree on rules when you both show.
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-border text-sm font-semibold text-fg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-court text-sm font-semibold text-white"
          >
            <Swords className="size-4" strokeWidth={2} />
            Send challenge
          </button>
        </div>
      </div>
    </div>
  );
}

function OtherSquadsPreview({ squads }: { squads: Squad[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
        Squads already running Austin
      </p>
      {squads.map((sq) => (
        <div
          key={sq.id}
          className="flex items-center gap-3 rounded-2xl border border-border bg-bg-elevated p-3 opacity-90"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-bg-subtle text-xl">
            {sq.logo}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">{sq.name}</p>
            <p className="text-[11px] text-fg-muted">
              {sq.record.wins}W–{sq.record.losses}L · {sq.homeCourtName}
            </p>
          </div>
        </div>
      ))}
      <p className="text-center text-[11px] text-fg-subtle">
        Create yours to challenge them
      </p>
    </div>
  );
}
