import { memo, useCallback, useState } from "react";
import { QuickMatchFlow } from "@/components/compete/quick-match-flow";
import type { Player } from "@/lib/upset/types";
import type { Court } from "@/lib/courts/types";
import type { Match } from "@/lib/upset/types";

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
  active?: boolean;
  gameBackTo?: "you" | null;
  onGameBack?: () => void;
  focusChatThreadId?: string | null;
  playDeskFocus?: "my_games" | "lobby" | "create" | null;
  onPlayDeskFocusConsumed?: () => void;
}

/**
 * Play = on-ramps to a locked 1v1:
 * Open games (time/place first). Match Mode is on unless disabled.
 */
export const PlayHub = memo(function PlayHub({
  me,
  players,
  courts,
  matches,
  userLat,
  userLon,
  userLocationLabel,
  onOpenProfile: _onOpenProfile,
  onCreateMatch,
  onAcceptMatch,
  onOpenPlayer,
  focusMatchId,
  onFocusMatchConsumed,
  presetCourt = null,
  onPresetCourtConsumed,
  onImmersiveChange,
  active = true,
  gameBackTo = null,
  onGameBack,
  focusChatThreadId = null,
  playDeskFocus = null,
  onPlayDeskFocusConsumed,
}: PlayHubProps) {
  const [immersive, setImmersive] = useState(false);
  const setImmersiveBoth = useCallback((v: boolean) => {
    setImmersive(v);
    onImmersiveChange?.(v);
  }, [onImmersiveChange]);

  return (
    <div
      className={
        immersive ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "flex min-h-0 flex-1 flex-col"
      }
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
        active={active}
        gameBackTo={gameBackTo}
        onGameBack={onGameBack}
        focusChatThreadId={focusChatThreadId}
        playDeskFocus={playDeskFocus}
        onPlayDeskFocusConsumed={onPlayDeskFocusConsumed}
      />
      </div>
    </div>
  );
});
