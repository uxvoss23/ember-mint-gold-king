import { useMemo, useState } from "react";
import {
  Calendar,
  Check,
  ChevronLeft,
  Clock,
  MapPin,
  Trophy,
  Users,
} from "lucide-react";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { TournamentBracketView } from "@/components/compete/tournament-bracket";
import type { GameMode } from "@/lib/upset/tournament-bracket";
import type { Player } from "@/lib/upset/types";
import { displayRating } from "@/lib/rating/engine";
import { cn } from "@/lib/utils";

export type TournamentStatus = "open" | "full" | "live" | "finals" | "complete";

export interface TournamentEvent {
  id: string;
  name: string;
  mode: GameMode;
  when: string;
  startsAt: string;
  checkIn: string;
  location: string;
  address: string;
  capacity: number;
  registered: number;
  entryFee: string;
  prizes: string[];
  rules: string[];
  status: TournamentStatus;
  description?: string;
  registeredIds?: string[];
}

const MODE_LABEL: Partial<Record<GameMode, string>> = {
  "1v1": "1v1",
};

interface TournamentDetailProps {
  event: TournamentEvent;
  players: Player[];
  meId: string;
  onBack: () => void;
  onRegister?: (eventId: string) => void;
}

/** Kept for future events — app is 1v1-only right now. */
export function TournamentDetail({
  event,
  players,
  meId,
  onBack,
  onRegister,
}: TournamentDetailProps) {
  const [showBracket, setShowBracket] = useState(
    event.status === "live" ||
      event.status === "finals" ||
      event.status === "complete" ||
      event.status === "full",
  );
  const registered = useMemo(() => {
    const ids = event.registeredIds ?? [];
    return ids
      .map((id) => players.find((p) => p.id === id))
      .filter(Boolean) as Player[];
  }, [event.registeredIds, players]);
  const isIn = (event.registeredIds ?? []).includes(meId);
  const fieldFull =
    event.registered >= event.capacity ||
    event.status === "full" ||
    event.status === "live" ||
    event.status === "finals" ||
    event.status === "complete";
  const bracketReady = fieldFull;

  if (showBracket && bracketReady) {
    return (
      <TournamentBracketView
        tournamentId={event.id}
        name={event.name}
        mode={event.mode}
        size={event.capacity >= 16 ? 16 : 8}
        players={players}
        meId={meId}
        onBack={() => setShowBracket(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted"
      >
        <ChevronLeft className="size-3.5" />
        Back
      </button>

      <div>
        <p className="text-[10px] font-semibold tracking-[0.14em] text-court uppercase">
          {MODE_LABEL[event.mode] ?? "1v1"} · {event.status}
        </p>
        <h2 className="font-display text-xl font-semibold text-fg">
          {event.name}
        </h2>
        {event.description ? (
          <p className="mt-1 text-sm text-fg-muted">{event.description}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-bg-elevated p-3">
          <Calendar className="mb-1 size-3.5 text-court" />
          <p className="text-[10px] text-fg-subtle">Starts</p>
          <p className="text-xs font-semibold text-fg">{event.startsAt}</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-elevated p-3">
          <Clock className="mb-1 size-3.5 text-court" />
          <p className="text-[10px] text-fg-subtle">Check-in</p>
          <p className="text-xs font-semibold text-fg">{event.checkIn}</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-elevated p-3">
          <MapPin className="mb-1 size-3.5 text-court" />
          <p className="text-[10px] text-fg-subtle">Where</p>
          <p className="text-xs font-semibold text-fg">{event.location}</p>
          <p className="text-[10px] text-fg-muted">{event.address}</p>
        </div>
        <div className="rounded-xl border border-border bg-bg-elevated p-3">
          <Users className="mb-1 size-3.5 text-court" />
          <p className="text-[10px] text-fg-subtle">Field</p>
          <p className="text-xs font-semibold text-fg">
            {event.registered}/{event.capacity}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-bg-elevated p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-fg-muted">
          <Trophy className="size-3.5 text-court" />
          Prizes
        </p>
        <ul className="mt-2 space-y-1">
          {event.prizes.map((p) => (
            <li key={p} className="text-sm text-fg">
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-fg-subtle">Entry {event.entryFee}</p>
      </div>

      <div className="rounded-xl border border-border bg-bg-elevated p-3">
        <p className="text-[11px] font-semibold text-fg-muted">Rules</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-fg">
          {event.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      {registered.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-fg-muted">
            Registered ({registered.length})
          </p>
          {registered.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-bg-elevated px-3 py-2"
            >
              <PlayerAvatar player={p} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{p.name}</p>
                <p className="text-[11px] text-fg-muted">
                  {displayRating(p.rating)} rating
                </p>
              </div>
              {p.id === meId ? (
                <span className="text-[10px] font-semibold text-court">you</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        {!isIn && !fieldFull ? (
          <button
            type="button"
            onClick={() => onRegister?.(event.id)}
            className="flex-1 rounded-full bg-court py-3 text-sm font-semibold text-white"
          >
            Register
          </button>
        ) : isIn ? (
          <div className="flex flex-1 items-center justify-center gap-1 rounded-full border border-court/40 bg-court/10 py-3 text-sm font-semibold text-court">
            <Check className="size-4" />
            Registered
          </div>
        ) : null}
        {bracketReady ? (
          <button
            type="button"
            onClick={() => setShowBracket(true)}
            className={cn(
              "flex-1 rounded-full py-3 text-sm font-semibold",
              "border border-border bg-bg-elevated text-fg",
            )}
          >
            View bracket
          </button>
        ) : (
          <p className="flex-1 text-center text-[11px] text-fg-muted">
            Bracket locks when the field is full
          </p>
        )}
      </div>
    </div>
  );
}
