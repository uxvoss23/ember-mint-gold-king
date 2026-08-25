import { useCallback, useState } from "react";
import { Link } from "@tanstack/react-router";
import { QuickMatchFlow } from "@/components/compete/quick-match-flow";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import type { Player } from "@/lib/upset/types";
import type { Court } from "@/lib/courts/types";
import type { Match } from "@/lib/upset/types";
import { displayRating } from "@/lib/rating/engine";
import { GUEST_PLAYER_ID, saveAuthIntent } from "@/lib/game/guest";

interface PlayHubProps {
  me: Player;
  players: Player[];
  courts: Court[];
  matches: Match[];
  userLat?: number;
  userLon?: number;
  userLocationLabel?: string;
  onOpenProfile?: () => void;
  onCreateMatch?: (input: {
    court: { id: string; name: string; lat: number; lon: number };
    preferredAt: string;
    mode: "ranked_1v1";
    format?: import("@/lib/upset/types").MatchFormat;
    notes?: string;
    hostBringingBall?: boolean;
    guestInviteIds?: string[];
    inviteOnly?: boolean;
  }) => void | Match | Promise<void | Match>;
  onAcceptMatch?: (
    matchId: string,
    opts?: { bringingBall?: boolean },
  ) => "ok" | "filled" | "invite_only" | void | Promise<"ok" | "filled" | "invite_only" | void>;
  onOpenPlayer?: (p: Player) => void;
  focusMatchId?: string | null;
  onFocusMatchConsumed?: () => void;
  presetCourt?: Court | null;
  onPresetCourtConsumed?: () => void;
  onImmersiveChange?: (immersive: boolean) => void;
}

/**
 * Play = two on-ramps to a locked 1v1:
 * Open games (time/place first) + Match Mode (person first).
 * + Create feeds the open list.
 */
export function PlayHub({
  me,
  players,
  courts,
  matches,
  userLat,
  userLon,
  userLocationLabel,
  onOpenProfile,
  onCreateMatch,
  onAcceptMatch,
  onOpenPlayer,
  focusMatchId,
  onFocusMatchConsumed,
  presetCourt = null,
  onPresetCourtConsumed,
  onImmersiveChange,
}: PlayHubProps) {
  const [immersive, setImmersive] = useState(false);
  const setImmersiveBoth = useCallback((v: boolean) => {
    setImmersive(v);
    onImmersiveChange?.(v);
  }, [onImmersiveChange]);

  return (
    <div
      className={
        immersive ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "space-y-2.5 pb-2"
      }
    >
      {!immersive ? (
        <div className="flex items-center justify-end gap-2">
          {me.id === GUEST_PLAYER_ID ? (
            <Link
              to="/login"
              onClick={() => saveAuthIntent({ next: "/", action: "profile" })}
              className="flex shrink-0 items-center rounded-full border border-border bg-bg-elevated px-3 py-1 text-xs font-semibold text-fg"
            >
              Sign in
            </Link>
          ) : (
            <button
              type="button"
              onClick={onOpenProfile}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-bg-elevated py-0.5 pr-2.5 pl-0.5"
              aria-label="Your profile"
            >
              <PlayerAvatar player={me} size="sm" />
              <span className="text-xs font-semibold tabular-nums text-fg">
                {displayRating(me.rating)}
              </span>
            </button>
          )}
        </div>
      ) : null}

      <div className={immersive ? "flex min-h-0 flex-1 flex-col overflow-hidden" : undefined}>
      <QuickMatchFlow
        me={me}
        players={players}
        courts={courts}
        matches={matches}
        userLat={userLat}
        userLon={userLon}
        userLocationLabel={userLocationLabel}
        onCreateMatch={onCreateMatch}
        onAcceptMatch={onAcceptMatch}
        onOpenPlayer={onOpenPlayer}
        compactHeader
        onImmersiveChange={setImmersiveBoth}
        focusMatchId={focusMatchId}
        onFocusMatchConsumed={onFocusMatchConsumed}
        presetCourt={presetCourt}
        onPresetCourtConsumed={onPresetCourtConsumed}
      />
      </div>
    </div>
  );
}
