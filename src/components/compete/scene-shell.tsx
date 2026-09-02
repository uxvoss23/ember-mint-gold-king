import { lazy, Suspense, startTransition, useCallback, useEffect, useState } from "react";
import {
  MapPinned,
  Trophy,
  User,
  X,
  Zap,
} from "lucide-react";
import { BottomTabBar } from "@/components/bottom-tab-bar";
const CourtsFinder = lazy(() =>
  import("@/components/courts-finder").then((m) => ({ default: m.CourtsFinder })),
);
import { CourtDetail } from "@/components/court-detail";
import { LeaderboardPanel } from "@/components/compete/leaderboard-panel";
import { PlayHub } from "@/components/compete/play-hub";
import { YouHome } from "@/components/compete/you-home";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { AdminWorkOrders } from "@/components/admin-work-orders";
import { ModerationQueue } from "@/components/compete/moderation-queue";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut, authEnabled } from "@/lib/auth/client";
import { isAdminEmail } from "@/lib/auth/admin";
import { Link, useNavigate } from "@tanstack/react-router";
import { PlayerProfile } from "@/components/compete/player-profile";
import { ProfileCompleteForm } from "@/components/compete/profile-complete-form";
import { isProfileComplete } from "@/lib/game/profile";
import type { Court, UserLocation } from "@/lib/courts/types";
import { isDemoMode } from "@/lib/config";
import {
  createGameFn,
  joinGameFn,
} from "@/lib/game/fns";
import { GUEST_PLAYER_ID } from "@/lib/game/guest";
import { mutationError, refreshCompetitiveSnapshot } from "@/lib/game/client-actions";
import { useCompetitiveSync } from "@/lib/game/use-competitive-sync";
import { useRequireAuth } from "@/lib/game/use-require-auth";
import { displayRating } from "@/lib/rating/engine";
import { formatLocalWhen, useUpsetStore } from "@/lib/upset/store";
import type { Match, Player } from "@/lib/upset/types";
import { cn } from "@/lib/utils";
import { useTabBarGate } from "@/lib/ui/tab-bar-gate";
import { useHydrateCourtSocial } from "@/lib/courts/social";
import { useHydrateCourtAdmin } from "@/lib/courts/admin-overrides";

type SceneHome = "leaderboard" | "games" | "you" | "courts";

interface SceneShellProps {
  courts: Court[];
  location: UserLocation;
  courtsLoading?: boolean;
  courtsLocating?: boolean;
  courtsError?: string | null;
  courtsLocError?: string | null;
  radiusMi?: number;
  dataSource?: string;
  onRadiusChange?: (mi: number) => void;
  onRefreshCourts?: () => void;
  onNearMe?: () => void;
  /** False during boot splash — tab bar must not mount yet */
  showTabBar?: boolean;
}

export function SceneShell({
  courts,
  location,
  courtsLoading = false,
  courtsLocating = false,
  courtsError = null,
  courtsLocError = null,
  radiusMi = 8,
  dataSource = "",
  onRadiusChange,
  onRefreshCourts,
  onNearMe,
  showTabBar = true,
}: SceneShellProps) {
  const store = useUpsetStore();
  const sync = useCompetitiveSync();
  const requireAuth = useRequireAuth();
  const { user } = useCurrentUserState();
  const signedIn = !!user && store.me.id !== GUEST_PLAYER_ID;
  const tabsHidden = useTabBarGate((s) => s.hidden);
  useHydrateCourtSocial();
  useHydrateCourtAdmin();
  const [home, setHome] = useState<SceneHome>("courts");
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [matchDetail, setMatchDetail] = useState<Match | null>(null);
  const [raceMsg, setRaceMsg] = useState<string | null>(null);
  const [focusMatchId, setFocusMatchId] = useState<string | null>(null);
  const [focusCourtId, setFocusCourtId] = useState<string | null>(null);
  /** Courts tab → Play "create game" with this court locked */
  const [presetCourt, setPresetCourt] = useState<Court | null>(null);
  const [playImmersive, setPlayImmersive] = useState(false);
  const [courtsVisited, setCourtsVisited] = useState(true);
  const [boardVisited, setBoardVisited] = useState(false);
  const [youVisited, setYouVisited] = useState(false);
  const [needProfile, setNeedProfile] = useState(false);
  const [gameBackTo, setGameBackTo] = useState<"you" | null>(null);

  const requirePlay = (action: string) => {
    if (!requireAuth(action)) return false;
    if (signedIn && !isProfileComplete(store.me)) {
      setNeedProfile(true);
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (home === "courts") setCourtsVisited(true);
    if (home === "leaderboard") setBoardVisited(true);
    if (home === "you") setYouVisited(true);
  }, [home]);

  const goHome = useCallback((id: SceneHome) => {
    startTransition(() => setHome(id));
  }, []);

  const startQuickAtCourt = useCallback((court: Court) => {
    setSelectedCourt(null);
    setPresetCourt(court);
    startTransition(() => setHome("games"));
  }, []);

  const title =
    home === "leaderboard"
      ? "Leaderboard"
      : home === "games"
        ? "Play"
        : home === "courts"
          ? "Courts"
          : "Me";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {home !== "games" && home !== "leaderboard" && home !== "courts" && (
        <div className="mb-2.5 flex shrink-0 items-center justify-between gap-3 px-4 pt-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-court uppercase">
              Upset City
            </p>
            <h2 className="font-display text-lg font-semibold tracking-tight text-fg">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!signedIn) return;
              setSelectedPlayer(store.me);
            }}
            className="flex items-center gap-2 rounded-full border border-border bg-bg-elevated py-1 pr-3 pl-1"
            aria-label="Your profile"
          >
            {signedIn ? (
              <>
                <PlayerAvatar player={store.me} size="sm" />
                <span className="text-sm font-semibold tabular-nums text-fg">
                  {displayRating(store.me.rating)}
                </span>
              </>
            ) : (
              <span className="px-2 text-xs font-semibold text-fg-muted">Guest</span>
            )}
          </button>
        </div>
      )}

      <div
        data-app-scroll
        className={cn(
          "min-h-0 flex-1",
          home === "courts" || (home === "games" && playImmersive)
            ? "relative flex flex-col overflow-hidden"
            : "uc-screen-scroll px-4 pt-2 touch-pan-y",
          home === "games" && playImmersive ? "px-0 pt-0 pb-0" : "",
        )}
      >
        {(home === "leaderboard" || boardVisited) && (
          <div
            className={home === "leaderboard" ? undefined : "hidden"}
            hidden={home !== "leaderboard"}
            aria-hidden={home !== "leaderboard"}
          >
            {sync.status === "error" ? (
              <div className="mb-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px]">
                {sync.error ?? "Couldn’t load rankings."}
                <button
                  type="button"
                  className="ml-2 font-semibold text-court"
                  onClick={() => void sync.refresh()}
                >
                  Retry
                </button>
              </div>
            ) : null}
            <LeaderboardPanel
              players={store.players}
              meId={signedIn ? store.me.id : ""}
              onOpenPlayer={setSelectedPlayer}
              onOpenProfile={() => signedIn && setSelectedPlayer(store.me)}
            />
          </div>
        )}

        <div
          className={cn(
            home === "games" ? "flex min-h-0 flex-1 flex-col" : "hidden",
          )}
          hidden={home !== "games"}
          aria-hidden={home !== "games"}
        >
          <PlayHub
            me={store.me}
            players={store.players}
            courts={courts}
            matches={store.matches}
            userLat={location.lat}
            userLon={location.lon}
            onOpenProfile={() => {
              if (signedIn) setSelectedPlayer(store.me);
            }}
            onImmersiveChange={setPlayImmersive}
            onCreateMatch={async ({
              court,
              preferredAt,
              format,
              notes,
              hostBringingBall,
              guestInviteIds,
              inviteOnly,
            }) => {
              if (!requirePlay("create")) return;
              const filters = {
                heightMinIn: 60,
                heightMaxIn: 84,
                ratingMin: 800,
                ratingMax: 2500,
                sportsmanshipMin: 3,
                radiusMiles: 50,
              };
              if (isDemoMode()) {
                const match = store.createQuickMatch({
                  courtId: court.id,
                  courtName: court.name,
                  lat: court.lat,
                  lon: court.lon,
                  preferredAt,
                  format: format ?? "1v1",
                  notes,
                  hostBringingBall,
                  guestInviteIds,
                  inviteOnly,
                  allowGuestInvites: false,
                  filters,
                });
                setRaceMsg(
                  inviteOnly
                    ? `Private match posted · ${guestInviteIds?.length ?? 0} invite${(guestInviteIds?.length ?? 0) === 1 ? "" : "s"}.`
                    : "Public match is live in the lobby.",
                );
                return match;
              }
              try {
                const match = await createGameFn({
                  data: {
                    courtId: court.id,
                    courtName: court.name,
                    lat: court.lat,
                    lon: court.lon,
                    preferredAt,
                    format: format ?? "1v1",
                    notes,
                    hostBringingBall: hostBringingBall ?? false,
                    guestInviteIds: guestInviteIds ?? [],
                    inviteOnly: !!inviteOnly,
                  },
                });
                await refreshCompetitiveSnapshot();
                setRaceMsg(
                  inviteOnly
                    ? `Private match posted · ${guestInviteIds?.length ?? 0} invite${(guestInviteIds?.length ?? 0) === 1 ? "" : "s"}.`
                    : "Public match is live in the lobby.",
                );
                return match;
              } catch (err) {
                setRaceMsg(mutationError(err));
                return;
              }
            }}
            onAcceptMatch={async (id, opts) => {
              if (!requirePlay("join")) return;
              if (isDemoMode()) {
                const r = store.tryAcceptRace(id, opts);
                if (r === "filled") setRaceMsg("That game just filled.");
                else if (r === "invite_only")
                  setRaceMsg("Private match — invite only.");
                else setRaceMsg("Game accepted.");
                return r;
              }
              try {
                const r = await joinGameFn({
                  data: {
                    gameId: id,
                    bringingBall: opts?.bringingBall ?? false,
                  },
                });
                await refreshCompetitiveSnapshot();
                if (!r.ok) {
                  setRaceMsg(
                    r.reason === "invite_only"
                      ? "Private match — invite only."
                      : "That game just filled.",
                  );
                  return r.reason;
                }
                setRaceMsg("Game accepted.");
                return "ok";
              } catch (err) {
                setRaceMsg(mutationError(err));
                return;
              }
            }}
            onOpenPlayer={setSelectedPlayer}
            focusMatchId={focusMatchId}
            onFocusMatchConsumed={() => setFocusMatchId(null)}
            presetCourt={presetCourt}
            onPresetCourtConsumed={() => setPresetCourt(null)}
            active={home === "games"}
            gameBackTo={gameBackTo}
            onGameBack={() => {
              setGameBackTo(null);
              startTransition(() => setHome("you"));
            }}
          />
        </div>

        {(home === "you" || youVisited) && (
          <div
            className={home === "you" ? undefined : "hidden"}
            hidden={home !== "you"}
            aria-hidden={home !== "you"}
          >
          <YouSection
            me={store.me}
            signedIn={signedIn}
            matches={store.matches}
            players={store.players}
            onOpenProfile={() => {
              if (signedIn) setSelectedPlayer(store.me);
            }}
            onOpenMatch={(id) => {
              setGameBackTo("you");
              setFocusMatchId(id);
              setHome("games");
            }}
            onGoPlay={() => setHome("games")}
          />
          </div>
        )}

        {(home === "courts" || courtsVisited) && (
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col",
              home !== "courts" && "hidden",
            )}
          >
            <div className="min-h-0 flex-1 overflow-hidden">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-sm text-fg-muted">
                    Opening map…
                  </div>
                }
              >
              <CourtsFinder
                courts={courts}
                location={location}
                loading={courtsLoading}
                locating={courtsLocating}
                error={courtsError}
                locError={courtsLocError}
                radiusMi={radiusMi}
                dataSource={dataSource}
                onRadiusChange={(mi) => onRadiusChange?.(mi)}
                onRefresh={() => onRefreshCourts?.()}
                onNearMe={() => onNearMe?.()}
                onQuickMatch={startQuickAtCourt}
                focusCourtId={focusCourtId}
                onFocusCourtConsumed={() => setFocusCourtId(null)}
              />
              </Suspense>
            </div>
          </div>
        )}

        {raceMsg && (
          <p className="mt-3 text-center text-xs text-fg-muted" role="status">
            {raceMsg}
          </p>
        )}
      </div>

      {/* Portaled tabs — only after boot splash fully unmounts */}
      {showTabBar ? (
      <div
        className={tabsHidden ? "hidden" : undefined}
        hidden={tabsHidden}
        aria-hidden={tabsHidden}
      >
      <BottomTabBar>
        <div className="pointer-events-auto relative flex w-full max-w-lg items-end rounded-2xl border border-border-strong bg-bg-elevated/95 px-0.5 py-0.5 shadow-soft backdrop-blur-md">
          {(
            [
              { id: "courts" as const, label: "Courts", icon: MapPinned },
              { id: "games" as const, label: "Play", icon: Zap },
              { id: "leaderboard" as const, label: "Leaderboard", icon: Trophy },
              { id: "you" as const, label: "Me", icon: User },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => goHome(t.id)}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0 rounded-xl px-0.5 py-1.5 text-[9px] font-semibold leading-tight",
                home === t.id ? "bg-bg-soft text-fg" : "text-fg-muted",
              )}
              aria-label={t.label}
              aria-current={home === t.id ? "page" : undefined}
            >
              <t.icon
                className={cn("size-3.5", home === t.id && t.id === "courts" && "text-court")}
                strokeWidth={1.75}
              />
              {t.label}
            </button>
          ))}
        </div>
      </BottomTabBar>
      </div>
      ) : null}

      {needProfile && signedIn && !isProfileComplete(store.me) ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
            onClick={() => setNeedProfile(false)}
            aria-label="Dismiss"
          />
          <div className="relative z-10 mb-0 w-full max-w-lg rounded-t-3xl border border-border bg-bg-elevated p-5 shadow-soft sm:mb-0 sm:rounded-3xl">
            <button
              type="button"
              onClick={() => setNeedProfile(false)}
              className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full border border-border text-fg-muted"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
            <ProfileCompleteForm
              me={store.me}
              onDone={() => setNeedProfile(false)}
            />
          </div>
        </div>
      ) : null}

      {selectedPlayer && (
        <PlayerProfile
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}

      {selectedCourt && home !== "courts" && (
        <CourtDetail
          court={selectedCourt}
          onClose={() => setSelectedCourt(null)}
          onQuickMatch={() => {
            setSelectedCourt(null);
            setHome("games");
          }}
        />
      )}

      {matchDetail && (
        <MatchSheet
          match={
            store.matches.find((m) => m.id === matchDetail.id) ?? matchDetail
          }
          meId={store.me.id}
          players={store.players}
          onClose={() => setMatchDetail(null)}
          onOpenPlayer={(id) => {
            const p = store.playerById(id);
            if (p) setSelectedPlayer(p);
          }}
        />
      )}
    </div>
  );
}

function YouSection({
  me,
  signedIn,
  matches,
  players,
  onOpenProfile,
  onOpenMatch,
  onGoPlay,
}: {
  me: Player;
  signedIn: boolean;
  matches: Match[];
  players: Player[];
  onOpenProfile: () => void;
  onOpenMatch: (id: string) => void;
  onGoPlay: () => void;
}) {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const admin = isAdminEmail(user?.primaryEmail);

  return (
    <div className="space-y-4 pb-8">
      {signedIn ? (
        <YouHome
          me={me}
          signedIn={signedIn}
          matches={matches}
          players={players}
          onOpenProfile={onOpenProfile}
          onOpenMatch={onOpenMatch}
          onGoPlay={onGoPlay}
        />
      ) : (
        <div className="rounded-2xl border border-border bg-bg-elevated p-4">
          <p className="text-base font-semibold text-fg">Guest</p>
          <p className="mt-1 text-sm text-fg-muted">
            Browse courts, open games, and rankings. Sign in to post a 1v1 and
            get rated.
          </p>
        </div>
      )}

      {/* Account */}
      <section className="rounded-2xl border border-border bg-bg-elevated p-3.5">
        <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
          Account
        </p>
        {isPending ? (
          <p className="mt-2 text-xs text-fg-muted">Checking session…</p>
        ) : user ? (
          <div className="mt-2 space-y-2">
            <p className="text-sm font-semibold text-fg">
              {user.displayName ?? "Signed in"}
            </p>
            <p className="text-xs text-fg-muted">{user.primaryEmail}</p>
            {admin ? (
              <p className="text-[11px] font-semibold text-court">
                Admin access · work orders & court editor
              </p>
            ) : null}
            {authEnabled ? (
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    await signOut();
                    await navigate({
                      to: "/login",
                      search: { signedout: true },
                      replace: true,
                    });
                  })();
                }}
                className="mt-1 text-xs font-semibold text-fg-muted underline-offset-2 hover:underline"
              >
                Sign out
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-fg-muted">
              Sign in to post games, confirm scores, and climb the board.
            </p>
            <Link
              to="/login"
              className="inline-flex h-10 items-center justify-center rounded-full bg-court px-4 text-xs font-semibold text-white"
            >
              Sign in / Create account
            </Link>
          </div>
        )}
      </section>

      {/* Admin inbox — only for seanvoss23@gmail.com */}
      <AdminWorkOrders email={user?.primaryEmail} />
      {admin ? <ModerationQueue /> : null}
    </div>
  );
}

function MatchSheet({
  match,
  meId,
  players,
  onClose,
  onOpenPlayer,
}: {
  match: Match;
  meId: string;
  players: Player[];
  onClose: () => void;
  onOpenPlayer: (id: string) => void;
}) {
  void meId;
  const host = players.find((p) => p.id === match.hostId);
  const opp = match.opponentId
    ? players.find((p) => p.id === match.opponentId)
    : null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Dismiss"
      />
      <div className="slide-up relative z-10 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-bg-elevated p-5 shadow-soft sm:rounded-3xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-court uppercase">
              Match
            </p>
            <p className="font-display text-lg font-semibold text-fg">
              {match.courtName}
            </p>
            <p className="text-xs text-fg-muted">
              {formatLocalWhen(match.scheduledAt ?? match.preferredAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full border border-border text-fg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          {host ? (
            <button type="button" onClick={() => onOpenPlayer(host.id)}>
              <PlayerAvatar player={host} size="md" />
            </button>
          ) : null}
          <span className="text-xs font-bold text-court">VS</span>
          {opp ? (
            <button type="button" onClick={() => onOpenPlayer(opp.id)}>
              <PlayerAvatar player={opp} size="md" />
            </button>
          ) : (
            <span className="text-sm text-fg-muted">Open</span>
          )}
        </div>
      </div>
    </div>
  );
}
