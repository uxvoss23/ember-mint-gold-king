import { lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  MapPinned,
  Settings,
  Trophy,
  User,
  X,
  Zap,
} from "lucide-react";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { CourtsFinder } from "@/components/courts-finder";
import { CourtDetail } from "@/components/court-detail";
import { LeaderboardPanel } from "@/components/compete/leaderboard-panel";
const PlayHub = lazy(() =>
  import("@/components/compete/play-hub").then((m) => ({ default: m.PlayHub })),
);
import { YouHome, YouStats } from "@/components/compete/you-home";
import { MessagesInbox } from "@/components/compete/messages-inbox";
import { NoticeFeed, useNoticeToasts } from "@/components/compete/notice-feed";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { AdminWorkOrders } from "@/components/admin-work-orders";
import { AdminTestUsersLink } from "@/components/admin-test-users";
import { ModerationQueue } from "@/components/compete/moderation-queue";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut, authEnabled, authClient } from "@/lib/auth/client";
import { isModeratorMe } from "@/lib/auth/admin";
import { Link, useNavigate } from "@tanstack/react-router";
import { PlayerProfile, PrivacyAndDiscovery } from "@/components/compete/player-profile";
import { ProfileCompleteForm } from "@/components/compete/profile-complete-form";
import { isProfileComplete } from "@/lib/game/profile";
import type { Court, UserLocation } from "@/lib/courts/types";
import { isDemoMode } from "@/lib/config";
import {
  createGameFn,
  deleteAccountFn,
  joinGameFn,
} from "@/lib/game/fns";
import { mutationError, refreshCompetitiveSnapshot, refreshCompetitiveSnapshotSoon } from "@/lib/game/client-actions";
import { useCompetitiveSync } from "@/lib/game/use-competitive-sync";
import { useRequireAuth } from "@/lib/game/use-require-auth";
import { formatLocalWhen, useUpsetStore, clearAuthenticatedPlayer } from "@/lib/upset/store";
import { playAttentionCount } from "@/lib/upset/match-actions";
import type { Match, Player } from "@/lib/upset/types";
import { cn } from "@/lib/utils";
import {
  buildInbox,
  inboxReadVersion,
  inboxUnreadTotal,
  subscribeInboxRead,
} from "@/lib/messages/inbox";
import { useTabBarGate } from "@/lib/ui/tab-bar-gate";
import { useHydrateCourtSocial } from "@/lib/courts/social";
import { useHydrateCourtAdmin } from "@/lib/courts/admin-overrides";
import { maybeAskPushAfterGame } from "@/lib/push/client";
import { useDialogFocus } from "@/hooks/use-dialog-focus";

type SceneHome = "leaderboard" | "games" | "you" | "courts";
type YouPane = "home" | "messages" | "stats" | "settings" | "privacy" | "notifications" | "admin";

interface SceneShellProps {
  courts: Court[];
  location: UserLocation;
  courtsLoading?: boolean;
  courtsLocating?: boolean;
  courtsError?: string | null;
  courtsLocError?: string | null;
  radiusMi?: number;
  dataSource?: string;
  outOfArea?: boolean;
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
  radiusMi = 50,
  dataSource = "",
  outOfArea = false,
  onRadiusChange,
  onRefreshCourts,
  onNearMe,
  showTabBar = true,
}: SceneShellProps) {
  const store = useUpsetStore();
  const sync = useCompetitiveSync();
  const requireAuth = useRequireAuth();
  const { user, isPending } = useCurrentUserState();
  const signedIn = !!user;
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
  const [playVisited, setPlayVisited] = useState(false);
  const [boardVisited, setBoardVisited] = useState(false);
  const [youVisited, setYouVisited] = useState(false);
  const [needProfile, setNeedProfile] = useState(false);
  const [gameBackTo, setGameBackTo] = useState<"you" | null>(null);
  const [youPane, setYouPane] = useState<YouPane>("home");
  const [focusChatThreadId, setFocusChatThreadId] = useState<string | null>(null);
  const [playDeskFocus, setPlayDeskFocus] = useState<"my_games" | "lobby" | "create" | null>(null);

  const consumeFocusMatch = useCallback(() => {
    setFocusMatchId(null);
    setFocusChatThreadId(null);
  }, []);

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
    if (home === "games") setPlayVisited(true);
    if (home === "leaderboard") setBoardVisited(true);
    if (home === "you") setYouVisited(true);
  }, [home]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void import("@/components/compete/play-hub");
    }, 900);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    try {
      if (sessionStorage.getItem("uc-open-create") === "1") {
        setHome("games");
      }
    } catch {
      /* ignore */
    }
  }, [signedIn, user?.id]);

  useEffect(() => {
    try {
      const g = new URLSearchParams(window.location.search).get("g");
      const inbox = new URLSearchParams(window.location.search).get("inbox");
      if (g) {
        setFocusMatchId(g);
        setHome("games");
      } else if (inbox === "1") {
        setYouPane("messages");
        setHome("you");
      }
      if (g || inbox === "1") {
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const playBadge = playAttentionCount(store.matches, store.me);
  useSyncExternalStore(subscribeInboxRead, inboxReadVersion, inboxReadVersion);
  const messageUnread = signedIn
    ? inboxUnreadTotal(
        buildInbox({
          meId: store.me.id,
          matches: store.matches,
          dmThreads: store.dmThreads ?? [],
        }),
      )
    : 0;
  const noticeUnread = signedIn
    ? (store.notices ?? []).filter((n) => !n.readAt).length
    : 0;
  const meUnread = messageUnread + noticeUnread;
  useNoticeToasts(signedIn ? store.notices ?? [] : []);
  const upcomingCount = store.matches.filter(
    (m) =>
      (m.hostId === store.me.id || m.opponentId === store.me.id) &&
      (m.status === "open" ||
        m.status === "scheduled" ||
        m.status === "matched" ||
        m.status === "played_pending"),
  ).length;

  const goHome = useCallback((id: SceneHome) => {
    setHome(id);
    if (id === "you") setYouPane("home");
  }, []);

  const startQuickAtCourt = useCallback((court: Court) => {
    setSelectedCourt(null);
    setPresetCourt(court);
    setHome("games");
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {home !== "games" && home !== "leaderboard" && home !== "courts" && youPane === "home" && (
        <div className="mb-1 flex shrink-0 items-center justify-between gap-3 px-4 pt-2">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-fg">
              <span className="text-court">Upset City</span>
              <span className="font-normal text-fg-muted"> · Austin, TX</span>
            </p>
          </div>
          {signedIn ? (
            <button
              type="button"
              onClick={() => setYouPane("settings")}
              className="flex size-10 items-center justify-center rounded-full text-fg-muted"
              aria-label="Settings"
            >
              <Settings className="size-5" strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
      )}

      <div
        data-app-scroll
        className={cn(
          "min-h-0 flex-1",
          home === "courts" ||
          (home === "games" && playImmersive) ||
          (home === "you" && youPane !== "home")
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

        {(home === "games" || playVisited) && (
        <div
          className={cn(
            home === "games" ? "flex min-h-0 flex-1 flex-col" : "hidden",
          )}
          hidden={home !== "games"}
          aria-hidden={home !== "games"}
        >
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center text-sm text-fg-muted">
                Opening Play…
              </div>
            }
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
                refreshCompetitiveSnapshotSoon();
                maybeAskPushAfterGame();
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
                refreshCompetitiveSnapshotSoon();
                if (r.ok) maybeAskPushAfterGame();
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
            onFocusMatchConsumed={consumeFocusMatch}
            presetCourt={presetCourt}
            onPresetCourtConsumed={() => setPresetCourt(null)}
            active={home === "games"}
            gameBackTo={gameBackTo}
            focusChatThreadId={focusChatThreadId}
            playDeskFocus={playDeskFocus}
            onPlayDeskFocusConsumed={() => setPlayDeskFocus(null)}
            onGameBack={() => {
              setGameBackTo(null);
              setHome("you");
            }}
          />
          </Suspense>
        </div>
        )}

        {(home === "you" || youVisited) && (
          <div
            className={cn(
              home === "you" ? undefined : "hidden",
              youPane !== "home" && "flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-2",
            )}
            hidden={home !== "you"}
            aria-hidden={home !== "you"}
          >
          <YouSection
            me={store.me}
            signedIn={signedIn}
            matches={store.matches}
            players={store.players}
            pane={youPane}
            unreadCount={meUnread}
            upcomingCount={upcomingCount}
            onPane={setYouPane}
            onOpenProfile={() => {
              if (signedIn) setSelectedPlayer(store.me);
            }}
            onOpenMatch={(id) => {
              setGameBackTo("you");
              setFocusChatThreadId(null);
              setFocusMatchId(id);
              setHome("games");
            }}
            onOpenGameThread={(matchId, threadWithId) => {
              setYouPane("home");
              setGameBackTo("you");
              setFocusChatThreadId(threadWithId);
              setFocusMatchId(matchId);
              setHome("games");
            }}
            onGoPlay={() => setHome("games")}
            onOpenMyGames={() => {
              setYouPane("home");
              setPlayDeskFocus("my_games");
              setHome("games");
            }}
            onFindGame={() => {
              setYouPane("home");
              setPlayDeskFocus("lobby");
              setHome("games");
            }}
            onCreateGame={() => {
              setYouPane("home");
              setPlayDeskFocus("create");
              setHome("games");
            }}
            onGoStats={() => setYouPane("stats")}
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
              <CourtsFinder
                courts={courts}
                location={location}
                loading={courtsLoading}
                locating={courtsLocating}
                error={courtsError}
                locError={courtsLocError}
                radiusMi={radiusMi}
                dataSource={dataSource}
                outOfArea={outOfArea}
                onRadiusChange={(mi) => onRadiusChange?.(mi)}
                onRefresh={() => onRefreshCourts?.()}
                onNearMe={() => onNearMe?.()}
                onQuickMatch={startQuickAtCourt}
                focusCourtId={focusCourtId}
                onFocusCourtConsumed={() => setFocusCourtId(null)}
                active={home === "courts"}
              />
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
        className={cn("relative z-50", tabsHidden && "hidden")}
        hidden={tabsHidden}
        aria-hidden={tabsHidden}
      >
      <BottomTabBar>
        <div className="pointer-events-auto relative z-50 flex w-full max-w-lg items-end rounded-2xl border border-border-strong bg-bg-elevated/95 px-0.5 py-0.5 shadow-soft backdrop-blur-md">
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
                "relative flex min-w-0 flex-1 flex-col items-center gap-0 rounded-xl px-0.5 py-1.5 text-[9px] font-semibold leading-tight",
                home === t.id ? "bg-bg-soft text-fg" : "text-fg-muted",
              )}
              style={{ touchAction: "manipulation" }}
              aria-label={
                t.id === "games" && playBadge > 0 && home !== "games"
                  ? `Play, ${playBadge} waiting`
                  : t.id === "you" && meUnread > 0
                    ? `Me, ${meUnread} unread`
                    : t.label
              }
              aria-current={home === t.id ? "page" : undefined}
            >
              {t.id === "games" && playBadge > 0 && home !== "games" ? (
                <span
                  className="absolute top-1 right-[22%] size-2 rounded-full bg-court ring-2 ring-bg-elevated"
                  aria-hidden
                />
              ) : t.id === "you" && meUnread > 0 && home !== "you" ? (
                <span
                  className="absolute top-0.5 right-[18%] min-w-[1.05rem] rounded-full bg-court px-1 py-px text-[9px] font-bold leading-tight text-white"
                  aria-hidden
                >
                  {meUnread > 9 ? "9+" : meUnread}
                </span>
              ) : null}
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
        <ProfileCompleteDialog
          me={store.me}
          onClose={() => setNeedProfile(false)}
        />
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

function ProfileCompleteDialog({
  me,
  onClose,
}: {
  me: Player;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onClose(), [onClose]);
  useDialogFocus(panelRef, close);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        onClick={close}
        aria-label="Dismiss"
      />
      <div
        ref={panelRef}
        className="relative z-10 mb-0 w-full max-w-lg rounded-t-3xl border border-border bg-bg-elevated p-5 shadow-soft sm:mb-0 sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-complete-title"
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full border border-border text-fg-muted"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
        <ProfileCompleteForm me={me} onDone={close} />
      </div>
    </div>
  );
}

function YouSection({
  me,
  signedIn,
  matches,
  players,
  pane,
  unreadCount,
  upcomingCount,
  onPane,
  onOpenProfile,
  onOpenMatch,
  onOpenGameThread,
  onGoPlay,
  onOpenMyGames,
  onFindGame,
  onCreateGame,
  onGoStats,
}: {
  me: Player;
  signedIn: boolean;
  matches: Match[];
  players: Player[];
  pane: YouPane;
  unreadCount: number;
  upcomingCount: number;
  onPane: (pane: YouPane) => void;
  onOpenProfile: () => void;
  onOpenMatch: (id: string) => void;
  onOpenGameThread: (matchId: string, threadWithId: string) => void;
  onGoPlay: () => void;
  onOpenMyGames: () => void;
  onFindGame: () => void;
  onCreateGame: () => void;
  onGoStats: () => void;
}) {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const admin = isModeratorMe(me.role, user?.primaryEmail);
  const [settingsTab, setSettingsTab] = useState<"privacy" | "notifications">("privacy");
  const store = useUpsetStore();

  const doSignOut = () => {
    void (async () => {
      await signOut();
      clearAuthenticatedPlayer();
      await navigate({
        to: "/login",
        search: { signedout: true },
        replace: true,
      });
    })();
  };

  if (pane === "messages") {
    return (
      <MessagesInbox
        me={me}
        players={players}
        onBack={() => onPane("home")}
        onOpenGameThread={onOpenGameThread}
      />
    );
  }

  if (pane === "stats") {
    return (
      <YouStats
        me={me}
        matches={matches}
        players={players}
        onBack={() => onPane("home")}
        onOpenMatch={onOpenMatch}
      />
    );
  }

  if (pane === "admin") {
    return (
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-8">
        <button
          type="button"
          onClick={() => onPane("home")}
          className="min-h-11 px-1 text-[13px] font-medium text-fg-muted"
        >
          ← Me
        </button>
        <AdminWorkOrders email={user?.primaryEmail} />
        {admin ? <ModerationQueue /> : null}
        <AdminTestUsersLink role={me.role} email={user?.primaryEmail} />
      </div>
    );
  }

  if (pane === "settings") {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="flex items-center gap-2 pb-3">
          <button
            type="button"
            onClick={() => onPane("home")}
            className="min-h-11 px-1 text-[13px] font-medium text-fg-muted"
          >
            ← Me
          </button>
          <h2 className="flex-1 text-center font-display text-[17px] font-semibold text-fg">
            Settings
          </h2>
          <span className="w-12" aria-hidden />
        </div>
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-bg-elevated p-0.5">
          <button
            type="button"
            aria-label="Profile and privacy"
            onClick={() => setSettingsTab("privacy")}
            className={cn(
              "rounded-lg py-2 text-center text-[12px] font-semibold",
              settingsTab === "privacy" ? "bg-fg text-bg" : "text-fg-muted",
            )}
          >
            Profile & privacy
          </button>
          <button
            type="button"
            onClick={() => setSettingsTab("notifications")}
            className={cn(
              "rounded-lg py-2 text-center text-[12px] font-semibold",
              settingsTab === "notifications" ? "bg-fg text-bg" : "text-fg-muted",
            )}
          >
            Notifications
          </button>
        </div>
        {settingsTab === "privacy" ? (
          <div>
            <button
              type="button"
              onClick={onOpenProfile}
              className="mb-3 flex min-h-12 w-full items-center justify-between rounded-2xl bg-bg-elevated px-3.5 text-left text-[14px] text-fg"
            >
              View profile
              <span className="text-fg-subtle">›</span>
            </button>
            <PrivacyAndDiscovery me={me} />
          </div>
        ) : (
          <NoticeFeed
            notices={store.notices ?? []}
            onOpenGame={onOpenMatch}
            onOpenMessages={() => onPane("messages")}
          />
        )}
        {authEnabled && user ? (
          <button
            type="button"
            onClick={doSignOut}
            className="mt-8 w-full rounded-2xl py-3 text-center text-[13px] font-semibold text-danger"
          >
            Sign out
          </button>
        ) : null}
        <div className="mt-6 space-y-2 text-center text-[12px]">
          <Link to="/privacy" className="block font-medium text-fg-muted">
            Privacy Policy
          </Link>
          <Link to="/terms" className="block font-medium text-fg-muted">
            Terms of Service
          </Link>
          <Link to="/safety" className="block font-medium text-fg-muted">
            Community Guidelines
          </Link>
        </div>
        {authEnabled && user && !user.emailVerified ? (
          <button
            type="button"
            onClick={() => {
              if (!user.primaryEmail) return;
              void authClient.sendVerificationEmail({
                email: user.primaryEmail,
                callbackURL: "/login?verified=1",
              });
            }}
            className="mt-4 w-full text-center text-[12px] font-semibold text-court"
          >
            Resend verification email
          </button>
        ) : null}
        {authEnabled && user ? (
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("Delete your Upset City account? This cannot be undone.")) return;
              void (async () => {
                try {
                  await deleteAccountFn();
                  await signOut();
                  clearAuthenticatedPlayer();
                  await navigate({ to: "/login", search: { signedout: true }, replace: true });
                } catch {
                  /* keep session if delete failed */
                }
              })();
            }}
            className="mt-4 w-full text-center text-[12px] font-medium text-fg-subtle"
          >
            Delete account
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {signedIn ? (
        <YouHome
          me={me}
          signedIn={signedIn}
          accountName={user?.displayName ?? me.name}
          matches={matches}
          unreadCount={unreadCount}
          upcomingCount={upcomingCount}
          onOpenProfile={onOpenProfile}
          onOpenMatch={onOpenMatch}
          onOpenMessages={() => onPane("messages")}
          onOpenMyGames={onOpenMyGames}
          onOpenStats={onGoStats}
          onFindGame={onFindGame}
          onCreateGame={onCreateGame}
        />
      ) : (
        <div className="rounded-2xl bg-bg-elevated p-4">
          <p className="text-base font-semibold text-fg">Guest</p>
          <p className="mt-1 text-sm text-fg-muted">
            Browse courts, open games, and rankings. Sign in to post a 1v1 and
            get rated.
          </p>
        </div>
      )}

      {signedIn ? (
        <section>
          <p className="mb-2 text-[13px] font-semibold text-fg">Account</p>
          <div className="overflow-hidden rounded-2xl bg-bg-elevated">
            <SettingsRow label="Settings" last onClick={() => onPane("settings")} />
          </div>
        </section>
      ) : null}

      {admin ? (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-fg">Admin</p>
            <span className="text-[11px] font-semibold text-court">Admin only</span>
          </div>
          <div className="overflow-hidden rounded-2xl bg-bg-elevated">
            <SettingsRow label="Admin Tools" last onClick={() => onPane("admin")} />
          </div>
        </section>
      ) : null}

      {isPending ? (
        <p className="text-xs text-fg-muted">Checking session…</p>
      ) : user ? null : (
        <div className="space-y-2">
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
    </div>
  );
}

function SettingsSubhead({
  title,
  onBack,
  backLabel = "← Settings",
}: {
  title: string;
  onBack: () => void;
  backLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2 pb-3">
      <button
        type="button"
        onClick={onBack}
        className="min-h-11 px-1 text-[13px] font-medium text-fg-muted"
      >
        {backLabel}
      </button>
      <h2 className="flex-1 text-center font-display text-[17px] font-semibold text-fg">
        {title}
      </h2>
      <span className="w-[4.5rem]" aria-hidden />
    </div>
  );
}

function SettingsRow({
  label,
  hint,
  ariaLabel,
  last,
  onClick,
}: {
  label: string;
  hint?: string;
  ariaLabel?: string;
  last?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      onClick={onClick}
      className={cn(
        "flex min-h-12 w-full items-center justify-between gap-3 px-3.5 text-left",
        !last && "border-b border-border/60",
      )}
    >
      <span>
        <span className="block text-[14px] text-fg">{label}</span>
        {hint ? <span className="block text-[11px] text-fg-subtle">{hint}</span> : null}
      </span>
      <span className="text-fg-subtle">›</span>
    </button>
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
