import { useMemo, useState } from "react";
import {
  CalendarPlus,
  Check,
  Clock,
  Swords,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { namedAustinCourts } from "@/lib/courts/catalog";
import {
  playerMatchesFilters,
  useCompeteStore,
} from "@/lib/compete/store";
import type { GameChallenge, Player } from "@/lib/compete/types";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { cn, formatHeightInches } from "@/lib/utils";

type CompeteTab = "ladder" | "games" | "create";

export function CompetePanel() {
  const [tab, setTab] = useState<CompeteTab>("ladder");
  const store = useCompeteStore();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-bg-elevated p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-court-soft text-court">
            <Swords className="size-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-fg">
              Austin 1v1 Ladder
            </h2>
            <p className="mt-0.5 text-sm leading-relaxed text-fg-muted">
              Challenge players by rating, height, and sportsmanship. You set the
              terms — they accept if they match.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-bg-subtle p-3">
          <PlayerAvatar player={store.me} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-fg">{store.me.name}</p>
            <p className="text-xs text-fg-muted">
              {store.me.rating} rating · {formatHeightInches(store.me.heightIn)} ·{" "}
              {store.me.sportsmanship.toFixed(1)}★
            </p>
          </div>
          <div className="text-right text-xs text-fg-subtle">
            <p className="font-medium text-fg-muted">
              {store.me.wins}W – {store.me.losses}L
            </p>
            <p className="capitalize">{store.me.availability}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 rounded-full border border-border bg-bg-elevated p-1">
        {(
          [
            { id: "ladder" as const, label: "Leaderboard", icon: Trophy },
            { id: "games" as const, label: "Open games", icon: Users },
            { id: "create" as const, label: "Create", icon: CalendarPlus },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-semibold transition-colors",
              tab === t.id
                ? "bg-accent text-accent-fg"
                : "text-fg-muted hover:text-fg",
            )}
          >
            <t.icon className="size-3.5" strokeWidth={2} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "ladder" && (
        <Leaderboard
          players={store.leaderboard}
          meId={store.me.id}
          onSelect={setSelectedPlayer}
        />
      )}
      {tab === "games" && (
        <OpenGames
          games={store.openGames}
          players={store.players}
          meId={store.me.id}
          onJoin={store.joinGame}
          onCancel={store.cancelGame}
        />
      )}
      {tab === "create" && (
        <CreateGameForm
          me={store.me}
          players={store.players}
          onCreate={(g) => {
            store.createGame(g);
            setTab("games");
          }}
        />
      )}

      {selectedPlayer && (
        <PlayerSheet
          player={selectedPlayer}
          isMe={selectedPlayer.id === store.me.id}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}

function Leaderboard({
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
      <p className="px-1 text-xs font-medium tracking-wide text-fg-subtle uppercase">
        Highest rated · Austin
      </p>
      {players.map((p, i) => {
        const isMe = p.id === meId;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
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
            <PlayerAvatar player={p} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">
                {p.name}
                {isMe ? " · you" : ""}
              </p>
              <p className="text-xs text-fg-muted">
                {formatHeightInches(p.heightIn)} · {p.sportsmanship.toFixed(1)}★ ·{" "}
                <span
                  className={cn(
                    "capitalize",
                    p.availability === "available" && "text-success",
                    p.availability === "busy" && "text-fg-muted",
                    p.availability === "offline" && "text-fg-subtle",
                  )}
                >
                  {p.availability}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums text-fg">{p.rating}</p>
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

function OpenGames({
  games,
  players,
  meId,
  onJoin,
  onCancel,
}: {
  games: GameChallenge[];
  players: Player[];
  meId: string;
  onJoin: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  if (games.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-bg-elevated px-6 py-12 text-center">
        <Users className="mx-auto size-8 text-fg-subtle" strokeWidth={1.5} />
        <h3 className="mt-3 font-display text-base font-semibold text-fg">
          No open games yet
        </h3>
        <p className="mt-1 text-sm text-fg-muted">
          Create a challenge with your filters — height, rating, sportsmanship.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {games.map((g) => {
        const host = byId.get(g.hostPlayerId);
        const when = new Date(g.startsAt);
        const isHost = g.hostPlayerId === meId;
        return (
          <div
            key={g.id}
            className="rounded-2xl border border-border bg-bg-elevated p-4"
          >
            <div className="flex items-start gap-3">
              {host && <PlayerAvatar player={host} size="sm" />}
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold text-fg">
                  {g.courtName}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
                  <Clock className="size-3" strokeWidth={2} />
                  {when.toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                <p className="mt-1 text-xs text-fg-subtle">
                  Host {host?.name ?? "Player"} · {host?.rating ?? "—"} rating
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip>
                {formatHeightInches(g.filters.heightMinIn)}–
                {formatHeightInches(g.filters.heightMaxIn)}
              </Chip>
              <Chip>
                {g.filters.ratingMin}–{g.filters.ratingMax} rating
              </Chip>
              <Chip>{g.filters.sportsmanshipMin.toFixed(1)}★+ sports</Chip>
            </div>

            {g.notes && (
              <p className="mt-2 text-xs leading-relaxed text-fg-muted">{g.notes}</p>
            )}

            <div className="mt-3">
              {isHost ? (
                <button
                  type="button"
                  onClick={() => onCancel(g.id)}
                  className="h-10 w-full rounded-xl border border-border text-sm font-medium text-fg-muted"
                >
                  Cancel game
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onJoin(g.id)}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-fg"
                >
                  <Check className="size-4" strokeWidth={2} />
                  Accept challenge
                </button>
              )}
            </div>
          </div>
        );
      })}
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

function CreateGameForm({
  me,
  players,
  onCreate,
}: {
  me: Player;
  players: Player[];
  onCreate: (
    g: Omit<GameChallenge, "id" | "createdAt" | "status" | "hostPlayerId">,
  ) => void;
}) {
  const courts = useMemo(() => namedAustinCourts(), []);
  const [courtId, setCourtId] = useState(
    () => courts.find((c) => c.id === "cat-battle-bend")?.id ?? courts[0]?.id ?? "",
  );
  const defaultWhen = useMemo(() => nextFriday7pm(), []);
  const [when, setWhen] = useState(defaultWhen);
  const [hMinFt, setHMinFt] = useState(6);
  const [hMinIn, setHMinIn] = useState(0);
  const [hMaxFt, setHMaxFt] = useState(6);
  const [hMaxIn, setHMaxIn] = useState(9);
  const [ratingMin, setRatingMin] = useState(1500);
  const [ratingMax, setRatingMax] = useState(2000);
  const [sportsMin, setSportsMin] = useState(4);
  const [notes, setNotes] = useState("Clean 1v1. Call your own fouls.");

  const filters = {
    heightMinIn: hMinFt * 12 + hMinIn,
    heightMaxIn: hMaxFt * 12 + hMaxIn,
    ratingMin,
    ratingMax,
    sportsmanshipMin: sportsMin,
  };

  const eligibleCount = players.filter(
    (p) => p.id !== me.id && playerMatchesFilters(p, filters),
  ).length;

  const court = courts.find((c) => c.id === courtId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!court) return;
    onCreate({
      courtId: court.id,
      courtName: court.name,
      lat: court.lat,
      lon: court.lon,
      startsAt: new Date(when).toISOString(),
      notes: notes.trim() || undefined,
      filters,
    });
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl border border-border bg-bg-elevated p-4"
    >
      <div>
        <label className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Court
        </label>
        <select
          value={courtId}
          onChange={(e) => setCourtId(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg outline-none"
        >
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          When
        </label>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg outline-none"
          required
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Height range
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <HeightPick
            label="Min"
            ft={hMinFt}
            inch={hMinIn}
            onFt={setHMinFt}
            onIn={setHMinIn}
          />
          <HeightPick
            label="Max"
            ft={hMaxFt}
            inch={hMaxIn}
            onFt={setHMaxFt}
            onIn={setHMaxIn}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Rating range
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Min"
            value={ratingMin}
            onChange={setRatingMin}
            step={50}
            min={800}
            max={2400}
          />
          <NumberField
            label="Max"
            value={ratingMax}
            onChange={setRatingMax}
            step={50}
            min={800}
            max={2400}
          />
        </div>
      </fieldset>

      <div>
        <label className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Min sportsmanship · {sportsMin.toFixed(1)}★
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
      </div>

      <div>
        <label className="text-xs font-medium tracking-wide text-fg-subtle uppercase">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1.5 w-full resize-none rounded-xl border border-border bg-bg-subtle px-3 py-2.5 text-sm text-fg outline-none"
        />
      </div>

      <p className="text-center text-xs text-fg-muted">
        {eligibleCount} Austin player{eligibleCount === 1 ? "" : "s"} match these
        filters
      </p>

      <button
        type="submit"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-fg active:scale-[0.98]"
      >
        <Swords className="size-4" strokeWidth={2} />
        Post challenge
      </button>
    </form>
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
          className="h-9 flex-1 rounded-lg border border-border bg-bg-elevated px-1 text-sm text-fg"
        >
          {[5, 6, 7].map((f) => (
            <option key={f} value={f}>
              {f} ft
            </option>
          ))}
        </select>
        <select
          value={inch}
          onChange={(e) => onIn(Number(e.target.value))}
          className="h-9 flex-1 rounded-lg border border-border bg-bg-elevated px-1 text-sm text-fg"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i}>
              {i} in
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step: number;
  min: number;
  max: number;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium text-fg-subtle uppercase">{label}</p>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg outline-none"
      />
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
      <button
        type="button"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div className="slide-up relative z-10 w-full max-w-lg rounded-t-3xl border border-border bg-bg-elevated p-5 shadow-soft sm:rounded-3xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full border border-border text-fg-muted"
        >
          <X className="size-4" />
        </button>
        <div className="flex items-center gap-4">
          <PlayerAvatar player={player} size="lg" />
          <div>
            <h3 className="font-display text-xl font-semibold text-fg">
              {player.name}
              {isMe ? " (you)" : ""}
            </h3>
            <p className="text-sm text-fg-muted">
              @{player.handle} · {player.city}
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat label="Rating" value={String(player.rating)} />
          <Stat label="Record" value={`${player.wins}–${player.losses}`} />
          <Stat label="Height" value={formatHeightInches(player.heightIn)} />
          <Stat label="Sports" value={`${player.sportsmanship.toFixed(1)}★`} />
          <Stat label="Form" value={`${player.form}`} />
          <Stat label="Status" value={player.availability} />
        </div>
        {player.bio && (
          <p className="mt-4 text-sm leading-relaxed text-fg-muted">{player.bio}</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-subtle px-3 py-2.5 text-center">
      <p className="text-[10px] font-medium tracking-wide text-fg-subtle uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold capitalize text-fg">{value}</p>
    </div>
  );
}

function nextFriday7pm(): string {
  const d = new Date();
  const day = d.getDay();
  const daysUntilFri = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilFri);
  d.setHours(19, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
