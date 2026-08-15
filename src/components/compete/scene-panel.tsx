import { useMemo, useState } from "react";
import {
  Calendar,
  Check,
  Clock,
  Swords,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import { namedAustinCourts } from "@/lib/courts/catalog";
import { displayRating, handicapLine } from "@/lib/rating/engine";
import {
  formatLocalWhen,
  useUpsetStore,
} from "@/lib/upset/store";
import type { Match, Player } from "@/lib/upset/types";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { PlayerCatalog } from "@/components/compete/player-catalog";
import { PlayerChip } from "@/components/compete/player-chip";
import { PlayerProfile } from "@/components/compete/player-profile";
import { cn, formatHeightInches } from "@/lib/utils";

type SceneTab = "ladder" | "pending" | "scheduled" | "quick" | "catalog" | "messages";

export function ScenePanel({
  onQuickAtCourt,
}: {
  onQuickAtCourt?: (courtId: string) => void;
}) {
  const [tab, setTab] = useState<SceneTab>("pending");
  const store = useUpsetStore();
  const [selected, setSelected] = useState<Player | null>(null);
  const [matchDetail, setMatchDetail] = useState<Match | null>(null);
  const [raceMsg, setRaceMsg] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-bg-elevated p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-court-soft text-court">
            <Swords className="size-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-fg">
              Austin 1v1 scene
            </h2>
            <p className="mt-0.5 text-sm leading-relaxed text-fg-muted">
              Rated best-of-3. Crowns on courts. Quick Match broadcasts — not a
              queue.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-bg-subtle p-3">
          <PlayerAvatar player={store.me} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-fg">{store.me.name}</p>
            <p className="text-xs text-fg-muted">
              {displayRating(store.me.rating)} ·{" "}
              {formatHeightInches(store.me.heightIn)} ·{" "}
              {store.me.sportsmanship.toFixed(1)}★ sports ·{" "}
              {store.me.reliability.toFixed(1)}★ show
            </p>
          </div>
          <div className="text-right text-xs text-fg-subtle">
            <p className="font-medium text-fg-muted">
              {store.me.wins}W–{store.me.losses}L
            </p>
            <p className="capitalize">{store.me.availability}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-full border border-border bg-bg-elevated p-1 no-scrollbar">
        {(
          [
            { id: "pending" as const, label: "Pending", icon: Users },
            { id: "scheduled" as const, label: "Scheduled", icon: Calendar },
            { id: "quick" as const, label: "Quick Match", icon: Zap },
            { id: "catalog" as const, label: "Players", icon: Users },
            { id: "messages" as const, label: "Messages", icon: Users },
            { id: "ladder" as const, label: "Ladder", icon: Trophy },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-semibold transition-colors",
              tab === t.id ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            <t.icon className="size-3.5" strokeWidth={2} />
            {t.label}
          </button>
        ))}
      </div>

      {raceMsg && (
        <div className="rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm text-fg-muted">
          {raceMsg}
        </div>
      )}

      {tab === "ladder" && (
        <Ladder
          players={store.leaderboard}
          meId={store.me.id}
          onSelect={setSelected}
        />
      )}
      {tab === "pending" && (
        <PendingList
          matches={store.openMatches}
          players={store.players}
          meId={store.me.id}
          onAccept={(id) => {
            const r = store.tryAcceptRace(id);
            if (r === "filled") {
              setRaceMsg(
                "That one just filled — here are other open games near you.",
              );
            } else {
              setRaceMsg(null);
              const m = store.matches.find((x) => x.id === id);
              if (m) setMatchDetail({ ...m, status: "scheduled", opponentId: store.me.id });
            }
          }}
          onOpen={setMatchDetail}
          onCancel={(id) => {
            store.cancelMatch(id, "Cancelled from open games list.");
          }}
        />
      )}
      {tab === "scheduled" && (
        <ScheduledList
          matches={store.scheduledMatches}
          players={store.players}
          meId={store.me.id}
          onOpen={setMatchDetail}
          onPredict={store.predict}
          onComment={store.commentOnMatch}
        />
      )}
      
      {tab === "catalog" && (
        <PlayerCatalog
          players={store.catalogPlayers}
          onOpen={setSelected}
          onChallenge={(p) => {
            setSelected(p);
          }}
        />
      )}
      {tab === "messages" && (
        <MessagesPanel
          threads={store.dmThreads}
          players={store.players}
          meId={store.me.id}
          onOpenPlayer={(id) => {
            const p = store.playerById(id);
            if (p) setSelected(p);
          }}
          onAccept={store.acceptDmRequest}
          onSend={store.sendDm}
        />
      )}

      {tab === "quick" && (
        <QuickMatchForm
          me={store.me}
          onCreate={(input) => {
            store.createQuickMatch(input);
            setTab("pending");
          }}
        />
      )}

      {selected && (
        <PlayerProfile
          player={selected}
          onClose={() => setSelected(null)}
          onChallenged={() => setTab("pending")}
        />
      )}
      {matchDetail && (
        <MatchSheet
          match={store.matches.find((m) => m.id === matchDetail.id) ?? matchDetail}
          meId={store.me.id}
          players={store.players}
          onClose={() => setMatchDetail(null)}
          onEnterScore={store.enterScore}
          onConfirm={store.confirmScore}
          onPredict={store.predict}
          onComment={store.commentOnMatch}
        />
      )}
    </div>
  );
}

function Ladder({
  players,
  meId,
  onSelect,
}: {
  players: Player[];
  meId: string;
  onSelect: (p: Player) => void;
}) {
  return (
    <div className="space-y-2">
      {players.map((p, i) => {
        const isMe = p.id === meId;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left",
              isMe
                ? "border-court/40 bg-court-soft"
                : "border-border bg-bg-elevated hover:border-border-strong",
            )}
          >
            <span
              className={cn(
                "w-6 text-center text-sm font-semibold tabular-nums",
                i < 3 ? "text-court" : "text-fg-subtle",
              )}
            >
              {i + 1}
            </span>
            <PlayerChip
              player={p}
              onOpen={onSelect}
              size="sm"
              subtitle={`${formatHeightInches(p.heightIn)} · ${p.availability}${isMe ? " · you" : ""}`}
            />
            <div className="hidden" />
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums text-fg">
                {displayRating(p.rating)}
              </p>
              <p className="text-[11px] text-fg-subtle">
                {p.wins}W–{p.losses}L
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PendingList({
  matches,
  players,
  meId,
  onAccept,
  onOpen,
  onCancel,
}: {
  matches: Match[];
  players: Player[];
  meId: string;
  onAccept: (id: string) => void;
  onOpen: (m: Match) => void;
  onCancel: (id: string) => void;
}) {
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-bg-elevated px-6 py-12 text-center">
        <Users className="mx-auto size-8 text-fg-subtle" strokeWidth={1.5} />
        <h3 className="mt-3 font-display text-base font-semibold text-fg">
          No open games
        </h3>
        <p className="mt-1 text-sm text-fg-muted">
          Nobody’s free right now. Post a Quick Match for tonight — 6 players
          nearby usually run weekday evenings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map((g) => {
        const host = byId.get(g.hostId);
        const isHost = g.hostId === meId;
        return (
          <div key={g.id} className="rounded-2xl border border-border bg-bg-elevated p-4">
            <button type="button" className="w-full text-left" onClick={() => onOpen(g)}>
              <div className="flex items-start gap-3">
                {host && <PlayerAvatar player={host} size="sm" />}
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold text-fg">
                    {g.courtName}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
                    <Clock className="size-3" strokeWidth={2} />
                    {formatLocalWhen(g.preferredAt)}
                  </p>
                  <p className="mt-1 text-xs text-fg-subtle">
                    {host?.name} · {host ? displayRating(host.rating) : "—"} ·{" "}
                    {host ? formatHeightInches(host.heightIn) : ""}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip>
                  {formatHeightInches(g.filters.heightMinIn)}–
                  {formatHeightInches(g.filters.heightMaxIn)}
                </Chip>
                <Chip>
                  {g.filters.ratingMin}–{g.filters.ratingMax}
                </Chip>
                <Chip>{g.filters.sportsmanshipMin.toFixed(1)}★+</Chip>
              </div>
              {g.notes && (
                <p className="mt-2 text-xs text-fg-muted">{g.notes}</p>
              )}
            </button>
            <div className="mt-3">
              {isHost ? (
                <button
                  type="button"
                  onClick={() => onCancel(g.id)}
                  className="h-10 w-full rounded-xl border border-border text-sm font-medium text-fg-muted"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onAccept(g.id)}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-fg"
                >
                  <Check className="size-4" strokeWidth={2} />
                  Accept
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScheduledList({
  matches,
  players,
  meId,
  onOpen,
  onPredict,
  onComment,
}: {
  matches: Match[];
  players: Player[];
  meId: string;
  onOpen: (m: Match) => void;
  onPredict: (id: string, winnerId: string) => void;
  onComment: (id: string, text: string) => void;
}) {
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-bg-elevated px-6 py-12 text-center">
        <Calendar className="mx-auto size-8 text-fg-subtle" strokeWidth={1.5} />
        <h3 className="mt-3 font-display text-base font-semibold text-fg">
          No scheduled games
        </h3>
        <p className="mt-1 text-sm text-fg-muted">
          When two players lock a time, it shows up here for the city to follow.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map((g) => {
        const a = byId.get(g.hostId);
        const b = g.opponentId ? byId.get(g.opponentId) : undefined;
        const myPick = g.predictions[meId];
        return (
          <div key={g.id} className="rounded-2xl border border-border bg-bg-elevated p-4">
            <button type="button" className="w-full text-left" onClick={() => onOpen(g)}>
              <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
                {formatLocalWhen(g.scheduledAt ?? g.preferredAt)}
              </p>
              <p className="mt-1 font-display text-sm font-semibold text-fg">
                {a?.name ?? "?"} vs {b?.name ?? "TBD"}
              </p>
              <p className="mt-0.5 text-xs text-fg-muted">{g.courtName}</p>
              {a && b && (
                <p className="mt-2 text-xs text-fg-subtle">
                  {displayRating(a.rating)} · {formatHeightInches(a.heightIn)} vs{" "}
                  {displayRating(b.rating)} · {formatHeightInches(b.heightIn)}
                </p>
              )}
            </button>
            {a && b && g.status === "scheduled" && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onPredict(g.id, a.id)}
                  className={cn(
                    "flex-1 rounded-xl border py-2 text-xs font-semibold",
                    myPick === a.id
                      ? "border-court bg-court-soft text-fg"
                      : "border-border text-fg-muted",
                  )}
                >
                  {a.name.split(" ")[0]}
                </button>
                <button
                  type="button"
                  onClick={() => onPredict(g.id, b.id)}
                  className={cn(
                    "flex-1 rounded-xl border py-2 text-xs font-semibold",
                    myPick === b.id
                      ? "border-court bg-court-soft text-fg"
                      : "border-border text-fg-muted",
                  )}
                >
                  {b.name.split(" ")[0]}
                </button>
              </div>
            )}
            <p className="mt-2 text-[11px] text-fg-subtle">
              {Object.keys(g.predictions).length} prediction
              {Object.keys(g.predictions).length === 1 ? "" : "s"} ·{" "}
              {g.comments.length} comment{g.comments.length === 1 ? "" : "s"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function QuickMatchForm({
  me,
  onCreate,
}: {
  me: Player;
  onCreate: (input: {
    courtId: string;
    courtName: string;
    lat: number;
    lon: number;
    preferredAt: string;
    notes?: string;
    filters: Match["filters"];
  }) => void;
}) {
  const courts = useMemo(() => namedAustinCourts(), []);
  const [courtId, setCourtId] = useState(
    () => courts.find((c) => c.id === "cat-battle-bend")?.id ?? courts[0]?.id ?? "",
  );
  const [whenMode, setWhenMode] = useState<"now" | "later">("now");
  const [when, setWhen] = useState(() => nextFridayLocal());
  const [hMinFt, setHMinFt] = useState(6);
  const [hMinIn, setHMinIn] = useState(0);
  const [hMaxFt, setHMaxFt] = useState(6);
  const [hMaxIn, setHMaxIn] = useState(9);
  const [ratingMin, setRatingMin] = useState(1500);
  const [ratingMax, setRatingMax] = useState(2000);
  const [sportsMin, setSportsMin] = useState(4);
  const [radius, setRadius] = useState(15);
  const [notes, setNotes] = useState("Best of 3 games · to 11 · win by 2 · call your own fouls");

  const court = courts.find((c) => c.id === courtId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!court) return;
    const preferredAt =
      whenMode === "now"
        ? new Date(Date.now() + 20 * 60e3).toISOString()
        : new Date(when).toISOString();
    onCreate({
      courtId: court.id,
      courtName: court.name,
      lat: court.lat,
      lon: court.lon,
      preferredAt,
      notes: notes.trim() || undefined,
      filters: {
        heightMinIn: hMinFt * 12 + hMinIn,
        heightMaxIn: hMaxFt * 12 + hMaxIn,
        ratingMin,
        ratingMax,
        sportsmanshipMin: sportsMin,
        radiusMiles: radius,
      },
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-bg-elevated p-4">
      <p className="text-sm text-fg-muted">
        Right now is the default. Broadcast goes to eligible players within your
        radius — first accept wins.
      </p>

      <div className="flex gap-1 rounded-full border border-border bg-bg-subtle p-1">
        <button
          type="button"
          onClick={() => setWhenMode("now")}
          className={cn(
            "flex-1 rounded-full py-2 text-xs font-semibold",
            whenMode === "now" ? "bg-accent text-accent-fg" : "text-fg-muted",
          )}
        >
          Right now
        </button>
        <button
          type="button"
          onClick={() => setWhenMode("later")}
          className={cn(
            "flex-1 rounded-full py-2 text-xs font-semibold",
            whenMode === "later" ? "bg-accent text-accent-fg" : "text-fg-muted",
          )}
        >
          Schedule
        </button>
      </div>

      <div>
        <label className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Preferred court
        </label>
        <select
          value={courtId}
          onChange={(e) => setCourtId(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg"
        >
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {whenMode === "later" && (
        <div>
          <label className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
            When
          </label>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg"
            required
          />
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Height range
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <HeightPick label="Min" ft={hMinFt} inch={hMinIn} onFt={setHMinFt} onIn={setHMinIn} />
          <HeightPick label="Max" ft={hMaxFt} inch={hMaxIn} onFt={setHMaxFt} onIn={setHMaxIn} />
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1 text-[10px] font-medium text-fg-subtle uppercase">Rating min</p>
          <input
            type="number"
            value={ratingMin}
            step={50}
            onChange={(e) => setRatingMin(Number(e.target.value))}
            className="h-11 w-full rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg"
          />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium text-fg-subtle uppercase">Rating max</p>
          <input
            type="number"
            value={ratingMax}
            step={50}
            onChange={(e) => setRatingMax(Number(e.target.value))}
            className="h-11 w-full rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Sportsmanship · {sportsMin.toFixed(1)}★+ · radius {radius} mi
        </label>
        <input
          type="range"
          min={3}
          max={5}
          step={0.1}
          value={sportsMin}
          onChange={(e) => setSportsMin(Number(e.target.value))}
          className="mt-2 w-full accent-[var(--color-court)]"
        />
        <input
          type="range"
          min={5}
          max={25}
          step={1}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="mt-2 w-full accent-[var(--color-court)]"
        />
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-xl border border-border bg-bg-subtle px-3 py-2.5 text-sm text-fg"
      />

      <button
        type="submit"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-court text-sm font-semibold text-white"
      >
        <Zap className="size-4" strokeWidth={2} />
        Broadcast Quick Match
      </button>
    </form>
  );
}

function MatchSheet({
  match,
  meId,
  players,
  onClose,
  onEnterScore,
  onConfirm,
  onPredict,
  onComment,
}: {
  match: Match;
  meId: string;
  players: Player[];
  onClose: () => void;
  onEnterScore: (id: string, scores: { a: number; b: number }[]) => void;
  onConfirm: (id: string, dispute?: boolean) => void;
  onPredict: (id: string, winnerId: string) => void;
  onComment: (id: string, text: string) => void;
}) {
  const host = players.find((p) => p.id === match.hostId);
  const opp = match.opponentId
    ? players.find((p) => p.id === match.opponentId)
    : undefined;
  const isParty = match.hostId === meId || match.opponentId === meId;
  const [g1a, setG1a] = useState(11);
  const [g1b, setG1b] = useState(7);
  const [g2a, setG2a] = useState(11);
  const [g2b, setG2b] = useState(9);
  const [comment, setComment] = useState("");

  const line =
    host && opp
      ? handicapLine(
          meId === host.id ? host.rating : opp.rating,
          meId === host.id ? opp.rating : host.rating,
        )
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-bg/70 backdrop-blur-sm" onClick={onClose} />
      <div className="slide-up relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-bg-elevated p-5 shadow-soft sm:rounded-3xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full border border-border text-fg-muted"
        >
          <X className="size-4" />
        </button>

        <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          {match.status.replace("_", " ")} · {formatLocalWhen(match.scheduledAt ?? match.preferredAt)}
        </p>
        <h3 className="mt-1 font-display text-xl font-semibold text-fg">
          {host?.name ?? "?"} vs {opp?.name ?? "waiting…"}
        </h3>
        <p className="text-sm text-fg-muted">{match.courtName}</p>

        {host && opp && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <PlayerStatCard player={host} />
            <PlayerStatCard player={opp} />
          </div>
        )}

        {line && isParty && (
          <p className="mt-3 rounded-xl border border-border bg-bg-subtle px-3 py-2 text-sm text-fg-muted">
            {line.display}
          </p>
        )}

        {match.status === "scheduled" && host && opp && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-fg-subtle uppercase">Pick a winner</p>
            <div className="flex gap-2">
              {[host, opp].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPredict(match.id, p.id)}
                  className={cn(
                    "flex-1 rounded-xl border py-2.5 text-xs font-semibold",
                    match.predictions[meId] === p.id
                      ? "border-court bg-court-soft"
                      : "border-border text-fg-muted",
                  )}
                >
                  {p.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {isParty && (match.status === "scheduled" || match.status === "matched") && (
          <div className="mt-4 space-y-2 rounded-xl border border-border bg-bg-subtle p-3">
            <p className="text-xs font-medium text-fg-subtle uppercase">
              Enter score (winner submits)
            </p>
            <p className="text-[11px] text-fg-muted">You = left column</p>
            <div className="grid grid-cols-2 gap-2">
              <ScorePair label="Game 1" a={g1a} b={g1b} setA={setG1a} setB={setG1b} />
              <ScorePair label="Game 2" a={g2a} b={g2b} setA={setG2a} setB={setG2b} />
            </div>
            <button
              type="button"
              onClick={() =>
                onEnterScore(match.id, [
                  { a: g1a, b: g1b },
                  { a: g2a, b: g2b },
                ])
              }
              className="h-10 w-full rounded-xl bg-accent text-sm font-semibold text-accent-fg"
            >
              Submit score
            </button>
          </div>
        )}

        {match.status === "played_pending" && isParty && match.scoreEnteredBy !== meId && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-fg">
              Opponent submitted:{" "}
              {match.scores?.map((g) => `${g.a}–${g.b}`).join(", ")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onConfirm(match.id, false)}
                className="h-10 flex-1 rounded-xl bg-accent text-sm font-semibold text-accent-fg"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => onConfirm(match.id, true)}
                className="h-10 flex-1 rounded-xl border border-border text-sm font-medium text-fg-muted"
              >
                Dispute
              </button>
            </div>
          </div>
        )}

        {match.status === "confirmed" && (
          <p className="mt-4 text-sm text-success">
            Confirmed. Ratings updated
            {match.ratingDeltaHost != null && host
              ? ` · ${host.name} ${match.ratingDeltaHost >= 0 ? "+" : ""}${match.ratingDeltaHost.toFixed(1)}`
              : ""}
          </p>
        )}

        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-fg-subtle uppercase">Comments</p>
          {match.comments.map((c) => (
            <div key={c.id} className="rounded-lg bg-bg-subtle px-3 py-2 text-sm">
              <span className="text-xs font-medium text-fg-subtle">{c.authorName}</span>
              <p className="text-fg-muted">{c.text}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comment…"
              className="h-10 flex-1 rounded-xl border border-border bg-bg-subtle px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                if (!comment.trim()) return;
                onComment(match.id, comment.trim());
                setComment("");
              }}
              className="h-10 rounded-xl bg-bg-soft px-3 text-sm font-medium"
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerStatCard({ player }: { player: Player }) {
  return (
    <div className="rounded-xl border border-border bg-bg-subtle p-3">
      <div className="flex items-center gap-2">
        <PlayerAvatar player={player} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{player.name}</p>
          <p className="text-[11px] text-fg-muted">
            {displayRating(player.rating)} · {formatHeightInches(player.heightIn)} ·{" "}
            {player.weightLb} lb
          </p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-fg-subtle">
        {player.wins}W–{player.losses}L · streak {player.streak} · {player.experienceYears}y exp
      </p>
      <p className="text-[11px] text-fg-subtle">
        sports {player.sportsmanship.toFixed(1)}★ · show {player.reliability.toFixed(1)}★
      </p>
    </div>
  );
}

function ScorePair({
  label,
  a,
  b,
  setA,
  setB,
}: {
  label: string;
  a: number;
  b: number;
  setA: (n: number) => void;
  setB: (n: number) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] text-fg-subtle">{label}</p>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={a}
          onChange={(e) => setA(Number(e.target.value))}
          className="h-9 w-full rounded-lg border border-border bg-bg-elevated px-2 text-sm"
        />
        <span className="text-fg-subtle">–</span>
        <input
          type="number"
          value={b}
          onChange={(e) => setB(Number(e.target.value))}
          className="h-9 w-full rounded-lg border border-border bg-bg-elevated px-2 text-sm"
        />
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-bg-subtle px-2.5 py-0.5 text-[11px] font-medium text-fg-muted">
      {children}
    </span>
  );
}

function HeightPick({
  label,
  ft,
  inch,
  onFt,
  onIn,
}: {
  label: string;
  ft: number;
  inch: number;
  onFt: (n: number) => void;
  onIn: (n: number) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-subtle p-2">
      <p className="mb-1 text-[10px] font-medium text-fg-subtle uppercase">{label}</p>
      <div className="flex gap-1">
        <select
          value={ft}
          onChange={(e) => onFt(Number(e.target.value))}
          className="h-9 flex-1 rounded-lg border border-border bg-bg-elevated px-1 text-sm"
        >
          {[5, 6, 7].map((f) => (
            <option key={f} value={f}>
              {f}′
            </option>
          ))}
        </select>
        <select
          value={inch}
          onChange={(e) => onIn(Number(e.target.value))}
          className="h-9 flex-1 rounded-lg border border-border bg-bg-elevated px-1 text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i}>
              {i}″
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function PlayerSheet({
  player,
  isMe,
  onClose,
}: {
  player: Player;
  isMe: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-bg/70" onClick={onClose} />
      <div className="slide-up relative z-10 w-full max-w-lg rounded-t-3xl border border-border bg-bg-elevated p-5 sm:rounded-3xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full border border-border"
        >
          <X className="size-4" />
        </button>
        <div className="flex items-center gap-4">
          <PlayerAvatar player={player} size="lg" />
          <div>
            <h3 className="font-display text-xl font-semibold">
              {player.name}
              {isMe ? " (you)" : ""}
            </h3>
            <p className="text-sm text-fg-muted">@{player.handle}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            ["Rating", String(displayRating(player.rating))],
            ["Record", `${player.wins}–${player.losses}`],
            ["Height", formatHeightInches(player.heightIn)],
            ["Weight", `${player.weightLb}`],
            ["Sports", `${player.sportsmanship.toFixed(1)}★`],
            ["Show", `${player.reliability.toFixed(1)}★`],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-border bg-bg-subtle px-2 py-2 text-center">
              <p className="text-[10px] text-fg-subtle uppercase">{l}</p>
              <p className="text-sm font-semibold">{v}</p>
            </div>
          ))}
        </div>
        {player.bio && (
          <p className="mt-4 text-sm text-fg-muted">{player.bio}</p>
        )}
      </div>
    </div>
  );
}


function MessagesPanel({
  threads,
  players,
  meId,
  onOpenPlayer,
  onAccept,
  onSend,
}: {
  threads: import("@/lib/upset/types").DirectThread[];
  players: Player[];
  meId: string;
  onOpenPlayer: (id: string) => void;
  onAccept: (id: string) => void;
  onSend: (toId: string, text: string) => { ok: true } | { ok: false; reason: string };
}) {
  const [active, setActive] = useState<string | null>(threads[0]?.id ?? null);
  const [text, setText] = useState("");
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const th = threads.find((t) => t.id === active);

  if (threads.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-bg-elevated px-6 py-12 text-center text-sm text-fg-muted">
        No messages yet. Open a profile and hit Message — first contact goes to
        requests.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {threads.map((t) => {
          const other = t.participantIds.find((id) => id !== meId)!;
          const p = byId.get(other);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold",
                active === t.id
                  ? "border-court bg-court-soft text-fg"
                  : "border-border text-fg-muted",
              )}
            >
              {p ? p.name.split(" ")[0] : "Player"}
              {t.isRequest ? " · req" : ""}
            </button>
          );
        })}
      </div>
      {th && (
        <div className="rounded-2xl border border-border bg-bg-elevated p-4">
          {th.isRequest && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-bg-subtle px-3 py-2">
              <p className="text-xs text-fg-muted">Message request</p>
              <button
                type="button"
                onClick={() => onAccept(th.id)}
                className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-fg"
              >
                Accept
              </button>
            </div>
          )}
          <div className="mb-3 max-h-48 space-y-2 overflow-y-auto">
            {th.messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm",
                  m.authorId === meId
                    ? "ml-6 bg-court-soft text-fg"
                    : "mr-6 bg-bg-subtle text-fg-muted",
                )}
              >
                <button
                  type="button"
                  className="text-[11px] font-medium text-fg-subtle"
                  onClick={() => m.authorId && onOpenPlayer(m.authorId)}
                >
                  {m.authorName}
                </button>
                <p>{m.text}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message…"
              className="h-10 flex-1 rounded-xl border border-border bg-bg-subtle px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                const other = th.participantIds.find((id) => id !== meId)!;
                const r = onSend(other, text);
                if (r.ok) setText("");
              }}
              className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function nextFridayLocal() {
  const d = new Date();
  const day = d.getDay();
  const daysUntilFri = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilFri);
  d.setHours(19, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
