import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  LocateFixed,
  MapPin,
  MessageCircle,
  Send,
  Plus,
  Search,
  User,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import { CourtAboutSheet } from "@/components/compete/court-about-sheet";
import { InviteReviewSheet } from "@/components/compete/invite-review-sheet";
import { CreateGameStepBar } from "@/components/compete/create-game-step-bar";
import {
  CreateWhenPicker,
  parseLocalDateTime,
  toLocalDateTimeValue,
} from "@/components/compete/create-when-picker";
import { HoopNowFlow } from "@/components/compete/hoop-now-flow";
import { PlayerBrowseFilters } from "@/components/compete/player-browse-filters";
import { MatchRemindersCard } from "@/components/compete/match-reminders-card";
import {
  reminderState,
  remindersCompleted,
} from "@/lib/match-reminders";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { CourtMapCutout } from "@/components/court-map-cutout";
import { CourtsMap } from "@/components/courts-map";
import { ImageCarousel } from "@/components/image-carousel";
import type { Court } from "@/lib/courts/types";
import { courtImagesFor, isPlaceholderPhoto } from "@/lib/courts/images";
import { directionsUrl } from "@/lib/maps/directions";
import { suggestAustinAddresses, type GeoHit } from "@/lib/maps/geocode";
import { displayRating } from "@/lib/rating/engine";
import { ScoreConfirmCard } from "@/components/compete/score-confirm-card";
import { CheckInBar } from "@/components/compete/check-in-bar";
import type { MatchFormat } from "@/lib/upset/types";
import { applyFriendsAndDms, formatLocalWhen, useUpsetStore } from "@/lib/upset/store";
import { matchActionsForPlayer, incomingInvitesFor } from "@/lib/upset/match-actions";
import { mutationError, refreshCompetitiveSnapshot, refreshCompetitiveSnapshotSoon } from "@/lib/game/client-actions";
import { ucMark } from "@/lib/perf/uc-mark";
import { setLiveSyncFast } from "@/lib/game/use-competitive-sync";
import type { Match, Player, PlayerReview } from "@/lib/upset/types";
import { cn, formatHeightInches } from "@/lib/utils";
import { useVisualKeyboard } from "@/hooks/use-visual-keyboard";
import { DEFAULT_BROWSE_FILTERS, loadBrowseFilters, persistBrowseFilters, clearPersistedBrowseFilters, playerMatchesBrowseFilters, type BrowseFilters } from "@/lib/upset/browse-filters";
import { isDemoMode, isMatchModeEnabled } from "@/lib/config";
import { GUEST_PLAYER_ID, isGuestPlayerId } from "@/lib/game/guest";
import { useRequireAuth } from "@/lib/game/use-require-auth";
import { addFriendFn } from "@/lib/game/dm-fns";
import {
  approveGameChangeFn,
  cancelGameFn,
  confirmScoreFn,
  disputeScoreFn,
  invitePlayerToGameFn,
  declineInviteFn,
  proposeGameChangeFn,
  sendGameMessageFn,
  submitScoreFn,
} from "@/lib/game/fns";
import { useTabBarGate } from "@/lib/ui/tab-bar-gate";
import { RATED_RULES_COPY } from "@/lib/game/rules";

type View = "explore" | "find" | "game" | "create" | "hoop_now" | "alerts_setup";
type ExploreLane = "open" | "tonight" | "rated";
type InviteFilter = "friends" | "available" | "active";
type InviteSortKey = "rating" | "height" | "streak";
const AUSTIN_CENTER = { lat: 30.2672, lon: -97.7431 };
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const RECOMMENDED_COURT_IDS = new Set([
  "cat-butler","cat-wooldridge","cat-rosewood","cat-zaragoza","cat-givens","cat-metz",
  "cat-hancock","cat-ramsey","cat-domain","cat-battle-bend","cat-pease","cat-bartholomew",
  "cat-reed","cat-garrison","cat-walnut-creek","cat-circle-c","cat-searight",
]);
function isShadedCourt(c: { amenities?: string[] }) { return (c.amenities ?? []).includes("shade"); }
function isRecommendedCourt(c: { id: string }) { return RECOMMENDED_COURT_IDS.has(c.id); }
function recommendScore(c: { id: string; amenities?: string[]; miles?: number; hoops?: number }) {
  let s = 0;
  if (RECOMMENDED_COURT_IDS.has(c.id)) s += 100;
  const a = new Set(c.amenities ?? []);
  if (a.has("shade")) s += 25; if (a.has("lights")) s += 20; if (a.has("parking")) s += 15;
  if (a.has("multiple")) s += 15; if (a.has("water")) s += 10; if (a.has("fence")) s += 8;
  if ((c.hoops ?? 0) >= 4) s += 12;
  if (typeof c.miles === "number") s += Math.max(0, 10 - c.miles);
  return s;
}

/** Closest eligible court when we know where you are; otherwise highest-rated. */
function defaultCreateCourtId(
  courts: Array<{ id: string; miles: number }>,
  hasPreciseLocation: boolean,
): string | null {
  if (courts.length === 0) return null;
  if (hasPreciseLocation) {
    let best = courts[0]!;
    for (let i = 1; i < courts.length; i++) {
      const c = courts[i]!;
      if (c.miles < best.miles) best = c;
    }
    return best.id;
  }
  let best = courts[0]!;
  let bestScore = recommendScore(best);
  for (let i = 1; i < courts.length; i++) {
    const c = courts[i]!;
    const score = recommendScore(c);
    if (score > bestScore || (score === bestScore && c.miles < best.miles)) {
      best = c;
      bestScore = score;
    }
  }
  return best.id;
}
interface QuickMatchFlowProps {
  me: Player; players: Player[]; courts: Court[]; matches: Match[];
  userLat?: number; userLon?: number;
  userLocationLabel?: string;
  onCreateMatch?: (input: {
    court: { id: string; name: string; lat: number; lon: number };
    preferredAt: string;
    mode: "ranked_1v1";
    format?: MatchFormat;
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
  compactHeader?: boolean;
  onImmersiveChange?: (immersive: boolean) => void;
  focusMatchId?: string | null;
  onFocusMatchConsumed?: () => void;
  presetCourt?: Court | null;
  onPresetCourtConsumed?: () => void;
  /** False when another tab is showing — don’t steal the tab bar. */
  active?: boolean;
  /** Opened this game from You / Upcoming — Back should return there. */
  gameBackTo?: "you" | null;
  onGameBack?: () => void;
}

function haversineMi(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8; const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1); const dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function inAustinMetro(lat: number, lon: number) { return lat >= 30.05 && lat <= 30.55 && lon >= -98.05 && lon <= -97.45; }
function formatMiles(mi: number) { if (mi < 0.1) return "<0.1 mi"; if (mi < 10) return `${mi.toFixed(1)} mi`; return `${Math.round(mi)} mi`; }
function formatSelectedDistance(mi: number, kind: "away" | "home" | "plain") {
  const dist = formatMiles(mi);
  if (kind === "away") return `${dist} away`;
  if (kind === "home") return `${dist} from home`;
  return dist;
}
function whenParts(iso: string) {
  try {
    const d = new Date(iso);
    return {
      day: d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      time: d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    };
  } catch {
    return { day: iso, time: "" };
  }
}
function seriesWins(scores: { a: number; b: number }[] | undefined, side: "a" | "b") { if (!scores?.length) return 0; let w = 0; for (const g of scores) if (side === "a" ? g.a > g.b : g.b > g.a) w += 1; return w; }
function scoreLine(scores: { a: number; b: number }[] | undefined) { if (!scores?.length) return ""; return scores.map((g) => `${g.a}–${g.b}`).join(", "); }
function inviteScore(p: Player, friendIds: string[], now = Date.now()) { let score = 0; if (p.availability === "available") score += 1_000_000; else if (p.availability === "busy") score += 200_000; if (friendIds.includes(p.id)) score += 500_000; if (p.lastPlayedAt) { const age = now - new Date(p.lastPlayedAt).getTime(); score += Math.max(0, TWO_WEEKS_MS - age); } return score; }
function resolveCourt(match: Match, courts: Court[]) { const byId = courts.find((c) => c.id === match.courtId); if (byId) return byId; let best: Court | null = null; let bestD = Infinity; for (const c of courts) { const d = Math.hypot(c.lat - match.lat, c.lon - match.lon); if (d < bestD) { bestD = d; best = c; } } if (best && bestD < 0.01) return best; return { id: match.courtId, name: match.courtName, lat: match.lat, lon: match.lon }; }
/** Austin ladder rank 1..50 or null */
function cityRankOf(players: Player[], playerId: string): number | null {
  const ordered = [...players]
    .filter((p) => p.city === "Austin" || !p.city)
    .sort((a, b) => b.rating - a.rating);
  const idx = ordered.findIndex((p) => p.id === playerId);
  if (idx < 0 || idx >= 50) return null;
  return idx + 1;
}

export function QuickMatchFlow({
  me, players, courts, matches, userLat, userLon, userLocationLabel,
  onCreateMatch, onAcceptMatch, onOpenPlayer,
  compactHeader = false, onImmersiveChange,
  focusMatchId = null, onFocusMatchConsumed,
  presetCourt = null, onPresetCourtConsumed,
  active = true,
  gameBackTo = null,
  onGameBack,
}: QuickMatchFlowProps) {
  const store = useUpsetStore();
  const requireAuth = useRequireAuth();
  const setTabsHidden = useTabBarGate((s) => s.setHidden);
  const [view, setView] = useState<View>("find");
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [postingCreate, setPostingCreate] = useState(false);
  const [createHeld, setCreateHeld] = useState(false);
  const [gameReturn, setGameReturn] = useState<"you" | "explore" | "find">("find");

  useEffect(() => {
    if (view === "create") setCreateHeld(true);
  }, [view]);

  const goExplore = useCallback(() => {
    startTransition(() => {
      setExploreLane(null);
      setOpenDeskTab("open");
      setView("find");
    });
  }, []);

  const goCreateBack = () => {
    if (createStep > 1) {
      startTransition(() => setCreateStep((s) => (s === 3 ? 2 : 1)));
      return;
    }
    goExplore();
  };
  const [exploreLane, setExploreLane] = useState<ExploreLane | null>(null);
  const [openDeskTab, setOpenDeskTab] = useState<"open" | "scheduled" | "waiting">("open");
  /** Highlight newly approved game on Scheduled without opening detail */
  const [justLandedMatchId, setJustLandedMatchId] = useState<string | null>(null);
  /** Force set-alerts prompt right after plan approval */
  const [alertsPromptMatchId, setAlertsPromptMatchId] = useState<string | null>(
    null,
  );
  /** Bump to re-read reminder localStorage on list */
  const [reminderTick, setReminderTick] = useState(0);

  const goToScheduledAfterAlerts = useCallback((matchId: string) => {
    setAlertsPromptMatchId(null);
    setReminderTick((n) => n + 1);
    setSelectedId(null);
    setGameTab("details");
    setExploreLane(null);
    setJustLandedMatchId(matchId);
    setOpenDeskTab("scheduled");
    setView("find");
    setStatusMsg("You’re on Scheduled — alerts are set for this run.");
    window.setTimeout(() => {
      setJustLandedMatchId((cur) => (cur === matchId ? null : cur));
    }, 10000);
    window.setTimeout(() => setStatusMsg(null), 4000);
  }, []);

  // After approve + alerts done → always land on Scheduled (no extra tap)
  useEffect(() => {
    if (view !== "alerts_setup" || !alertsPromptMatchId) return;
    if (!remindersCompleted(alertsPromptMatchId)) return;
    const id = alertsPromptMatchId;
    const t = window.setTimeout(() => goToScheduledAfterAlerts(id), 40);
    return () => window.clearTimeout(t);
  }, [view, alertsPromptMatchId, goToScheduledAfterAlerts, reminderTick]);

  // If match data is missing on alerts screen, still don't trap the user
  useEffect(() => {
    if (view !== "alerts_setup" || !alertsPromptMatchId) return;
    const id = alertsPromptMatchId;
    const hit =
      store.matches.find((x) => x.id === id) ??
      matches.find((x) => x.id === id);
    if (hit) return;
    const t = window.setTimeout(() => goToScheduledAfterAlerts(id), 600);
    return () => window.clearTimeout(t);
  }, [
    view,
    alertsPromptMatchId,
    store.matches,
    matches,
    goToScheduledAfterAlerts,
  ]);

  const [lobbySort, setLobbySort] = useState<
    "recent" | "recommended" | "rating_desc" | "nearest" | null
  >("recent");
  const [lobbySortOpen, setLobbySortOpen] = useState(false);
  const [browseFilters, setBrowseFilters] = useState<BrowseFilters>(() => loadBrowseFilters().filters);
  const [browseFiltersSaved, setBrowseFiltersSaved] = useState(() => loadBrowseFilters().saved);

  const updateBrowseFilters = (next: BrowseFilters) => {
    setBrowseFilters(next);
    persistBrowseFilters(next, browseFiltersSaved);
  };

  const setBrowseFiltersSavedFlag = (saved: boolean) => {
    setBrowseFiltersSaved(saved);
    if (saved) {
      persistBrowseFilters(browseFilters, true);
    } else {
      // Keep current filters but mark unsaved with fresh 24h clock
      persistBrowseFilters(browseFilters, false);
    }
  };

  const resetBrowseFilters = () => {
    setBrowseFilters({ ...DEFAULT_BROWSE_FILTERS });
    setBrowseFiltersSaved(false);
    clearPersistedBrowseFilters();
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createCourtId, setCreateCourtId] = useState("");
  const [createCourtTouched, setCreateCourtTouched] = useState(false);
  const [createCourtLocked, setCreateCourtLocked] = useState(false);
  const [createWhen, setCreateWhen] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createFormat, setCreateFormat] = useState<"1v1" | "horse">("1v1");
  const [createBringingBall, setCreateBringingBall] = useState<boolean | null>(null);
  const [joinBringingBall, setJoinBringingBall] = useState<boolean | null>(null);
  const [createHood, setCreateHood] = useState("all");
  const [createSorts, setCreateSorts] = useState<Set<string>>(() => new Set(["highest_rated", "nearest"]));
  const [createRadiusMi, setCreateRadiusMi] = useState(5);
  const [createPickMode, setCreatePickMode] = useState<"photos" | "map">("map");
  const [createFiltersOpen, setCreateFiltersOpen] = useState(false);
  const createMapMarked = useRef(false);
  const [courtInfoId, setCourtInfoId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteFilters, setInviteFilters] = useState<Set<InviteFilter>>(() => new Set());
  const [inviteSorts, setInviteSorts] = useState<Set<InviteSortKey>>(() => new Set());
  /** Players invited while building a new open game */
  const [createInviteIds, setCreateInviteIds] = useState<string[]>([]);
  const [createInviteOpen, setCreateInviteOpen] = useState(false);
  /** public = Public match; invite_only = Private match */
  const [createVisibility, setCreateVisibility] = useState<"public" | "invite_only">(
    "public",
  );
  const [chatDraft, setChatDraft] = useState("");
  const [gameTab, setGameTab] = useState<"details" | "chat">("details");
  useEffect(() => {
    setGameTab("details");
    setChatDraft("");
    setChangeCourtOpen(false);
    setChangeCourtId("");
    setChangeWhen("");
  }, [selectedId]);
  const [changeCourtOpen, setChangeCourtOpen] = useState(false);
  const [changeCourtId, setChangeCourtId] = useState("");
  const [changeWhen, setChangeWhen] = useState("");
  const chatComposerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const createGridRef = useRef<HTMLDivElement>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [reviewInviteId, setReviewInviteId] = useState<string | null>(null);
  const [actionExpandId, setActionExpandId] = useState<string | null>(null);
  const [waitingExpandId, setWaitingExpandId] = useState<string | null>(null);
  const [editingWaitId, setEditingWaitId] = useState<string | null>(null);
  const [nudgeFlash, setNudgeFlash] = useState<string | null>(null);
  const [waitingChat, setWaitingChat] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [nearOrigin, setNearOrigin] = useState<{
    lat: number; lon: number; label: string; source: "gps" | "address";
  } | null>(null);
  const [locatingNear, setLocatingNear] = useState(false);
  const [nearLocError, setNearLocError] = useState<string | null>(null);
  const [showAddressEntry, setShowAddressEntry] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressHits, setAddressHits] = useState<GeoHit[]>([]);
  const [addressSearching, setAddressSearching] = useState(false);

  // Deep-link from Me / Upcoming: open the game sheet. Must win over the
  // "Play just became active with alerts → scheduled desk" effect below.
  useEffect(() => {
    if (!focusMatchId) return;
    const exists =
      matches.some((m) => m.id === focusMatchId) ||
      store.matches.some((m) => m.id === focusMatchId);
    if (!exists) {
      onFocusMatchConsumed?.();
      return;
    }
    setSelectedId(focusMatchId);
    setView("game");
    setGameTab("details");
    setGameReturn(gameBackTo === "you" ? "you" : "find");
    onFocusMatchConsumed?.();
  }, [focusMatchId, matches, store.matches, onFocusMatchConsumed, gameBackTo]);

  const parentOrigin = {
    lat: userLat ?? AUSTIN_CENTER.lat,
    lon: userLon ?? AUSTIN_CENTER.lon,
  };
  const parentLooksLikeGps =
    userLat != null && userLon != null &&
    !!userLocationLabel &&
    userLocationLabel !== "Austin, TX" &&
    userLocationLabel !== "Austin";
  const origin = nearOrigin
    ? { lat: nearOrigin.lat, lon: nearOrigin.lon }
    : parentOrigin;
  const hasPreciseLocation = !!nearOrigin || parentLooksLikeGps;
  const createMapLocation = useMemo(
    () => ({ lat: origin.lat, lon: origin.lon, label: "You" as const }),
    [origin.lat, origin.lon],
  );

  useLayoutEffect(() => {
    if (!active) return;
    if (view === "create") {
      setTabsHidden(true);
      onImmersiveChange?.(true);
      document.documentElement.style.setProperty("--uc-tab-h", "0px");
    }
  }, [active, view, onImmersiveChange, setTabsHidden]);

  useEffect(() => {
    if (view === "explore") {
      setView("find");
      return;
    }
    if (view === "hoop_now" && !isMatchModeEnabled()) {
      setView("find");
    }
  }, [view]);

  useEffect(() => {
    if (!active) {
      onImmersiveChange?.(false);
      setTabsHidden(false);
      return;
    }
    if (view !== "create") setTabsHidden(false);
    const immersive =
      view === "game" ||
      view === "create" ||
      view === "find" ||
      view === "hoop_now" ||
      view === "alerts_setup";
    onImmersiveChange?.(immersive);
  }, [active, view, onImmersiveChange, setTabsHidden]);

  useLayoutEffect(() => {
    return () => {
      onImmersiveChange?.(false);
      setTabsHidden(false);
    };
    // Unmount only — don't toggle immersive off between view changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!parentLooksLikeGps || nearOrigin) return;
    if (userLat == null || userLon == null) return;
    setNearOrigin({ lat: userLat, lon: userLon, label: userLocationLabel ?? "Near you", source: "gps" });
  }, [parentLooksLikeGps, userLat, userLon, userLocationLabel, nearOrigin]);

  useEffect(() => {
    if (!showAddressEntry) return;
    const q = addressQuery.trim();
    if (q.length < 3) {
      setAddressHits([]);
      setAddressSearching(false);
      return;
    }
    let cancelled = false;
    setAddressSearching(true);
    const tmr = window.setTimeout(async () => {
      const hits = await suggestAustinAddresses(q, 6);
      if (cancelled) return;
      setAddressHits(hits);
      setAddressSearching(false);
    }, 320);
    return () => { cancelled = true; window.clearTimeout(tmr); };
  }, [addressQuery, showAddressEntry]);

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const friendIds = store.friendIds ?? [];

  const courtOptions = useMemo(
    () =>
      courts
        .map((c) => ({
          ...c,
          miles: haversineMi(origin.lat, origin.lon, c.lat, c.lon),
        }))
        .sort((a, b) => a.miles - b.miles)
        .slice(0, 40),
    [courts, origin.lat, origin.lon],
  );

  const createFilteredCourts = useMemo(() => {
    const wantHighest = createSorts.has("highest_rated");
    const wantShaded = createSorts.has("shaded");
    const wantNearest = createSorts.has("nearest");
    let filtered = [...courtOptions];
    if (createHood !== "all") {
      filtered = filtered.filter((c) => c.neighborhood === createHood);
    }
    if (wantHighest) filtered = filtered.filter((c) => isRecommendedCourt(c));
    if (wantShaded) filtered = filtered.filter((c) => isShadedCourt(c));
    if (wantNearest && hasPreciseLocation) {
      filtered = filtered.filter((c) => c.miles <= createRadiusMi + 0.05);
    }
    filtered.sort((a, b) => {
      if (a.miles !== b.miles) return a.miles - b.miles;
      return a.name.localeCompare(b.name);
    });
    return filtered;
  }, [courtOptions, createHood, createSorts, createRadiusMi, hasPreciseLocation]);

  const openGames = useMemo(
    () =>
      matches
        .filter((m) => {
          if (m.status !== "open") return false;
          if (m.hostId === me.id) return false;
          // Include both 1v1 and HORSE open games
          const fmt = m.format ?? "1v1";
          if (fmt !== "1v1" && fmt !== "horse") return false;
          if (!inAustinMetro(m.lat, m.lon)) return false;
          // Private invites never appear in the public lobby
          if (m.inviteOnly) return false;
          return true;
        })
        .map((m) => ({
          match: m,
          miles: haversineMi(origin.lat, origin.lon, m.lat, m.lon),
        }))
        // Default list: most recently posted first
        .sort(
          (a, b) =>
            (b.match.createdAt ?? b.match.preferredAt).localeCompare(
              a.match.createdAt ?? a.match.preferredAt,
            ) || a.miles - b.miles,
        ),
    [matches, me.id, origin.lat, origin.lon],
  );

  const laneOpenGames = useMemo(() => {
    const now = Date.now();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return openGames.filter(({ match: m, miles }) => {
      if (exploreLane === "tonight") {
        const t = new Date(m.preferredAt).getTime();
        if (!(t >= now && t <= endOfDay.getTime())) return false;
      }
      const host = players.find((p) => p.id === m.hostId);
      if (!host) return false;
      return playerMatchesBrowseFilters(host, browseFilters, miles);
    });
  }, [openGames, exploreLane, players, browseFilters]);

  /** Fair match score — closer rating + similar win% + not too far = recommended */
  const lobbyMatchScore = (host: Player, miles: number) => {
    const myG = me.wins + me.losses;
    const hostG = host.wins + host.losses;
    const myPct = myG > 0 ? me.wins / myG : 0.5;
    const hostPct = hostG > 0 ? host.wins / hostG : 0.5;
    const ratingGap = Math.abs(host.rating - me.rating);
    const winGap = Math.abs(hostPct - myPct);
    let score = 1000;
    score -= ratingGap * 1.8;
    score -= winGap * 220;
    score -= Math.min(miles, 25) * 4;
    if (ratingGap <= 50) score += 120;
    else if (ratingGap <= 100) score += 70;
    else if (ratingGap <= 150) score += 30;
    if (winGap <= 0.12) score += 40;
    return score;
  };

  const isLobbyRecommended = (host: Player, miles: number) => {
    const ratingGap = Math.abs(host.rating - me.rating);
    const myG = me.wins + me.losses;
    const hostG = host.wins + host.losses;
    const myPct = myG > 0 ? me.wins / myG : 0.5;
    const hostPct = hostG > 0 ? host.wins / hostG : 0.5;
    const winGap = Math.abs(hostPct - myPct);
    return ratingGap <= 150 && winGap <= 0.25 && miles <= 20;
  };

  const sortedLobbyGames = useMemo(() => {
    const list = [...laneOpenGames];
    const recentKey = (m: Match) => m.createdAt ?? m.preferredAt;
    list.sort((a, b) => {
      const hostA = players.find((p) => p.id === a.match.hostId);
      const hostB = players.find((p) => p.id === b.match.hostId);
      if (!hostA || !hostB) return 0;
      if (lobbySort === "rating_desc") {
        return hostB.rating - hostA.rating || a.miles - b.miles;
      }
      if (lobbySort === "nearest") {
        return a.miles - b.miles || hostB.rating - hostA.rating;
      }
      if (lobbySort === "recommended") {
        const recA = isLobbyRecommended(hostA, a.miles) ? 1 : 0;
        const recB = isLobbyRecommended(hostB, b.miles) ? 1 : 0;
        if (recB !== recA) return recB - recA;
        return (
          lobbyMatchScore(hostB, b.miles) - lobbyMatchScore(hostA, a.miles) ||
          a.miles - b.miles
        );
      }
      // recent (default) or null — most recently posted first
      return (
        recentKey(b.match).localeCompare(recentKey(a.match)) ||
        a.miles - b.miles
      );
    });
    return list;
  }, [laneOpenGames, lobbySort, players, me.rating, me.wins, me.losses]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return (
      matches.find((m) => m.id === selectedId) ??
      store.matches.find((m) => m.id === selectedId) ??
      null
    );
  }, [selectedId, matches, store.matches]);

  /**
   * Scheduled desk: locked games + score flow until dual-confirm.
   * Stays until status is confirmed (or cancelled).
   */
  const scheduledDeskGames = useMemo(() => {
    // Prefer live store so a just-approved Match Mode run shows immediately
    const source =
      store.matches.length > 0 ? store.matches : matches;
    const mine = source.filter((m) => {
      if (m.status === "cancelled" || m.status === "confirmed") return false;
      const party =
        m.hostId === me.id ||
        m.opponentId === me.id ||
        (m.rosterIds ?? []).includes(me.id);
      if (!party) return false;
      return (
        m.status === "matched" ||
        m.status === "scheduled" ||
        m.status === "played_pending" ||
        m.status === "disputed"
      );
    });

    const urgency = (m: Match) => {
      if (m.status === "disputed") return 300;
      if (m.status === "played_pending" && m.scores?.length) {
        // You still need to confirm → top
        if (m.scoreEnteredBy && m.scoreEnteredBy !== me.id) return 250;
        // You submitted, waiting on them → bottom of active
        if (m.scoreEnteredBy === me.id) return 10;
        return 200;
      }
      // Upcoming locked games — by time soon
      return 100;
    };

    return [...mine].sort((a, b) => {
      const ua = urgency(a);
      const ub = urgency(b);
      if (ub !== ua) return ub - ua;
      return (a.scheduledAt ?? a.preferredAt).localeCompare(
        b.scheduledAt ?? b.preferredAt,
      );
    });
  }, [matches, store.matches, me.id]);

  const myHostingOpen = useMemo(
    () => matches.filter((m) => m.hostId === me.id && m.status === "open"),
    [matches, me.id],
  );
  const incomingInvites = useMemo(
    () => incomingInvitesFor(matches, me.id),
    [matches, me.id],
  );
  const needsYou = useMemo(() => matchActionsForPlayer(matches, me), [matches, me]);
  const needsYouActive = useMemo(() => needsYou.filter((a) => a.kind !== "waiting_confirm"), [needsYou]);
  const waitingOnThem = useMemo(() => needsYou.filter((a) => a.kind === "waiting_confirm"), [needsYou]);
  const playAlerts = incomingInvites.length + needsYouActive.length;
  const wasPlayActive = useRef(false);
  useEffect(() => {
    const justOpened = active && !wasPlayActive.current;
    wasPlayActive.current = active;
    if (!justOpened || playAlerts === 0) return;
    if (focusMatchId) return;
    if (view === "create" || view === "game" || view === "hoop_now") return;
    setExploreLane("open");
    setOpenDeskTab("scheduled");
    setView("find");
  }, [active, playAlerts, view, focusMatchId]);

  useEffect(() => {
    const on = (view === "game" && gameTab === "chat") || !!reviewInviteId;
    setLiveSyncFast(on);
    return () => setLiveSyncFast(false);
  }, [view, gameTab, reviewInviteId]);

  const inviteCandidates = useMemo(() => {
    const now = Date.now();
    let list = players.filter((p) => p.id !== me.id);
    if (inviteQuery.trim()) {
      const q = inviteQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.handle.toLowerCase().includes(q) ||
          (p.neighborhood ?? "").toLowerCase().includes(q),
      );
    }
    // Multi-select filters (AND when multiple)
    if (inviteFilters.has("friends")) {
      list = list.filter((p) => friendIds.includes(p.id));
    }
    if (inviteFilters.has("available")) {
      list = list.filter((p) => p.availability === "available");
    }
    if (inviteFilters.has("active")) {
      list = list.filter(
        (p) =>
          p.availability === "available" ||
          (p.lastPlayedAt &&
            now - new Date(p.lastPlayedAt).getTime() < TWO_WEEKS_MS),
      );
    }
    // Multi-select sorts — apply selected keys in order: rating → height → streak
    // (only keys the user turned on). Unselected keys are ignored.
    return [...list].sort((a, b) => {
      if (inviteSorts.has("rating")) {
        const d = b.rating - a.rating;
        if (d !== 0) return d;
      }
      if (inviteSorts.has("height")) {
        const d = b.heightIn - a.heightIn;
        if (d !== 0) return d;
      }
      if (inviteSorts.has("streak")) {
        const d = (b.streak ?? 0) - (a.streak ?? 0);
        if (d !== 0) return d;
      }
      // Default / tie-break: online + friends + recent activity
      return inviteScore(b, friendIds, now) - inviteScore(a, friendIds, now);
    });
  }, [players, me.id, inviteQuery, inviteFilters, inviteSorts, friendIds]);

  const requestNearLocation = () => {
    setNearLocError(null);
    if (!navigator.geolocation) {
      setNearLocError("Location isn’t available on this device.");
      setShowAddressEntry(true);
      return;
    }
    setLocatingNear(true);
    ucMark("geo:start");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        ucMark("geo:done");
        setNearOrigin({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: "Near you", source: "gps" });
        setLocatingNear(false);
        setShowAddressEntry(false);
        setNearLocError(null);
      },
      (err) => {
        ucMark("geo:fail");
        setLocatingNear(false);
        setNearLocError(err.code === 1 ? "Denied — type an address" : "GPS failed — type an address");
        setShowAddressEntry(true);
      },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 120_000 },
    );
  };

  useEffect(() => {
    if (view !== "create") return;
    if (!createSorts.has("nearest")) return;
    if (nearOrigin || parentLooksLikeGps || locatingNear) return;
    if (nearLocError) return;
    requestNearLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, createSorts, nearOrigin, parentLooksLikeGps]);

  const pickAddressHit = (hit: GeoHit) => {
    setNearOrigin({
      lat: hit.lat,
      lon: hit.lon,
      label: hit.label,
      source: "address",
    });
    setAddressQuery(hit.label);
    setAddressHits([]);
    setShowAddressEntry(false);
    setNearLocError(null);
  };

  // Courts map → Play: jump to create with court already chosen
  useEffect(() => {
    if (!presetCourt) return;
    setCreateCourtId(presetCourt.id);
    setCreateCourtTouched(true);
    setCreateCourtLocked(true);
    setCreateWhen("");
    setCreateNotes("");
    setCreateBringingBall(null);
    setCreateInviteIds([]);
    setCreateInviteOpen(false);
    setCreateVisibility("public");
    setCreateFiltersOpen(false);
    setCourtInfoId(null);
    setCreateStep(1);
    onImmersiveChange?.(true);
    setTabsHidden(true);
    setView("create");
    onPresetCourtConsumed?.();
  }, [presetCourt?.id]);


  const revealChatComposer = useCallback(() => {
    const el = chatComposerRef.current;
    if (!el) return;
    // Scroll input into the visible area above the keyboard
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(() => {
        el.scrollIntoView({ block: "end", behavior: "smooth" });
      }, 280);
    });
  }, []);

  // Keep game chat above the soft keyboard (iOS/Android)
  useEffect(() => {
    if (view !== "game") {
      setKeyboardInset(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset > 60 ? inset : 0);
      if (document.activeElement === chatInputRef.current) {
        chatComposerRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
      }
    };
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    sync();
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, [view, selectedId]);

  const startCreate = () => {
    if (!requireAuth("create")) return;
    ucMark("create:open");
    setCreateCourtId("");
    setCreateCourtTouched(false);
    setCreateCourtLocked(false);
    setCreateWhen("");
    setCreateNotes("");
    setCreateBringingBall(null);
    setCreateInviteIds([]);
    setCreateInviteOpen(false);
    setCreateVisibility("public");
    setCreateSorts(new Set(["highest_rated", "nearest"]));
    setCreateFiltersOpen(false);
    setCourtInfoId(null);
    setCreateStep(1);
    onImmersiveChange?.(true);
    setTabsHidden(true);
    setView("create");
  };

  useEffect(() => {
    if (!active) return;
    try {
      if (sessionStorage.getItem("uc-open-create") !== "1") return;
      if (isGuestPlayerId(me.id)) return;
      sessionStorage.removeItem("uc-open-create");
      startCreate();
    } catch {
      /* ignore */
    }
  }, [me.id, active]);

  const chooseCreateCourt = (id: string) => {
    if (!createFilteredCourts.some((c) => c.id === id)) return;
    setCreateCourtId(id);
    setCreateCourtTouched(true);
  };

  const resetCreateFilters = () => {
    setCreateHood("all");
    setCreateSorts(new Set());
  };

  useEffect(() => {
    if (view !== "create" || createStep !== 1 || createCourtLocked) return;
    const stillValid =
      !!createCourtId && createFilteredCourts.some((c) => c.id === createCourtId);
    if (createCourtTouched && stillValid) return;
    const next = defaultCreateCourtId(createFilteredCourts, hasPreciseLocation) ?? "";
    if (next === createCourtId) return;
    ucMark("create:selected");
    setCreateCourtId(next);
  }, [
    view,
    createStep,
    createCourtLocked,
    createCourtTouched,
    createCourtId,
    createFilteredCourts,
    hasPreciseLocation,
  ]);

  const submitCreate = async () => {
    if (!requireAuth("create")) return;
    if (!createCourtId) { setStatusMsg("Pick a court before posting."); return; }
    if (!createWhen) { setStatusMsg("Pick a date and time before posting."); return; }
    if (createBringingBall === null) { setStatusMsg("Say if you’re bringing a basketball."); return; }
    if (createVisibility === "invite_only" && createInviteIds.length === 0) {
      setStatusMsg("Private matches need at least one invite.");
      return;
    }
    const court = courts.find((c) => c.id === createCourtId);
    if (!court) { setStatusMsg("Pick a court before posting."); return; }
    const whenDate = parseLocalDateTime(createWhen);
    if (whenDate.getTime() < Date.now() - 60_000) { setStatusMsg("Pick a time in the future."); return; }
    const formatLabel = createFormat === "horse" ? "HORSE" : "1v1";
    const inviteOnly = createVisibility === "invite_only";
    setPostingCreate(true);
    try {
      const created = await onCreateMatch?.({
        court: { id: court.id, name: court.name, lat: court.lat, lon: court.lon },
        preferredAt: whenDate.toISOString(),
        mode: "ranked_1v1",
        format: createFormat,
        notes: createNotes.trim() || undefined,
        hostBringingBall: createBringingBall,
        guestInviteIds: createInviteIds,
        inviteOnly,
      });
      if (!created && !isDemoMode()) {
        // parent already set an error toast
        return;
      }
      setStatusMsg(
        inviteOnly
          ? `${formatLabel} · Private match · ${createInviteIds.length} invite${createInviteIds.length === 1 ? "" : "s"}.`
          : createInviteIds.length
            ? `${formatLabel} · Public match · ${createInviteIds.length} invite${createInviteIds.length === 1 ? "" : "s"} sent.`
            : `${formatLabel} · Public match — anyone can join.`,
      );
      setCreateInviteIds([]);
      setCreateVisibility("public");
      if (created && typeof created === "object" && "id" in created) {
        setSelectedId(created.id);
        setView("game");
        setGameTab("details");
      } else {
        setExploreLane("open");
        setOpenDeskTab(inviteOnly ? "scheduled" : "open");
        setView("find");
      }
    } catch (err) {
      setStatusMsg(mutationError(err));
    } finally {
      setPostingCreate(false);
    }
  };

  const openGame = (id: string, back: "you" | "explore" | "find" = "find") => {
    setSelectedId(id);
    setView("game");
    setGameReturn(back);
    setChatDraft("");
    setJoinBringingBall(null);
  };

  const closeGame = () => {
    setSelectedId(null);
    setGameTab("details");
    if (gameReturn === "you") {
      setView("find");
      onGameBack?.();
      return;
    }
    setView(gameReturn === "explore" ? "find" : gameReturn);
  };

  const joinGame = async (id: string, bringingBall?: boolean) => {
    if (!requireAuth("join")) return;
    if (bringingBall === undefined) { setStatusMsg("Say if you’re bringing a basketball before joining."); return; }
    const r = await onAcceptMatch?.(id, { bringingBall });
    if (r === "filled") setStatusMsg("That game just filled.");
    else if (r === "invite_only") setStatusMsg("This is a private match — invite only.");
    else if (r === "ok" || r === undefined) {
      const m = matches.find((x) => x.id === id);
      const neither = m?.hostBringingBall === false && bringingBall === false;
      setStatusMsg(neither ? "You’re in — neither of you is bringing a ball. Work it out in chat." : "You’re in — after the run, confirm scores under Needs you on Play.");
      setSelectedId(id);
      setView("game");
      setJoinBringingBall(null);
    }
  };

  const sendMatchChat = async (gameId: string, text: string) => {
    if (!requireAuth("message")) return;
    const body = text.trim();
    if (!body) return;
    store.postMatchChat(gameId, text);
    if (isDemoMode()) return;
    try {
      await sendGameMessageFn({ data: { gameId, text: body } });
      refreshCompetitiveSnapshotSoon();
    } catch (err) {
      setStatusMsg(mutationError(err));
    }
  };


  const aboutSheet =
    courtInfoId ? (
      <CourtAboutSheet
        court={
          courtOptions.find((c) => c.id === courtInfoId) ??
          courts.find((c) => c.id === courtInfoId) ??
          null
        }
        onClose={() => setCourtInfoId(null)}
        onSelectCourt={(id) => {
          chooseCreateCourt(id);
          setCourtInfoId(null);
        }}
        isSelected={createCourtId === courtInfoId}
        userLat={origin.lat}
        userLon={origin.lon}
      />
    ) : null;

  const reviewInvite = reviewInviteId
    ? matches.find((m) => m.id === reviewInviteId) ?? null
    : null;
  const inviteReviewSheet =
    reviewInvite ? (
      <InviteReviewSheet
        match={reviewInvite}
        host={playerById.get(reviewInvite.hostId)}
        me={me}
        court={courts.find((c) => c.id === reviewInvite.courtId) ?? null}
        onClose={() => setReviewInviteId(null)}
        onSendChat={(text) => void sendMatchChat(reviewInvite.id, text)}
        onOpenPlayer={onOpenPlayer}
        onDecline={async () => {
          if (isDemoMode()) {
            store.declinePrivateInvite(reviewInvite.id);
          } else {
            await declineInviteFn({ data: { gameId: reviewInvite.id } });
            refreshCompetitiveSnapshotSoon();
          }
          setReviewInviteId(null);
          setStatusMsg("Invite declined.");
        }}
        onAccept={async (bringingBall) => {
          await joinGame(reviewInvite.id, bringingBall);
          setReviewInviteId(null);
        }}
      />
    ) : null;

  // CREATE — keep the pane mounted after first visit so Back/Explore doesn’t rebuild the map
  let createPane: ReactNode = null;
  if (view === "create" || (createHeld && (view === "explore" || view === "find"))) {
    const hoods = Array.from(
      new Set(courtOptions.map((c) => c.neighborhood).filter((n): n is string => !!n && n.length > 0)),
    ).sort();
    const filteredCourts = createFilteredCourts;

    const selectedCreateCourt = createCourtId
      ? filteredCourts.find((c) => c.id === createCourtId) ??
        (createCourtLocked
          ? (courtOptions.find((c) => c.id === createCourtId) ??
            courts.find((c) => c.id === createCourtId))
          : undefined)
      : undefined;
    const createImages = selectedCreateCourt
      ? courtImagesFor(selectedCreateCourt.id, 5)
      : [];
    const invitedPlayers = createInviteIds
      .map((id) => playerById.get(id))
      .filter((p): p is Player => !!p);
    const mapImmersive =
      createStep === 1 && createPickMode === "map" && !createCourtLocked;
    if (mapImmersive && !createMapMarked.current) {
      createMapMarked.current = true;
      ucMark("create:map-jsx");
    }
    const mapThumb = selectedCreateCourt
      ? courtImagesFor(selectedCreateCourt.id, 1)[0]
      : undefined;
    const hasRealPhoto = Boolean(mapThumb) && !isPlaceholderPhoto(mapThumb);
    const browseCourts = filteredCourts;
    const browseIndex = selectedCreateCourt
      ? browseCourts.findIndex((c) => c.id === selectedCreateCourt.id)
      : -1;
    const selectedMiles = selectedCreateCourt
      ? "miles" in selectedCreateCourt &&
        typeof selectedCreateCourt.miles === "number"
        ? selectedCreateCourt.miles
        : haversineMi(
            origin.lat,
            origin.lon,
            selectedCreateCourt.lat,
            selectedCreateCourt.lon,
          )
      : null;
    const distanceKind: "away" | "home" | "plain" = hasPreciseLocation
      ? "away"
      : "plain";
    const createAutoLabel = !selectedCreateCourt
      ? null
      : hasPreciseLocation && browseIndex === 0
        ? "Closest court"
        : !hasPreciseLocation && !createCourtTouched
          ? "Highest rated"
          : null;
    const stepBrowseCourt = (delta: number) => {
      if (browseIndex < 0) return;
      const next = browseCourts[browseIndex + delta];
      if (next) chooseCreateCourt(next.id);
    };
    const noMatchFilters = (
      <div className="rounded-xl border border-border bg-bg-elevated px-3 py-3 text-center">
        <p className="text-[13px] font-semibold text-fg">No courts match these filters</p>
        <button
          type="button"
          onClick={resetCreateFilters}
          className="uc-press mt-2 text-[12px] font-semibold text-court"
        >
          Show all courts
        </button>
      </div>
    );
    const filterParts: string[] = [];
    if (createSorts.has("nearest")) filterParts.push("Near me");
    if (createSorts.has("highest_rated")) filterParts.push("Highest rated");
    if (createSorts.has("shaded")) filterParts.push("Shaded");
    if (createHood !== "all") filterParts.push(createHood);
    if (createSorts.has("nearest") && hasPreciseLocation) {
      filterParts.push(`${createRadiusMi} mi`);
    }
    const filterCount =
      createSorts.size + (createHood !== "all" ? 1 : 0);
    const filterSummary =
      filterParts.length > 0 ? filterParts.join(" · ") : "All courts";
    const listMapToggle = (
      <div className="flex shrink-0 rounded-full border border-border bg-bg-elevated p-0.5">
        <button
          type="button"
          onClick={() => setCreatePickMode("photos")}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
            createPickMode === "photos" ? "bg-fg text-bg" : "text-fg-muted",
          )}
        >
          List
        </button>
        <button
          type="button"
          onClick={() => setCreatePickMode("map")}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
            createPickMode === "map" ? "bg-fg text-bg" : "text-fg-muted",
          )}
        >
          Map
        </button>
      </div>
    );

    createPane = (
      <div
        ref={createGridRef}
        hidden={view !== "create"}
        aria-hidden={view !== "create"}
        className={cn(
          "flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden",
          view !== "create" && "hidden",
        )}
      >
      <div
        data-uc-create-scroll="1"
        className={cn(
          "min-h-0 flex-1",
          mapImmersive
            ? "flex flex-col gap-1 overflow-hidden pt-1"
            : "space-y-2.5 overflow-y-auto overscroll-contain px-4 pt-2 pb-6 touch-pan-y [-webkit-overflow-scrolling:touch]",
        )}
      >
        <div className={mapImmersive ? "shrink-0 space-y-1 px-4" : "contents"}>
        {mapImmersive ? (
          <div className="flex items-center gap-3 pb-0.5">
            <button
              type="button"
              onClick={goCreateBack}
              className="relative z-30 min-h-11 min-w-[5.25rem] px-2.5 text-left text-[13px] font-semibold text-fg-muted pointer-events-auto"
            >
              ← Explore
            </button>
            <h3 className="font-display text-[15px] font-semibold text-fg">Create 1v1</h3>
          </div>
        ) : (
          <>
        <button
          type="button"
          onClick={goCreateBack}
          className="relative z-30 min-h-11 -ml-1 px-1 text-left text-xs font-semibold text-fg-muted pointer-events-auto"
        >
          {createStep > 1 ? "← Back" : "← Explore"}
        </button>
        <h3 className="font-display text-lg font-semibold text-fg">Create 1v1</h3>
          </>
        )}
        <CreateGameStepBar step={createStep} onStep={setCreateStep} compact={mapImmersive} />
        {mapImmersive ? null : (
        <p className="text-[11px] text-fg-muted">
          Ranked 1v1 · best of 3 to 11 · win by 2. Public by default.
        </p>
        )}
        </div>

        {createStep === 1 ? (
        <>
        {createCourtLocked && selectedCreateCourt ? (
          <div className="overflow-hidden rounded-2xl border border-court/40 bg-court/10">
            {createImages.length > 0 ? (
              <ImageCarousel
                images={createImages}
                alt={selectedCreateCourt.name}
                className="w-full"
                priority
              />
            ) : (
              <div className="aspect-[16/10] w-full bg-bg-subtle" />
            )}
            <div className="space-y-1 px-3 py-2.5">
              <p className="text-[10px] font-semibold tracking-wide text-court uppercase">
                Court selected from map
              </p>
              <p className="font-display text-[16px] font-semibold text-fg">
                {selectedCreateCourt.name}
              </p>
              <p className="text-[12px] text-fg-muted">
                {selectedCreateCourt.neighborhood ?? "Austin"}
                {"miles" in selectedCreateCourt && typeof (selectedCreateCourt as { miles?: number }).miles === "number"
                  ? ` · ${formatMiles((selectedCreateCourt as { miles: number }).miles)}`
                  : ""}
              </p>
              <button
                type="button"
                onClick={() => {
                  setCreateCourtLocked(false);
                  setCreateCourtId("");
                  setCreateCourtTouched(false);
                }}
                className="text-[11px] font-semibold text-fg-subtle underline-offset-2 hover:underline"
              >
                Choose a different court
              </button>
            </div>
          </div>
        ) : (
          <>
        {selectedCreateCourt && !mapImmersive ? (
          <div className="overflow-hidden rounded-2xl border border-court/40 bg-court/10">
            {createImages.length > 0 ? (
              <ImageCarousel
                images={createImages}
                alt={selectedCreateCourt.name}
                className="w-full"
              />
            ) : null}
            <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="truncate text-[13px] font-semibold text-fg">
                  {selectedCreateCourt.name.replace(/\s*Courts?\s*$/i, "") || selectedCreateCourt.name}
                </p>
                <button type="button" onClick={() => setCourtInfoId(selectedCreateCourt.id)}
                  className="flex size-5 shrink-0 items-center justify-center rounded-full bg-court/20 text-court" aria-label="About this court">
                  <Info className="size-3" strokeWidth={2.25} />
                </button>
              </div>
              <p className="truncate text-[11px] text-fg-muted">
                {selectedCreateCourt.neighborhood ?? "Austin"}
                {"miles" in selectedCreateCourt &&
                typeof (selectedCreateCourt as { miles?: number }).miles === "number"
                  ? ` · ${formatMiles((selectedCreateCourt as { miles: number }).miles)}`
                  : ""}
              </p>
            </div>
          </div>
          </div>
        ) : null}
        <div className={mapImmersive ? "shrink-0 px-4" : "contents"}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreateFiltersOpen((open) => !open)}
            className="uc-press flex min-h-11 min-w-0 flex-1 items-center rounded-lg py-1 pr-2 text-left"
            aria-expanded={createFiltersOpen}
            aria-controls="uc-create-filters"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-[12px] font-semibold text-fg">
                Filters{filterCount > 0 ? ` (${filterCount})` : ""}
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 text-fg-muted transition-transform duration-[var(--motion-fast)] ease-[var(--ease-out-smooth)]",
                    createFiltersOpen && "rotate-180",
                  )}
                  strokeWidth={2.25}
                />
              </span>
              <span className="mt-0.5 block truncate text-[12px] font-medium text-fg">
                {filterSummary}
              </span>
            </span>
          </button>
          {listMapToggle}
        </div>
        <div
          id="uc-create-filters"
          className={cn("uc-preview-slot", createFiltersOpen && "uc-preview-slot-open")}
          aria-hidden={!createFiltersOpen}
        >
          <div className="space-y-1 pt-1">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {([
              { id: "highest_rated", label: "Highest rated" },
              { id: "nearest", label: "Near me" },
              { id: "shaded", label: "Shaded" },
            ] as const).map((opt) => {
              const on = createSorts.has(opt.id);
              return (
                <button key={opt.id} type="button"
                  onClick={() => setCreateSorts((prev) => {
                    const next = new Set(prev);
                    if (next.has(opt.id)) next.delete(opt.id); else next.add(opt.id);
                    return next;
                  })}
                  className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    on ? "bg-fg text-bg" : "border border-border bg-bg-elevated text-fg-muted")}>
                  {on ? "✓ " : ""}{opt.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button type="button" onClick={() => setCreateHood("all")}
              className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                createHood === "all" ? "bg-fg text-bg" : "border border-border bg-bg-elevated text-fg-muted")}>
              {createHood === "all" ? "✓ " : ""}All areas
            </button>
            {hoods.map((h) => (
              <button key={h} type="button" onClick={() => setCreateHood((prev) => (prev === h ? "all" : h))}
                className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  createHood === h ? "bg-fg text-bg" : "border border-border bg-bg-elevated text-fg-muted")}>
                {createHood === h ? "✓ " : ""}{h}
              </button>
            ))}
          </div>
            {createSorts.has("nearest") ? (
              hasPreciseLocation ? (
                <div className="flex items-center gap-1.5">
                  <p className="min-w-0 flex-1 truncate text-[10px] text-fg-subtle">
                    <span className="font-semibold text-fg-muted">
                      {nearOrigin?.label ?? userLocationLabel ?? "Near you"}
                    </span>
                  </p>
                  <div className="flex max-w-[55%] gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {[1, 3, 5, 8, 10, 15].map((mi) => (
                      <button key={mi} type="button" onClick={() => setCreateRadiusMi(mi)}
                        className={cn("h-7 shrink-0 rounded-full px-2 text-[10px] font-semibold tabular-nums",
                          createRadiusMi === mi ? "bg-court text-white" : "border border-border bg-bg-elevated text-fg-muted")}>
                        {mi}mi
                      </button>
                    ))}
                  </div>
                </div>
              ) : locatingNear ? (
                <p className="text-[10px] text-fg-subtle">Getting location…</p>
              ) : (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={requestNearLocation}
                    className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-court px-2 text-[10px] font-semibold text-white">
                    <LocateFixed className="size-3" strokeWidth={2.25} />GPS
                  </button>
                  <input type="text" value={addressQuery}
                    onChange={(e) => { setAddressQuery(e.target.value); setShowAddressEntry(true); }}
                    placeholder="Address…" autoComplete="street-address"
                    className="h-7 min-w-0 flex-1 rounded-full border border-border bg-bg-elevated px-2.5 text-[11px] text-fg outline-none focus:border-court" />
                </div>
              )
            ) : null}
        {createSorts.has("nearest") && !hasPreciseLocation && addressHits.length > 0 ? (
          <ul className="max-h-24 overflow-y-auto rounded-lg border border-border bg-bg-elevated">
            {addressHits.map((hit) => (
              <li key={`${hit.lat}-${hit.lon}-${hit.label}`}>
                <button type="button" onClick={() => pickAddressHit(hit)}
                  className="flex w-full items-start gap-1.5 px-2 py-1.5 text-left hover:bg-bg">
                  <MapPin className="mt-0.5 size-3 shrink-0 text-court" />
                  <span className="text-[11px] font-medium text-fg">{hit.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
          </div>
        </div>
        </div>

        {createPickMode === "photos" ? (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filteredCourts.map((c) => {
                const thumb = courtImagesFor(c.id, 1)[0];
                const selected = c.id === createCourtId;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "relative w-[44%] max-w-[10.5rem] shrink-0 snap-start overflow-hidden rounded-2xl border",
                      selected
                        ? "border-court ring-2 ring-court/50 shadow-md"
                        : "border-border bg-bg-elevated",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => chooseCreateCourt(c.id)}
                      className="w-full text-left"
                      aria-label={`Select ${c.name}`}
                    >
                      <div className="relative aspect-[5/4] bg-bg-subtle">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : null}
                        <div className="absolute top-1.5 right-1.5 z-10 flex flex-col items-end gap-0.5">
                          {selected ? (
                            <span className="rounded-full bg-court px-1.5 py-0.5 text-[9px] font-bold text-white">
                              ✓
                            </span>
                          ) : null}
                          {isRecommendedCourt(c) ? (
                            <span className="rounded-full bg-court px-1.5 py-0.5 text-[8px] font-bold text-white uppercase">
                              Top
                            </span>
                          ) : null}
                          {isShadedCourt(c) ? (
                            <span className="rounded-full bg-black/55 px-1.5 py-0.5 text-[8px] font-bold text-white uppercase">
                              Shade
                            </span>
                          ) : null}
                        </div>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-6">
                          <p className="text-[10px] font-bold tracking-wide text-white uppercase">
                            {c.neighborhood ?? "Austin"}
                          </p>
                          <p className="text-[10px] font-medium text-white/90">
                            {formatMiles(c.miles)} away
                          </p>
                        </div>
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="line-clamp-1 text-[12px] font-semibold text-fg">
                          {c.name.replace(/\s*Courts?\s*$/i, "") || c.name}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCourtInfoId(c.id)}
                      className="absolute top-1.5 left-1.5 z-10 flex size-7 items-center justify-center rounded-full bg-black/55 text-white"
                      aria-label={`About ${c.name}`}
                    >
                      <Info className="size-3.5" strokeWidth={2.25} />
                    </button>
                  </div>
                );
              })}
            </div>
            {filteredCourts.length === 0 ? (
              noMatchFilters
            ) : !createCourtId ? (
              <p className="text-center text-[11px] text-fg-muted">
                Nearby highest-rated courts are shown first. Tap a court or ⓘ for more information.
              </p>
            ) : null}
          </>
        ) : (
          <>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <CourtsMap
              courts={filteredCourts}
              location={createMapLocation}
              selectedId={selectedCreateCourt?.id ?? null}
              onSelect={(c) => chooseCreateCourt(c.id)}
              variant="finder"
              bare
              frameSelection
              layoutKey={createFiltersOpen ? "filters" : "map"}
              mapClassName="h-full w-full"
            />
          </div>
          <div
            className={cn(
              "uc-preview-slot shrink-0 px-4",
              (selectedCreateCourt || filteredCourts.length === 0) && "uc-preview-slot-open",
            )}
          >
            <div>
              {filteredCourts.length === 0 ? (
                <div className="mt-1.5">{noMatchFilters}</div>
              ) : selectedCreateCourt ? (
                <div className="relative mt-1.5 flex items-center gap-1.5">
                  {browseCourts.length > 1 ? (
                    <button
                      type="button"
                      aria-label="Previous court"
                      aria-disabled={browseIndex <= 0}
                      className="uc-press flex size-12 shrink-0 items-center justify-center rounded-full bg-bg-elevated text-fg ring-1 ring-border aria-disabled:opacity-30"
                      style={{ touchAction: "manipulation" }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (browseIndex <= 0) return;
                        stepBrowseCourt(-1);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <ChevronLeft className="size-6" strokeWidth={2.5} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setCourtInfoId(selectedCreateCourt.id)}
                    className="uc-preview-card min-w-0 flex-1 overflow-hidden rounded-xl border border-court/35 bg-bg-elevated text-left"
                    aria-label={`About ${selectedCreateCourt.name}`}
                  >
                    <div
                      key={selectedCreateCourt.id}
                      className="uc-preview-swap relative h-36 w-full bg-bg-subtle"
                    >
                      {hasRealPhoto ? (
                        <img
                          src={mapThumb}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : null}
                      <div
                        className={cn(
                          "absolute inset-x-0 px-3",
                          hasRealPhoto
                            ? "bottom-0 bg-gradient-to-t from-black/88 to-transparent pb-2.5 pt-10"
                            : "inset-0 flex flex-col justify-center pb-2.5 pt-3",
                        )}
                      >
                        {createAutoLabel ? (
                          <p className="text-[10px] font-bold tracking-[0.14em] text-court uppercase">
                            {createAutoLabel}
                          </p>
                        ) : null}
                        <p
                          className={cn(
                            "truncate text-[16px] font-semibold",
                            hasRealPhoto ? "text-white" : "text-fg",
                          )}
                        >
                          {selectedCreateCourt.name.replace(/\s*Courts?\s*$/i, "") ||
                            selectedCreateCourt.name}
                        </p>
                        <p
                          className={cn(
                            "truncate text-[12px]",
                            hasRealPhoto ? "text-white/80" : "text-fg-muted",
                          )}
                        >
                          {selectedCreateCourt.neighborhood ?? "Austin"}
                          {selectedMiles != null
                            ? ` · ${formatSelectedDistance(selectedMiles, distanceKind)}`
                            : ""}
                        </p>
                        <span className="mt-1 inline-flex items-center text-[12px] font-semibold text-court">
                          View details
                          <span aria-hidden className="ml-0.5">
                            ›
                          </span>
                        </span>
                      </div>
                    </div>
                  </button>
                  {browseCourts.length > 1 ? (
                    <button
                      type="button"
                      aria-label="Next court"
                      aria-disabled={
                        browseIndex < 0 || browseIndex >= browseCourts.length - 1
                      }
                      className="uc-press flex size-12 shrink-0 items-center justify-center rounded-full bg-bg-elevated text-fg ring-1 ring-border aria-disabled:opacity-30"
                      style={{ touchAction: "manipulation" }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (
                          browseIndex < 0 ||
                          browseIndex >= browseCourts.length - 1
                        ) {
                          return;
                        }
                        stepBrowseCourt(1);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <ChevronRight className="size-6" strokeWidth={2.5} />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          </>
        )}

                  </>
        )}
        </>
        ) : null}

        {createStep === 2 ? (
        <>
        <div className="space-y-2 rounded-xl border border-border bg-bg-elevated p-3">
          <p className="text-[11px] font-bold text-fg">Game type</p>
          <div className="grid grid-cols-2 gap-1.5">
            {([{ id: "1v1" as const, label: "1v1", sub: "Best of 3 · to 11 · win by 2" },
               { id: "horse" as const, label: "HORSE", sub: "Classic letters" }] as const).map((opt) => (
              <button key={opt.id} type="button" onClick={() => setCreateFormat(opt.id)}
                className={cn("rounded-xl border px-2 py-2.5 text-left",
                  createFormat === opt.id ? "border-court bg-court-soft text-fg" : "border-border bg-bg text-fg-muted")}>
                <p className="text-[12px] font-bold">{opt.label}</p>
                <p className="text-[10px] opacity-80">{opt.sub}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-bg-elevated p-3">
          <p className="text-[11px] font-bold text-fg">Date & time</p>
          <CreateWhenPicker value={createWhen} onChange={setCreateWhen} />
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-bg-elevated p-3">
          <p className="text-[11px] font-bold text-fg">Are you bringing a basketball?</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" onClick={() => setCreateBringingBall(true)}
              className={cn("h-11 rounded-xl border text-sm font-semibold",
                createBringingBall === true ? "border-court bg-court-soft text-fg" : "border-border bg-bg text-fg-muted")}>Yes</button>
            <button type="button" onClick={() => setCreateBringingBall(false)}
              className={cn("h-11 rounded-xl border text-sm font-semibold",
                createBringingBall === false ? "border-fg bg-fg text-bg" : "border-border bg-bg text-fg-muted")}>No</button>
          </div>
          <p className="text-[10px] leading-snug text-fg-subtle">If both of you say no, you’ll both get a heads-up to sort it out in chat.</p>
        </div>

        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-fg-muted">Notes · who you want</span>
          <textarea value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} rows={2}
            placeholder="Optional — size, skill, vibe…"
            className="w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm text-fg" />
        </label>

        {/* Public vs Private */}
        <div className="space-y-2 rounded-xl border border-border bg-bg-elevated p-3">
          <p className="text-[11px] font-bold text-fg">Who can join</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setCreateVisibility("public")}
              className={cn(
                "rounded-xl border px-2 py-2.5 text-left",
                createVisibility === "public"
                  ? "border-court bg-court-soft text-fg"
                  : "border-border bg-bg text-fg-muted",
              )}
            >
              <p className="text-[12px] font-bold">Public match</p>
              <p className="text-[10px] opacity-80">Anyone can join</p>
            </button>
            <button
              type="button"
              onClick={() => setCreateVisibility("invite_only")}
              className={cn(
                "rounded-xl border px-2 py-2.5 text-left",
                createVisibility === "invite_only"
                  ? "border-court bg-court-soft text-fg"
                  : "border-border bg-bg text-fg-muted",
              )}
            >
              <p className="text-[12px] font-bold">Private match</p>
              <p className="text-[10px] opacity-80">Invite only</p>
            </button>
          </div>
          {createVisibility === "invite_only" ? (
            <p className="text-[10px] leading-snug text-fg-subtle">
              Only players you invite can see and join this game. Send at least one invite.
            </p>
          ) : (
            <p className="text-[10px] leading-snug text-fg-subtle">
              Shows in the lobby for anyone. You can still invite people.
            </p>
          )}
        </div>

        {/* Invite players before posting */}
        <div className="space-y-2 rounded-xl border border-border bg-bg-elevated p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold text-fg">Invite players</p>
              <p className="text-[10px] text-fg-subtle">
                {createVisibility === "invite_only"
                  ? "Required for private matches"
                  : "Optional — invite people before the game goes live"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateInviteOpen(true)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-court px-3 py-1.5 text-[11px] font-semibold text-white"
            >
              <UserPlus className="size-3.5" strokeWidth={2} />
              Invite
            </button>
          </div>
          {invitedPlayers.length > 0 ? (
            <ul className="space-y-1.5">
              {invitedPlayers.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-bg px-2 py-1.5"
                >
                  <PlayerAvatar player={p} size="sm" className="!size-8" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-fg">
                      {p.name}
                    </p>
                    <p className="text-[10px] text-fg-muted">
                      {displayRating(p.rating)} · {p.wins}W–{p.losses}L
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCreateInviteIds((ids) => ids.filter((id) => id !== p.id))
                    }
                    className="rounded-full px-2 py-1 text-[10px] font-semibold text-fg-subtle"
                    aria-label={`Remove ${p.name}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-fg-muted">
              {createVisibility === "invite_only"
                ? "Add at least one invite to post a private match."
                : "No invites yet — post open or invite friends first."}
            </p>
          )}
        </div>
        </>
        ) : null}

        {createStep === 3 ? (
          <div className="space-y-2.5">
            <div className="rounded-2xl border border-border bg-bg-elevated p-3">
              <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">Review</p>
              <p className="mt-1 font-display text-[16px] font-semibold text-fg">
                {selectedCreateCourt?.name ?? "Court"}
              </p>
              <p className="text-[12px] text-fg-muted">
                {createWhen ? formatLocalWhen(parseLocalDateTime(createWhen).toISOString()) : "No time set"}
              </p>
              <ul className="mt-2 space-y-1 text-[12px] text-fg">
                <li>{createFormat === "horse" ? "HORSE" : "Ranked 1v1 · best of 3 to 11 · win by 2"}</li>
                <li>{createVisibility === "invite_only" ? "Private · invite only" : "Public match"}</li>
                <li>{createBringingBall ? "You’re bringing a ball" : "You’re not bringing a ball"}</li>
                {createNotes.trim() ? <li>Notes: {createNotes.trim()}</li> : null}
                {invitedPlayers.length > 0 ? (
                  <li>Invites: {invitedPlayers.map((p) => p.name).join(", ")}</li>
                ) : null}
              </ul>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setCreateStep(1)} className="text-[11px] font-semibold text-court">
                  Edit court
                </button>
                <button type="button" onClick={() => setCreateStep(2)} className="text-[11px] font-semibold text-court">
                  Edit details
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {aboutSheet}
      </div>

      <div className="relative z-30 shrink-0 border-t border-border bg-bg px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            if (postingCreate) return;
            if (createStep === 1) {
              if (!selectedCreateCourt) {
                goCreateBack();
                return;
              }
              setCreateStep(2);
              return;
            }
            if (createStep === 2) {
              if (!createWhen) {
                setStatusMsg("Pick a date and time.");
                return;
              }
              if (createBringingBall === null) {
                setStatusMsg("Say if you’re bringing a basketball.");
                return;
              }
              if (createVisibility === "invite_only" && createInviteIds.length === 0) {
                setStatusMsg("Private matches need at least one invite.");
                setCreateInviteOpen(true);
                return;
              }
              setCreateStep(3);
              return;
            }
            void submitCreate();
          }}
          disabled={postingCreate}
          className={cn(
            "uc-press w-full rounded-full py-3 text-sm font-semibold",
            postingCreate
              ? "cursor-wait bg-court/70 text-white"
              : "bg-court text-white",
          )}
        >
          {postingCreate
            ? "Posting…"
            : createStep === 1
              ? selectedCreateCourt
                ? "Continue"
                : "Back to Explore"
              : createStep === 2
                ? "Review & post"
                : createVisibility === "invite_only"
                  ? `Post private match · ${createInviteIds.length} invite${createInviteIds.length === 1 ? "" : "s"}`
                  : createInviteIds.length
                    ? `Post public match · ${createInviteIds.length} invite${createInviteIds.length === 1 ? "" : "s"}`
                    : "Post public match"}
        </button>
      </div>
      <div className="h-4 shrink-0" aria-hidden />

        {createInviteOpen ? (
          <InviteSheet
            candidates={inviteCandidates}
            query={inviteQuery}
            onQuery={setInviteQuery}
            filters={inviteFilters}
            onToggleFilter={(id) => {
              setInviteFilters((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            sorts={inviteSorts}
            onToggleSort={(id) => {
              setInviteSorts((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            invitedIds={createInviteIds}
            friendIds={friendIds}
            playersById={playerById}
            onInvite={(pid) => {
              setCreateInviteIds((ids) =>
                ids.includes(pid) ? ids : [...ids, pid],
              );
              return { ok: true as const };
            }}
            onAddFriend={(pid) => {
              void addFriendFn({ data: { targetId: pid } })
                .then(applyFriendsAndDms)
                .catch(() => undefined);
            }}
            onClose={() => setCreateInviteOpen(false)}
          />
        ) : null}
      </div>
    );
    if (view === "create") return createPane;
  }

  // GAME DETAIL
  if (view === "game" && selected) {
    const host = playerById.get(selected.hostId);
    const miles = haversineMi(origin.lat, origin.lon, selected.lat, selected.lon);
    const court = resolveCourt(selected, courts);
    const images = courtImagesFor(court.id, 4);
    const mapsHref = directionsUrl(court.lat, court.lon, court.name);
    const canInvite = selected.hostId === me.id && selected.status === "open";
    const canCancel =
      (selected.hostId === me.id || selected.opponentId === me.id) &&
      (selected.status === "open" || selected.status === "matched" || selected.status === "scheduled");
    const isHostView = selected.hostId === me.id;
    const someoneJoined =
      !!selected.opponentId ||
      selected.status === "matched" ||
      selected.status === "scheduled" ||
      (selected.rosterIds ?? []).some((id) => id !== selected.hostId);
    const hostEmptyCancel = isHostView && !someoneJoined;
    const opp = selected.opponentId ? playerById.get(selected.opponentId) : null;
    const { day, time } = whenParts(selected.scheduledAt ?? selected.preferredAt);

    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pt-2 touch-pan-y [-webkit-overflow-scrolling:touch]"
        style={{
          paddingBottom:
            keyboardInset > 0
              ? keyboardInset + 24
              : "max(1.5rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <button type="button" onClick={closeGame}
          className="relative z-30 min-h-11 -ml-1 px-1 text-left text-xs font-semibold text-fg-muted pointer-events-auto">
          {gameReturn === "you"
            ? "← Upcoming"
            : gameReturn === "explore"
              ? "← Explore"
              : "← Back to open games"}
        </button>

        {/* Details | Chat */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-bg-elevated p-1">
          <button
            type="button"
            onClick={() => setGameTab("details")}
            className={cn(
              "rounded-xl py-2 text-center text-[12px] font-semibold",
              gameTab === "details" ? "bg-fg text-bg" : "text-fg-muted",
            )}
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => setGameTab("chat")}
            className={cn(
              "relative rounded-xl py-2 text-center text-[12px] font-semibold",
              gameTab === "chat" ? "bg-fg text-bg" : "text-fg-muted",
            )}
          >
            Chat
            {(selected.chat ?? []).filter((c) => !c.system).length > 0 ? (
              <span
                className={cn(
                  "ml-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold",
                  gameTab === "chat" ? "bg-bg/20 text-bg" : "bg-court text-white",
                )}
              >
                {(selected.chat ?? []).filter((c) => !c.system).length}
              </span>
            ) : null}
          </button>
        </div>

        {gameTab === "chat" ? (
          <div
            className="flex min-h-[min(68dvh,520px)] flex-col"
            style={{
              paddingBottom:
                keyboardInset > 0
                  ? keyboardInset + 12
                  : "calc(0.5rem + env(safe-area-inset-bottom, 0px))",
            }}
          >
            <div className="flex shrink-0 items-center gap-2.5 border-b border-border pb-2.5">
              {host ? (
                <button type="button" onClick={() => onOpenPlayer?.(host)}>
                  <PlayerAvatar player={host} size="sm" className="!size-11" />
                </button>
              ) : (
                <div className="size-11 rounded-full bg-bg-subtle" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-fg">
                  {host && opp
                    ? `${host.name.split(" ")[0]} · ${opp.name.split(" ")[0]}`
                    : host
                      ? `Host · ${host.name}`
                      : "Game chat"}
                </p>
                <p className="truncate text-[11px] text-fg-muted">
                  {selected.courtName} · {day} {time}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGameTab("details")}
                className="shrink-0 rounded-full border border-border px-2.5 py-1.5 text-[11px] font-semibold text-fg-muted"
              >
                Details
              </button>
            </div>

            {host && opp ? (
              <div className="mt-3 flex items-center justify-center gap-2">
                <PlayerAvatar player={host} size="sm" className="!size-9 ring-2 ring-court/30" />
                <span className="text-[10px] font-black text-court">VS</span>
                <PlayerAvatar player={opp} size="sm" className="!size-9 ring-2 ring-court/30" />
              </div>
            ) : null}

            <div
              className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {(selected.chat ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                  <MessageCircle className="size-8 text-fg-subtle" />
                  <p className="mt-3 text-sm font-semibold text-fg">No messages yet</p>
                  <p className="mt-1 text-[12px] text-fg-muted">
                    Coordinate parking, ball, or a court change here.
                  </p>
                </div>
              ) : (
                (selected.chat ?? []).map((c) => {
                  if (c.kind === "proposal" && c.proposal) {
                    const prop = c.proposal;
                    const pending = prop.status === "pending";
                    const iProposed = prop.proposedById === me.id;
                    const propImgs = courtImagesFor(prop.courtId, 4);
                    const propCourt = courts.find((x) => x.id === prop.courtId);
                    const who = prop.proposedByName.split(" ")[0];
                    return (
                      <div
                        key={c.id}
                        className="mx-0.5 overflow-hidden rounded-2xl border border-court/40 bg-court/10"
                      >
                        {propImgs.length > 0 ? (
                          <ImageCarousel
                            images={propImgs}
                            alt={prop.courtName}
                            className="aspect-[16/10] w-full"
                            showControls={propImgs.length > 1}
                          />
                        ) : null}
                        <div className="space-y-1 p-3">
                          <p className="text-[10px] font-bold tracking-wide text-court uppercase">
                            {prop.status === "approved"
                              ? "Approved change"
                              : prop.status === "superseded"
                                ? "Old proposal"
                                : "Proposed change"}
                          </p>
                          <p className="text-[15px] font-semibold text-fg">
                            {prop.courtName.replace(/\s*Courts?\s*$/i, "") ||
                              prop.courtName}
                          </p>
                          {propCourt?.address ? (
                            <p className="text-[12px] text-fg-muted">
                              {propCourt.address}
                            </p>
                          ) : null}
                          <p className="text-[13px] font-medium text-fg">
                            {prop.whenLabel}
                          </p>
                          <p className="text-[11px] text-fg-subtle">
                            From {who}
                          </p>
                          {pending ? (
                            <div className="mt-2 space-y-1.5">
                              {iProposed ? (
                                <p className="text-center text-[11px] text-fg-muted">
                                  Waiting for them to approve…
                                </p>
                              ) : (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (isDemoMode()) {
                                      const r = store.approveMatchChangeProposal(
                                        selected.id,
                                        c.id,
                                      );
                                      setStatusMsg(
                                        r.ok
                                          ? "Change approved — game updated."
                                          : r.reason,
                                      );
                                      return;
                                    }
                                    try {
                                      await approveGameChangeFn({
                                        data: {
                                          gameId: selected.id,
                                          messageId: c.id,
                                        },
                                      });
                                      await refreshCompetitiveSnapshot();
                                      setStatusMsg("Change approved — game updated.");
                                    } catch (err) {
                                      setStatusMsg(mutationError(err));
                                    }
                                  }}
                                  className="w-full rounded-full bg-court py-2.5 text-[13px] font-semibold text-white"
                                >
                                  Approve · update game
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setGameTab("details");
                                  setChangeCourtOpen(true);
                                  setChangeCourtId(prop.courtId);
                                  try {
                                    setChangeWhen(
                                      toLocalDateTimeValue(new Date(prop.whenIso)),
                                    );
                                  } catch {
                                    /* ignore */
                                  }
                                }}
                                className="w-full rounded-full border border-border py-2.5 text-[12px] font-semibold text-fg"
                              >
                                {iProposed ? "Edit proposal" : "Suggest different plan"}
                              </button>
                                  {!iProposed ? null : isDemoMode() ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const r = store.approveMatchChangeProposal(
                                      selected.id,
                                      c.id,
                                    );
                                    setStatusMsg(
                                      r.ok
                                        ? "Approved (demo)."
                                        : r.reason,
                                    );
                                  }}
                                  className="w-full rounded-full bg-fg py-2 text-[11px] font-semibold text-bg"
                                >
                                  Approve as opponent (demo)
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  }
                  if (c.system) {
                    return (
                      <p
                        key={c.id}
                        className="px-4 text-center text-[11px] leading-snug text-fg-subtle"
                      >
                        {c.text}
                      </p>
                    );
                  }
                  const mine = c.authorId === me.id || c.authorName === me.name;
                  return (
                    <div
                      key={c.id}
                      className={cn("flex", mine ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug",
                          mine
                            ? "rounded-br-md bg-court text-white"
                            : "rounded-bl-md bg-bg-elevated text-fg",
                        )}
                      >
                        {!mine ? (
                          <span className="mb-0.5 block text-[10px] font-semibold opacity-70">
                            {c.authorName.split(" ")[0]}
                          </span>
                        ) : null}
                        {c.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div
              ref={chatComposerRef}
              className={cn(
                "mt-2 shrink-0 border-t border-border pt-2.5",
                keyboardInset > 0 && "sticky bottom-0 z-30 bg-bg",
              )}
            >
              <div className="flex items-end gap-2">
                <PlayerAvatar player={me} size="xs" className="mb-0.5 !size-8 shrink-0" showRank={false} />
                <input
                  ref={chatInputRef}
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  onFocus={revealChatComposer}
                  onClick={revealChatComposer}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!chatDraft.trim()) return;
                      void sendMatchChat(selected.id, chatDraft);
                      setChatDraft("");
                      chatInputRef.current?.focus();
                      revealChatComposer();
                    }
                  }}
                  enterKeyHint="send"
                  autoComplete="off"
                  placeholder="Message…"
                  className="min-w-0 flex-1 rounded-full border border-border bg-bg-elevated px-4 py-2.5 text-base outline-none focus:border-court"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!chatDraft.trim()) return;
                    void sendMatchChat(selected.id, chatDraft);
                    setChatDraft("");
                    chatInputRef.current?.focus();
                    revealChatComposer();
                  }}
                  disabled={!chatDraft.trim()}
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-full",
                    chatDraft.trim()
                      ? "bg-court text-white"
                      : "bg-bg-elevated text-fg-subtle",
                  )}
                  aria-label="Send"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
        <>

        {selected.status === "played_pending" || selected.status === "disputed" ? (
        <ScoreConfirmCard
          match={selected}
          me={me}
          host={host}
          opp={opp}
          onEnterScore={async (scores) => {
            if (!requireAuth("score")) return;
            if (isDemoMode()) {
              store.enterScore(selected.id, scores);
              return;
            }
            try {
              await submitScoreFn({
                data: {
                  gameId: selected.id,
                  scores,
                  submissionId:
                    typeof crypto !== "undefined" && crypto.randomUUID
                      ? crypto.randomUUID()
                      : `sc_${Date.now()}`,
                },
              });
              await refreshCompetitiveSnapshot();
            } catch (err) {
              setStatusMsg(mutationError(err));
            }
          }}
          onConfirm={async () => {
            if (!requireAuth("score")) return;
            if (isDemoMode()) {
              store.confirmScore(selected.id, false);
              return;
            }
            try {
              await confirmScoreFn({ data: { gameId: selected.id } });
              await refreshCompetitiveSnapshot();
            } catch (err) {
              setStatusMsg(mutationError(err));
            }
          }}
          onDispute={async () => {
            if (!requireAuth("dispute")) return;
            if (isDemoMode()) {
              store.confirmScore(selected.id, true);
              return;
            }
            try {
              await disputeScoreFn({ data: { gameId: selected.id } });
              await refreshCompetitiveSnapshot();
            } catch (err) {
              setStatusMsg(mutationError(err));
            }
          }}
        />
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-border shadow-card">
          <div className="relative">
            <ImageCarousel images={images} alt={court.name} className="aspect-[16/9] w-full" priority />
            <div className="absolute top-1.5 left-1.5 z-20">
              <CourtMapCutout lat={court.lat} lon={court.lon} name={court.name}
                address={"address" in court ? court.address : undefined} size={56} zoom={12} />
            </div>
            <div className="absolute top-2 right-2 z-20 rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-semibold tracking-wide text-white uppercase">
              {selected.format === "horse" ? "HORSE" : "Rated 1v1"}
                {selected.status === "open"
                  ? selected.inviteOnly
                    ? " · private"
                    : " · public"
                  : ""}
            </div>
            <div className="absolute inset-x-0 bottom-2.5 z-20 flex items-center justify-center gap-3">
              <button type="button" onClick={() => host && onOpenPlayer?.(host)} disabled={!host} className="shrink-0">
                {host ? <PlayerAvatar player={host} size="md" className="!size-11 shadow-md ring-2 ring-white" />
                  : <div className="size-11 rounded-full bg-black/40 ring-2 ring-white/70" />}
              </button>
              <span className="font-display text-sm font-black tracking-[0.18em] text-court drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">VS</span>
              <button type="button" onClick={() => opp && onOpenPlayer?.(opp)} disabled={!opp} className="shrink-0">
                {opp ? <PlayerAvatar player={opp} size="md" className="!size-11 shadow-md ring-2 ring-white" />
                  : <div className="flex size-11 items-center justify-center rounded-full border-2 border-dashed border-white/70 bg-black/35">
                      <span className="text-[8px] font-bold text-white uppercase">Open</span>
                    </div>}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2.5 rounded-2xl border border-border bg-bg-elevated p-3.5">
          <div>
            <h3 className="font-display text-base font-semibold text-fg">{court.name}</h3>
            <p className="mt-0.5 text-xs font-medium text-court">
              {formatMiles(miles)} away
              {"neighborhood" in court && court.neighborhood ? (
                <span className="font-normal text-fg-muted"> · {court.neighborhood}</span>
              ) : null}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-fg px-2.5 py-1.5 text-bg">
            <span className="text-xs font-bold tabular-nums">{day}</span>
            <span className="text-[10px] opacity-50">·</span>
            <span className="text-xs font-bold tabular-nums">{time}</span>
          </div>
          <p className="text-sm font-semibold text-fg">
            {selected.format === "horse"
              ? "HORSE · outdoor · clean calls"
              : RATED_RULES_COPY}
          </p>
          {"address" in court && court.address ? (
            <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="flex items-start gap-1 text-sm text-fg-muted">
              <MapPin className="mt-0.5 size-3.5 shrink-0 opacity-70" />
              <span className="line-clamp-2">{court.address}</span>
            </a>
          ) : null}
        </div>

        {(selected.status === "matched" || selected.status === "scheduled") &&
        host &&
        opp ? (
          <MatchRemindersCard
            emphasize={!remindersCompleted(selected.id)}
            match={{
              id: selected.id,
              courtName: court.name,
              lat: selected.lat,
              lon: selected.lon,
              whenIso: selected.scheduledAt ?? selected.preferredAt,
              hostName: host.name,
              oppName: opp.name,
              notes: selected.notes,
            }}
            onDone={() => setReminderTick((n) => n + 1)}
          />
        ) : null}

        {selected.status === "open" ? (
          <HostScouting match={selected} host={host} me={me} players={players} matches={matches}
            reviews={store.playerReviews ?? []} isHost={selected.hostId === me.id}
            onSaveNotes={(notes) => store.updateMatchNotes(selected.id, notes)} onOpenPlayer={onOpenPlayer} />
        ) : null}

        {(selected.status === "matched" || selected.status === "scheduled") &&
        (selected.hostId === me.id || selected.opponentId === me.id) ? (
          <div className="rounded-xl border border-border bg-bg-elevated p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
                  Court & tip-off
                </p>
                <p className="truncate text-sm font-semibold text-fg">
                  {selected.courtName}
                </p>
                <p className="text-[12px] font-medium tabular-nums text-fg">
                  {day} · {time}
                </p>
                <p className="mt-0.5 text-[11px] text-fg-muted">
                  Changes need their approval in chat — same as Match Mode
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setChangeCourtOpen((v) => !v);
                  if (!changeCourtId) setChangeCourtId(selected.courtId);
                  if (!changeWhen) {
                    const iso = selected.scheduledAt ?? selected.preferredAt;
                    try {
                      const d = new Date(iso);
                      setChangeWhen(toLocalDateTimeValue(d));
                    } catch {
                      /* keep empty */
                    }
                  }
                }}
                className="shrink-0 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-fg"
              >
                {changeCourtOpen ? "Close" : "Propose change"}
              </button>
            </div>
            {changeCourtOpen ? (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="mb-1.5 text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
                    Court
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {courts.slice(0, 30).map((c) => {
                      const on = c.id === (changeCourtId || selected.courtId);
                      const thumb = courtImagesFor(c.id, 1)[0];
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setChangeCourtId(c.id)}
                          className={cn(
                            "w-[38%] max-w-[8rem] shrink-0 overflow-hidden rounded-xl border text-left",
                            on
                              ? "border-court ring-1 ring-court/40"
                              : "border-border",
                          )}
                        >
                          <div className="aspect-[5/4] bg-bg-subtle">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <p className="line-clamp-2 px-1.5 py-1 text-[10px] font-semibold text-fg">
                            {c.name.replace(/\s*Courts?\s*$/i, "") || c.name}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
                    Date & time
                  </p>
                  <CreateWhenPicker value={changeWhen} onChange={setChangeWhen} />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const cid = changeCourtId || selected.courtId;
                    const c = courts.find((x) => x.id === cid);
                    if (!c) {
                      setStatusMsg("Pick a court.");
                      return;
                    }
                    if (!changeWhen) {
                      setStatusMsg("Pick a tip-off time.");
                      return;
                    }
                    let whenIso = changeWhen;
                    try {
                      if (!changeWhen.includes("Z") && !changeWhen.includes("+")) {
                        const [datePart, timePart = "12:00"] = changeWhen.split("T");
                        const [y, mo, da] = datePart.split("-").map(Number);
                        const [h, mi] = timePart.split(":").map(Number);
                        whenIso = new Date(y, (mo || 1) - 1, da || 1, h || 0, mi || 0).toISOString();
                      }
                    } catch {
                      /* keep */
                    }
                    const whenLabel = (() => {
                      try {
                        const d = new Date(whenIso);
                        return `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
                      } catch {
                        return changeWhen;
                      }
                    })();
                    if (isDemoMode()) {
                      const r = store.submitMatchChangeProposal({
                        matchId: selected.id,
                        courtId: c.id,
                        courtName: c.name,
                        lat: c.lat,
                        lon: c.lon,
                        whenIso,
                        whenLabel,
                      });
                      if (!r.ok) {
                        setStatusMsg(r.reason);
                        return;
                      }
                    } else {
                      try {
                        await proposeGameChangeFn({
                          data: {
                            gameId: selected.id,
                            courtId: c.id,
                            courtName: c.name,
                            lat: c.lat,
                            lon: c.lon,
                            whenIso,
                            whenLabel,
                          },
                        });
                        await refreshCompetitiveSnapshot();
                      } catch (err) {
                        setStatusMsg(mutationError(err));
                        return;
                      }
                    }
                    setChangeCourtOpen(false);
                    setGameTab("chat");
                    setStatusMsg("Change sent to chat — waiting on their OK.");
                  }}
                  className="w-full rounded-full bg-court py-3 text-sm font-semibold text-white"
                >
                  Send for approval in chat
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <CheckInBar match={selected} meId={me.id} />

        {selected.status === "played_pending" || selected.status === "disputed" ? null : (
        <ScoreConfirmCard
          match={selected}
          me={me}
          host={host}
          opp={opp}
          onEnterScore={async (scores) => {
            if (!requireAuth("score")) return;
            if (isDemoMode()) {
              store.enterScore(selected.id, scores);
              return;
            }
            try {
              await submitScoreFn({
                data: {
                  gameId: selected.id,
                  scores,
                  submissionId:
                    typeof crypto !== "undefined" && crypto.randomUUID
                      ? crypto.randomUUID()
                      : `sc_${Date.now()}`,
                },
              });
              await refreshCompetitiveSnapshot();
            } catch (err) {
              setStatusMsg(mutationError(err));
            }
          }}
          onConfirm={async () => {
            if (!requireAuth("score")) return;
            if (isDemoMode()) {
              store.confirmScore(selected.id, false);
              return;
            }
            try {
              await confirmScoreFn({ data: { gameId: selected.id } });
              await refreshCompetitiveSnapshot();
            } catch (err) {
              setStatusMsg(mutationError(err));
            }
          }}
          onDispute={async () => {
            if (!requireAuth("dispute")) return;
            if (isDemoMode()) {
              store.confirmScore(selected.id, true);
              return;
            }
            try {
              await disputeScoreFn({ data: { gameId: selected.id } });
              await refreshCompetitiveSnapshot();
            } catch (err) {
              setStatusMsg(mutationError(err));
            }
          }}
        />
        )}

        <button
          type="button"
          onClick={() => setGameTab("chat")}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-bg-elevated px-3 py-3 text-left"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-court/15 text-court">
            <MessageCircle className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-fg">Open chat</p>
            <p className="truncate text-[11px] text-fg-muted">
              {(selected.chat ?? []).filter((c) => !c.system).length > 0
                ? `${(selected.chat ?? []).filter((c) => !c.system).length} messages · tap to continue`
                : "Coordinate with your opponent in a clean chat"}
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
        </button>

        <div className="flex flex-wrap gap-2">
          {selected.status === "open" && selected.hostId !== me.id ? (
            <div className="w-full space-y-2 rounded-xl border border-border bg-bg-elevated p-3">
              <p className="text-[11px] font-bold text-fg">Are you bringing a basketball?</p>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => setJoinBringingBall(true)}
                  className={cn("h-10 rounded-xl border text-sm font-semibold",
                    joinBringingBall === true ? "border-court bg-court-soft text-fg" : "border-border bg-bg text-fg-muted")}>Yes</button>
                <button type="button" onClick={() => setJoinBringingBall(false)}
                  className={cn("h-10 rounded-xl border text-sm font-semibold",
                    joinBringingBall === false ? "border-fg bg-fg text-bg" : "border-border bg-bg text-fg-muted")}>No</button>
              </div>
              <button type="button" disabled={joinBringingBall === null}
                onClick={() => { if (joinBringingBall !== null) joinGame(selected.id, joinBringingBall); }}
                className={cn("w-full rounded-full py-3 text-sm font-semibold",
                  joinBringingBall !== null ? "bg-court text-white" : "cursor-not-allowed bg-bg-subtle text-fg-subtle")}>
                Join {selected.format === "horse" ? "HORSE" : "1v1"}
              </button>
            </div>
          ) : null}
          {canInvite ? (
            <button type="button" onClick={() => setInviteOpen(true)}
              className="min-w-[40%] flex-1 rounded-full border border-border bg-bg-elevated py-3 text-sm font-semibold">Invite opponent</button>
          ) : null}
          {canCancel ? (
            <button type="button" onClick={() => { setCancelOpen(true); setCancelReason(""); setCancelError(null); }}
              className="min-w-[40%] flex-1 rounded-full border border-danger/40 bg-danger/10 py-3 text-sm font-semibold text-danger">
              {hostEmptyCancel ? "Close listing" : "Cancel game"}
            </button>
          ) : null}
        </div>

        {cancelOpen ? (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4"
            style={{
              paddingTop: "max(1rem, env(safe-area-inset-top))",
              // Clear bottom tab bar + home indicator so Keep/Confirm aren't cut off
              paddingBottom:
                "max(5.5rem, calc(4.5rem + env(safe-area-inset-bottom)))",
            }}
            role="presentation"
            onClick={() => setCancelOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-bg p-4 shadow-2xl"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-fg">
                {hostEmptyCancel ? "Close this listing?" : "Cancel this game?"}
              </p>
              {!hostEmptyCancel ? (
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  className="mt-3 w-full rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-court"
                  placeholder="Why?"
                />
              ) : (
                <p className="mt-1.5 text-xs text-fg-muted">
                  No one joined — free close, no penalty.
                </p>
              )}
              {cancelError ? (
                <p className="mt-2 text-xs text-danger">{cancelError}</p>
              ) : null}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCancelOpen(false)}
                  className="flex-1 rounded-full border border-border py-3 text-sm font-semibold text-fg"
                >
                  Keep
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      if (!requireAuth("leave")) return;
                      if (isDemoMode()) {
                        const r = store.cancelMatch(
                          selected.id,
                          hostEmptyCancel ? "" : cancelReason,
                        );
                        if (!r.ok) {
                          setCancelError(r.reason);
                          return;
                        }
                      } else {
                        try {
                          await cancelGameFn({
                            data: {
                              gameId: selected.id,
                              reason: hostEmptyCancel ? "" : cancelReason,
                            },
                          });
                          await refreshCompetitiveSnapshot();
                        } catch (err) {
                          setCancelError(mutationError(err));
                          return;
                        }
                      }
                      setCancelOpen(false);
                      setStatusMsg("Game cancelled.");
                      setView("find");
                      setSelectedId(null);
                    })();
                  }}
                  className="flex-1 rounded-full bg-danger py-3 text-sm font-semibold text-white"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        ) : null}

        </>
        )}

        {inviteOpen ? (
          <InviteSheet
            candidates={inviteCandidates}
            query={inviteQuery}
            onQuery={setInviteQuery}
            filters={inviteFilters}
            onToggleFilter={(id) => {
              setInviteFilters((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            sorts={inviteSorts}
            onToggleSort={(id) => {
              setInviteSorts((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            invitedIds={selected.guestInviteIds ?? []}
            friendIds={friendIds}
            playersById={playerById}
            onInvite={async (pid) => {
              if (isDemoMode()) {
                const r = store.inviteToMatch(selected.id, pid);
                if (!r.ok) return r;
                return { ok: true as const };
              }
              try {
                await invitePlayerToGameFn({
                  data: { gameId: selected.id, playerId: pid },
                });
                await refreshCompetitiveSnapshot();
                return { ok: true as const };
              } catch (err) {
                return { ok: false as const, reason: mutationError(err) };
              }
            }}
            onAddFriend={(pid) => {
              void addFriendFn({ data: { targetId: pid } })
                .then(applyFriendsAndDms)
                .catch(() => undefined);
            }}
            onClose={() => setInviteOpen(false)}
          />
        ) : null}
      </div>
      </div>
    );
  }

  // Play opens on the lobby (explore two-tile menu retired).

  // POST-APPROVE — set alerts before Scheduled tab
  if (view === "alerts_setup" && alertsPromptMatchId) {
    const m =
      store.matches.find((x) => x.id === alertsPromptMatchId) ??
      matches.find((x) => x.id === alertsPromptMatchId);
    const host = m ? playerById.get(m.hostId) : null;
    const oppP = m?.opponentId ? playerById.get(m.opponentId) : null;
    const { day, time } = m
      ? whenParts(m.scheduledAt ?? m.preferredAt)
      : { day: "", time: "" };

    if (!m || !host || !oppP) {
      return (
        <div className="space-y-3 px-1 py-6 text-center">
          <p className="text-sm text-fg-muted">Taking you to Scheduled…</p>
        </div>
      );
    }

    // Already set — useEffect above auto-routes; show brief status only
    if (remindersCompleted(m.id)) {
      return (
        <div className="space-y-3 px-1 py-8 text-center">
          <p className="text-sm font-semibold text-fg">Alerts set</p>
          <p className="text-[13px] text-fg-muted">Opening Scheduled…</p>
        </div>
      );
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-0.5 pb-6 touch-pan-y [-webkit-overflow-scrolling:touch]">
        <div className="mb-3 text-center">
          <p className="text-[10px] font-bold tracking-[0.14em] text-court uppercase">
            Plan approved
          </p>
          <h2 className="font-display mt-1 text-2xl font-semibold text-fg">
            Set your alerts
          </h2>
          <p className="mt-1.5 text-[13px] leading-snug text-fg-muted">
            Do this now so you don't miss tip-off. You'll head to
            Scheduled after.
          </p>
        </div>

        <div className="mb-3 flex items-center justify-center gap-2">
          <PlayerAvatar player={host} size="sm" className="!size-11" />
          <span className="text-[11px] font-bold text-court uppercase">vs</span>
          <PlayerAvatar player={oppP} size="sm" className="!size-11" />
        </div>
        <div className="mb-4 rounded-2xl border border-border bg-bg-elevated px-3 py-2.5 text-center">
          <p className="text-sm font-semibold text-fg">{m.courtName}</p>
          <p className="mt-0.5 text-[13px] font-bold text-fg">
            {day} · {time}
          </p>
        </div>

        <MatchRemindersCard
          emphasize
          title="Phone alerts for this game"
          subtitle={
            <>
              We'll remind you{" "}
              <span className="font-semibold text-fg">24 hours</span> and{" "}
              <span className="font-semibold text-fg">3 hours</span> before{" "}
              {time || "tip-off"}.
            </>
          }
          match={{
            id: m.id,
            courtName: m.courtName,
            lat: m.lat,
            lon: m.lon,
            whenIso: m.scheduledAt ?? m.preferredAt,
            hostName: host.name,
            oppName: oppP.name,
            notes: m.notes,
          }}
          onDone={() => goToScheduledAfterAlerts(m.id)}
        />

        <p className="mt-4 text-center text-[11px] text-fg-subtle">
          You’ll open Scheduled automatically after alerts.
        </p>
      </div>
      </div>
    );
  }

  // HOOP NOW / Match Mode
  if (view === "hoop_now") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <HoopNowFlow
        me={me}
        players={players}
        courts={courts}
        matches={matches}
        userLat={userLat}
        userLon={userLon}
        browseFilters={browseFilters}
        onBrowseFiltersChange={updateBrowseFilters}
        onBack={goExplore}
        onChallenge={(p) => {
          setStatusMsg(
            `Challenge sent to ${p.name.split(" ")[0]}. Waiting on them to accept.`,
          );
        }}
        onMatchLocked={(matchId) => {
          // Alerts setup FIRST — Scheduled only after they finish
          setSelectedId(null);
          setGameTab("details");
          setExploreLane(null);
          setJustLandedMatchId(matchId);
          setAlertsPromptMatchId(matchId);
          setStatusMsg(null);
          setView("alerts_setup");
          // Re-assert after paint (store match may land a tick later)
          requestAnimationFrame(() => {
            setAlertsPromptMatchId(matchId);
            setView("alerts_setup");
          });
          window.setTimeout(() => {
            setAlertsPromptMatchId(matchId);
            setView("alerts_setup");
          }, 30);
        }}
      />
      </div>
    );
  }

  // FIND — Lobby / My Games (Play home)
  const sortOptions = [
    { id: "recent" as const, label: "Most recent" },
    { id: "recommended" as const, label: "Recommended" },
    { id: "rating_desc" as const, label: "Rating high → low" },
    { id: "nearest" as const, label: "Nearest" },
  ];
  const sortLabel =
    sortOptions.find((s) => s.id === (lobbySort ?? "recent"))?.label ?? "Most recent";
  const placeLabel = userLocationLabel?.trim() || "Austin, TX";

  return (
    <>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pt-2 pb-6 touch-pan-y [-webkit-overflow-scrolling:touch]">
      {statusMsg ? (
        <p className="rounded-lg bg-court/15 px-3 py-2 text-xs font-medium text-court">
          {statusMsg}
          <button type="button" className="ml-2 underline" onClick={() => setStatusMsg(null)}>
            dismiss
          </button>
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[17px] font-semibold tracking-tight">
          <span className="text-court">Upset City</span>
          <span className="text-fg-muted"> · {placeLabel}</span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={startCreate}
            className="uc-press inline-flex h-9 items-center gap-1 rounded-full bg-court px-3 text-white"
            aria-label="Create game"
          >
            <Plus className="size-3.5" strokeWidth={2.5} />
            <span className="text-[12px] font-semibold">Create</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!requireAuth("profile")) return;
              onOpenPlayer?.(me);
            }}
            className="uc-press flex size-9 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-elevated"
            aria-label="Your profile"
          >
            {me.id !== GUEST_PLAYER_ID ? (
              <PlayerAvatar player={me} size="sm" showRank={false} className="!size-9" />
            ) : (
              <User className="size-4 text-fg-muted" />
            )}
          </button>
        </div>
      </div>

      <div className="flex rounded-full border border-border bg-bg-elevated p-0.5">
        {(
          [
            {
              id: "open" as const,
              label: "Lobby",
              count: laneOpenGames.length,
            },
            {
              id: "scheduled" as const,
              label: "My Games",
              count: scheduledDeskGames.length + myHostingOpen.length + incomingInvites.length,
            },
          ] as const
        ).map((tab) => {
          const on =
            tab.id === "open"
              ? openDeskTab === "open"
              : openDeskTab === "scheduled" || openDeskTab === "waiting";
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setOpenDeskTab(tab.id)}
              aria-label={tab.label}
              aria-pressed={on}
              className={cn(
                "uc-press relative flex-1 rounded-full px-3 py-2 text-center text-[13px] font-semibold transition-colors",
                on ? "bg-court text-white" : "text-fg-muted",
              )}
            >
              <span aria-hidden className="inline-flex items-center justify-center gap-1.5">
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "text-[11px] font-medium tabular-nums",
                    on ? "text-white/75" : "text-fg-subtle",
                  )}
                >
                  {tab.count}
                </span>
              </span>
              {tab.id === "scheduled" && playAlerts > 0 && !on ? (
                <span
                  className="absolute top-1.5 right-3 size-1.5 rounded-full bg-court"
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* OPEN — marketplace */}
      {openDeskTab === "open" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <PlayerBrowseFilters
                value={browseFilters}
                onChange={updateBrowseFilters}
                saved={browseFiltersSaved}
                onSavedChange={setBrowseFiltersSavedFlag}
                onReset={resetBrowseFilters}
                pill
              />
              {isMatchModeEnabled() ? (
                <button
                  type="button"
                  onClick={() => setView("hoop_now")}
                  className="uc-press inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-3 text-[13px] font-semibold text-fg"
                >
                  <Zap className="size-3.5 text-court" />
                  Match
                </button>
              ) : null}
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setLobbySortOpen((o) => !o)}
                className="inline-flex h-10 items-center gap-1 rounded-full border border-border bg-bg-elevated px-3 text-[13px] font-semibold text-fg"
              >
                {sortLabel}
                <ChevronDown
                  className={cn("size-3.5 text-fg-muted", lobbySortOpen && "rotate-180")}
                />
              </button>
              {lobbySortOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40"
                    aria-label="Close sort"
                    onClick={() => setLobbySortOpen(false)}
                  />
                  <div className="absolute top-11 right-0 z-50 min-w-[12rem] overflow-hidden rounded-2xl border border-border bg-bg-elevated py-1 shadow-soft">
                    {sortOptions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setLobbySort(s.id);
                          setLobbySortOpen(false);
                        }}
                        className={cn(
                          "flex w-full px-3.5 py-2.5 text-left text-[13px] font-medium",
                          (lobbySort ?? "recent") === s.id
                            ? "bg-court/15 text-fg"
                            : "text-fg-muted",
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {sortedLobbyGames.length === 0 ? (
            <div className="flex min-h-[48vh] flex-col items-center justify-center px-4 text-center">
              <div className="relative mb-5 size-[5.5rem]">
                <span className="absolute top-1 left-2 h-0.5 w-3.5 -rotate-[28deg] rounded-full bg-court" />
                <span className="absolute top-1 right-2 h-0.5 w-3.5 rotate-[28deg] rounded-full bg-court" />
                <span className="absolute bottom-2 left-1.5 h-0.5 w-3.5 rotate-[28deg] rounded-full bg-court" />
                <span className="absolute right-1.5 bottom-2 h-0.5 w-3.5 -rotate-[28deg] rounded-full bg-court" />
                <svg
                  viewBox="0 0 64 64"
                  className="h-full w-full text-fg-subtle/70"
                  fill="none"
                  aria-hidden
                >
                  <ellipse cx="32" cy="56" rx="14" ry="3.2" fill="currentColor" opacity="0.22" />
                  <circle cx="32" cy="30" r="16" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M32 14v32M16 30h32" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M20.2 19.5c6.2 5.2 17.4 5.2 23.6 0M20.2 40.5c6.2-5.2 17.4-5.2 23.6 0"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
              <p className="text-[20px] font-semibold tracking-tight text-fg">
                No open games right now
              </p>
              <p className="mt-2 max-w-[16.5rem] text-[14px] leading-snug text-fg-muted">
                Post a run or check back later. Your own posts live under My Games.
              </p>
              <button
                type="button"
                onClick={startCreate}
                className="uc-press mt-6 inline-flex h-12 w-full max-w-[17rem] items-center justify-center gap-1.5 rounded-full bg-court text-[15px] font-semibold text-white"
              >
                Create a game
                <span aria-hidden>→</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="px-0.5 text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
                {lobbySort === "recommended"
                  ? "Best matchups first"
                  : lobbySort === "rating_desc"
                    ? "Highest rated hosts"
                    : lobbySort === "nearest"
                      ? "Closest first"
                      : "Most recent first"}{" "}
                · {sortedLobbyGames.length}
              </p>
              {sortedLobbyGames.map(({ match: m, miles }) => {
                const host = playerById.get(m.hostId);
                const rec = host ? isLobbyRecommended(host, miles) : false;
                const hostGames = host ? host.wins + host.losses : 0;
                const hostWinPct =
                  host && hostGames > 0
                    ? Math.round((host.wins / hostGames) * 100)
                    : null;
                const gameType = m.format === "horse" ? "HORSE" : "1v1";
                const isHorse = m.format === "horse";
                let dateLine = "";
                let timeLine = "";
                try {
                  const d = new Date(m.preferredAt);
                  dateLine = d
                    .toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })
                    .toUpperCase();
                  timeLine = d.toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  });
                } catch {
                  dateLine = m.preferredAt;
                }
                const accent = isHorse ? "text-violet-400" : "text-court";
                const badgeCls = isHorse
                  ? "bg-violet-500 text-white"
                  : "bg-court text-white";

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => openGame(m.id)}
                    className={cn(
                      "uc-press flex w-full items-stretch gap-0 overflow-hidden rounded-2xl border text-left",
                      rec
                        ? "border-court/40 bg-bg-elevated"
                        : "border-border/80 bg-bg-elevated",
                    )}
                  >
                    {/* Left: when + court */}
                    <div className="flex w-[38%] min-w-[7.5rem] max-w-[9.5rem] shrink-0 flex-col justify-center border-r border-border/60 px-3 py-3">
                      <p
                        className={cn(
                          "text-[10px] font-bold tracking-[0.06em]",
                          accent,
                        )}
                      >
                        {dateLine}
                      </p>
                      <p className="font-display mt-0.5 text-[22px] font-bold leading-none tracking-tight text-fg tabular-nums">
                        {timeLine}
                      </p>
                      <p className="mt-2 flex items-start gap-1 text-[11px] font-medium leading-snug text-fg">
                        <MapPin
                          className={cn("mt-0.5 size-3 shrink-0", accent)}
                          strokeWidth={2}
                        />
                        <span className="line-clamp-2">
                          {m.courtName.replace(/\s*Courts?\s*$/i, "") ||
                            m.courtName}
                        </span>
                      </p>
                      <p className="mt-0.5 pl-4 text-[10px] text-fg-subtle">
                        {formatMiles(miles)} away
                      </p>
                      {m.inviteOnly ? (
                        <p className="mt-1.5 text-[10px] font-semibold text-fg-subtle">
                          Private match
                        </p>
                      ) : null}
                    </div>

                    {/* Right: host */}
                    <div className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-3">
                      <div className="relative shrink-0">
                        {host ? (
                          <PlayerAvatar
                            player={host}
                            size="lg"
                            className="!size-[3.25rem]"
                          />
                        ) : (
                          <div className="size-[3.25rem] rounded-full bg-bg-subtle" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-[14px] font-semibold text-fg">
                            {host?.name ?? "Host"}
                          </p>
                          <span
                            className={cn(
                              "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase",
                              badgeCls,
                            )}
                          >
                            {gameType}
                          </span>
                        </div>
                        {host ? (
                          <>
                            <p className="mt-0.5 flex items-baseline gap-1.5">
                              <span className="font-display text-[22px] font-bold tabular-nums leading-none text-fg">
                                {displayRating(host.rating)}
                              </span>
                              <span className="text-[11px] font-medium text-fg-muted">
                                rating
                              </span>
                            </p>
                            <p className="mt-0.5 text-[12px] text-fg-muted">
                              {host.wins}–{host.losses}
                              {hostWinPct != null ? ` · ${hostWinPct}%` : ""}
                            </p>
                          </>
                        ) : null}
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* MY GAMES — scheduled + your unfilled posts */}
      {openDeskTab === "scheduled" || openDeskTab === "waiting" ? (
        <div className="space-y-3">
          {statusMsg?.includes("Scheduled") ||
          statusMsg?.includes("approved") ||
          statusMsg?.includes("alerts") ? (
            <p className="rounded-xl border border-court/40 bg-court/15 px-3 py-2 text-[12px] font-semibold text-court">
              {statusMsg}
            </p>
          ) : null}
          {scheduledDeskGames.length === 0 &&
          myHostingOpen.length === 0 &&
          incomingInvites.length === 0 ? (
            <div className="rounded-2xl border border-border bg-bg-elevated px-4 py-8 text-center">
              <p className="text-sm font-semibold text-fg">No games yet</p>
              <p className="mt-1 text-[12px] text-fg-muted">
                Locked games, invites, and posts waiting for a player show up here.
              </p>
              <button
                type="button"
                onClick={() => setOpenDeskTab("open")}
                className="mt-3 text-sm font-semibold text-court"
              >
                Browse lobby
              </button>
            </div>
          ) : (
            <>
              {incomingInvites.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="px-0.5 text-[15px] font-semibold tracking-tight text-fg">
                    Invites
                  </h3>
                  {incomingInvites.map((m) => {
                    const host = playerById.get(m.hostId);
                    const { day, time } = whenParts(m.preferredAt);
                    const gameType = m.format === "horse" ? "HORSE" : "1v1";
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setReviewInviteId(m.id)}
                        className="w-full rounded-2xl border border-court/35 bg-bg-elevated px-3 py-3 text-left"
                      >
                        <div className="flex items-start gap-3">
                          {host ? (
                            <PlayerAvatar
                              player={host}
                              size="md"
                              showRank={false}
                              className="!size-12 shrink-0"
                            />
                          ) : (
                            <div className="size-12 shrink-0 rounded-full bg-bg-subtle" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold tracking-wide text-court uppercase">
                              {host?.name.split(" ")[0] ?? "Someone"} invited you
                            </p>
                            <p className="mt-0.5 truncate text-[14px] font-semibold text-fg">
                              {m.courtName}
                            </p>
                            <p className="mt-0.5 text-[12px] text-fg-muted">
                              {day} · {time} · {gameType}
                              {host
                                ? ` · ${host.wins}–${host.losses}`
                                : ""}
                            </p>
                            <p className="mt-1.5 text-[12px] font-semibold text-court">
                              Review invite
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <h3 className="px-0.5 text-[15px] font-semibold tracking-tight text-fg">
                Your Scheduled Games
              </h3>
              {scheduledDeskGames.length === 0 ? (
                <p className="px-0.5 text-[12px] text-fg-muted">
                  None locked yet. When someone joins, it shows here.
                </p>
              ) : (
              <div className="space-y-2.5">
                {scheduledDeskGames.map((m) => {
                  const host = playerById.get(m.hostId);
                  const oppP = m.opponentId
                    ? playerById.get(m.opponentId)
                    : null;
                  const { day, time } = whenParts(
                    m.scheduledAt ?? m.preferredAt,
                  );
                  const needsConfirm =
                    m.status === "played_pending" &&
                    !!m.scores?.length &&
                    m.scoreEnteredBy !== me.id;
                  const waitingThem =
                    m.status === "played_pending" &&
                    !!m.scores?.length &&
                    m.scoreEnteredBy === me.id;
                  const disputed = m.status === "disputed";
                  const canEnterScore =
                    m.status === "matched" || m.status === "scheduled";
                  const justLanded =
                    justLandedMatchId === m.id || selectedId === m.id;
                  void reminderTick;
                  const alertsOn = remindersCompleted(m.id);
                  const hostRank = host
                    ? cityRankOf(players, host.id)
                    : null;
                  const oppRank = oppP
                    ? cityRankOf(players, oppP.id)
                    : null;

                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => openGame(m.id)}
                      aria-label={
                        needsConfirm
                          ? `Confirm score vs ${oppP?.name ?? "opponent"}`
                          : waitingThem
                            ? `Waiting on them vs ${oppP?.name ?? "opponent"}`
                            : disputed
                              ? `Re-submit score vs ${oppP?.name ?? "opponent"}`
                              : `Open scheduled game at ${m.courtName}`
                      }
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[1.15rem] border px-3 py-3 text-left transition active:scale-[0.995]",
                        justLanded
                          ? "border-court/50 bg-bg-elevated ring-1 ring-court/35"
                          : needsConfirm || disputed
                            ? "border-court/40 bg-bg-elevated"
                            : "border-border/80 bg-bg-elevated",
                      )}
                    >
                      {/* Avatars + ranks under (mock layout) */}
                      <div className="flex shrink-0 items-start gap-2.5">
                        <div className="flex w-[3.25rem] flex-col items-center">
                          {host ? (
                            <PlayerAvatar
                              player={host}
                              size="md"
                              showRank={false}
                              className="!size-12"
                            />
                          ) : (
                            <div className="size-12 rounded-full bg-bg-subtle" />
                          )}
                          {hostRank != null ? (
                            <span className="mt-1 text-[11px] font-bold tabular-nums text-court">
                              #{hostRank}
                            </span>
                          ) : (
                            <span className="mt-1 text-[10px] text-fg-subtle">
                              —
                            </span>
                          )}
                        </div>
                        <span className="mt-4 text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
                          vs
                        </span>
                        <div className="flex w-[3.25rem] flex-col items-center">
                          {oppP ? (
                            <PlayerAvatar
                              player={oppP}
                              size="md"
                              showRank={false}
                              className="!size-12"
                            />
                          ) : (
                            <div className="flex size-12 items-center justify-center rounded-full border border-dashed border-border text-[10px] text-fg-subtle">
                              ?
                            </div>
                          )}
                          {oppRank != null ? (
                            <span className="mt-1 text-[11px] font-bold tabular-nums text-court">
                              #{oppRank}
                            </span>
                          ) : (
                            <span className="mt-1 text-[10px] text-fg-subtle">
                              —
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Divider */}
                      <div
                        className="h-14 w-px shrink-0 self-center bg-border/80"
                        aria-hidden
                      />

                      {/* Court · when */}
                      <div className="min-w-0 flex-1">
                        {(needsConfirm || waitingThem || disputed) && (
                          <p
                            className={cn(
                              "mb-1 text-[10px] font-bold uppercase tracking-wide",
                              disputed
                                ? "text-danger"
                                : needsConfirm
                                  ? "text-court"
                                  : "text-fg-muted",
                            )}
                          >
                            {disputed
                              ? "Re-submit score"
                              : needsConfirm
                                ? "Confirm score"
                                : "Waiting on them"}
                          </p>
                        )}
                        <p className="truncate text-[14px] font-semibold leading-snug text-fg">
                          {m.courtName}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-fg-muted">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="size-3.5 shrink-0 opacity-70" />
                            <span className="font-medium">{day}</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3.5 shrink-0 opacity-70" />
                            <span className="font-medium">{time}</span>
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {canEnterScore && !alertsOn ? (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                setAlertsPromptMatchId(m.id);
                                setView("alerts_setup");
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setAlertsPromptMatchId(m.id);
                                  setView("alerts_setup");
                                }
                              }}
                              className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-600"
                            >
                              <Bell className="size-2.5" />
                              Set alerts
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
                    </button>
                  );
                })}
              </div>
              )}

              {/* Footer alerts status (mock) */}
              {(() => {
                void reminderTick;
                const anyOn = scheduledDeskGames.some((m) =>
                  remindersCompleted(m.id),
                );
                const allOn =
                  scheduledDeskGames.length > 0 &&
                  scheduledDeskGames.every((m) => remindersCompleted(m.id));
                if (!anyOn) return null;
                return (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-border/70 bg-bg-elevated px-3.5 py-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-court/15 text-court">
                      <Bell className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-fg">
                        Alerts on
                        {allOn ? " · Calendar synced" : " · some games"}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">
                        You'll be notified about updates and reminders.
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2">
                <p className="px-0.5 pt-1 text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
                  Waiting for a player
                </p>
                {myHostingOpen.length === 0 ? (
                  <p className="px-0.5 text-[12px] text-fg-muted">
                    Games you post show here until someone joins.
                  </p>
                ) : (
                  myHostingOpen.map((m) => {
                    const { day, time } = whenParts(m.preferredAt);
                    const miles = haversineMi(origin.lat, origin.lon, m.lat, m.lon);
                    const gameType = m.format === "horse" ? "HORSE" : "1v1";
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => openGame(m.id)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-bg-elevated p-2.5 text-left active:scale-[0.99]"
                      >
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-dashed border-court/40 bg-court/10 text-[10px] font-bold text-court">
                          {gameType}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-sm font-semibold text-fg">
                              {m.courtName}
                            </p>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase",
                                m.format === "horse"
                                  ? "bg-violet-500/20 text-violet-400"
                                  : "bg-court/15 text-court",
                              )}
                            >
                              {gameType}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                              {m.inviteOnly ? (
                              <span className="rounded-full border border-border bg-bg-elevated px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-fg-muted uppercase">
                                Private
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1.5 inline-flex gap-1.5 rounded-lg bg-fg/90 px-2 py-1 text-bg">
                            <span className="text-[11px] font-bold">{day}</span>
                            <span className="opacity-50">·</span>
                            <span className="text-[11px] font-bold">{time}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-fg-subtle">
                            {formatMiles(miles)} ·{" "}
                            {m.inviteOnly
                              ? `${(m.guestInviteIds ?? []).length} invite${
                                  (m.guestInviteIds ?? []).length === 1 ? "" : "s"
                                } pending`
                              : "nobody joined yet"}
                          </p>
                        </div>
                        <ChevronRight className="size-4 text-fg-subtle" />
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
    </div>
    {createPane}
    {inviteReviewSheet}
    </>
  );
}


function HostScouting({
  match, host, me, players, matches, reviews, isHost, onSaveNotes, onOpenPlayer,
}: {
  match: Match; host?: Player; me: Player; players: Player[]; matches: Match[];
  reviews: PlayerReview[]; isHost: boolean; onSaveNotes: (notes: string) => void;
  onOpenPlayer?: (p: Player) => void;
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [noteDraft, setNoteDraft] = useState(match.notes ?? "");
  const [histOpen, setHistOpen] = useState(true);
  const [revOpen, setRevOpen] = useState(true);
  const [expandedMutualId, setExpandedMutualId] = useState<string | null>(null);
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [historyDetailId, setHistoryDetailId] = useState<string | null>(null);
  useEffect(() => { setNoteDraft(match.notes ?? ""); }, [match.id, match.notes]);
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const hostHistory = useMemo(() => {
    if (!host) return [];
    return matches
      .filter((m) => m.status === "confirmed" && m.opponentId && (m.hostId === host.id || m.opponentId === host.id))
      .sort((a, b) => (b.scheduledAt ?? b.preferredAt).localeCompare(a.scheduledAt ?? a.preferredAt));
  }, [matches, host]);
  const myPastOpponents = useMemo(() => {
    const ids = new Set<string>();
    for (const m of matches) {
      if (m.status !== "confirmed" || !m.opponentId) continue;
      if (m.hostId === me.id) ids.add(m.opponentId);
      if (m.opponentId === me.id) ids.add(m.hostId);
    }
    return ids;
  }, [matches, me.id]);
  const mutual = useMemo(() => {
    if (!host) return [] as Array<{
      player: Player; hostResult: "W" | "L"; myResult: "W" | "L";
      hostWins: number; hostLosses: number; myWins: number; myLosses: number;
      hostScores: string; myScores: string; hostCourt: string; myCourt: string;
    }>;
    const out = [];
    for (const oppId of myPastOpponents) {
      if (oppId === host.id) continue;
      const hostMatch = hostHistory.find((m) => m.hostId === oppId || m.opponentId === oppId);
      if (!hostMatch) continue;
      const myMatch = matches.find(
        (m) => m.status === "confirmed" &&
          ((m.hostId === me.id && m.opponentId === oppId) || (m.opponentId === me.id && m.hostId === oppId)),
      );
      if (!myMatch) continue;
      const opp = playerById.get(oppId);
      if (!opp) continue;
      const hostIsA = hostMatch.hostId === host.id;
      const hostWins = seriesWins(hostMatch.scores, hostIsA ? "a" : "b");
      const hostLosses = seriesWins(hostMatch.scores, hostIsA ? "b" : "a");
      const meIsA = myMatch.hostId === me.id;
      const myWins = seriesWins(myMatch.scores, meIsA ? "a" : "b");
      const myLosses = seriesWins(myMatch.scores, meIsA ? "b" : "a");
      out.push({
        player: opp,
        hostResult: (hostWins > hostLosses ? "W" : "L") as "W" | "L",
        myResult: (myWins > myLosses ? "W" : "L") as "W" | "L",
        hostWins, hostLosses, myWins, myLosses,
        hostScores: scoreLine(hostMatch.scores), myScores: scoreLine(myMatch.scores),
        hostCourt: hostMatch.courtName, myCourt: myMatch.courtName,
      });
    }
    return out;
  }, [host, hostHistory, myPastOpponents, matches, me.id, playerById]);
  const hostReviews = useMemo(() => {
    if (!host) return [];
    return reviews.filter((r) => r.targetId === host.id).sort((a, b) => b.at.localeCompare(a.at));
  }, [reviews, host]);
  const avgStars = hostReviews.length > 0
    ? hostReviews.reduce((s, r) => s + r.stars, 0) / hostReviews.length : null;

  return (
    <div className="space-y-2.5">
      <div className="rounded-xl border border-border bg-bg-elevated p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">Host notes · who they want</p>
          {isHost ? (
            <button type="button" onClick={() => {
              if (editingNotes) { onSaveNotes(noteDraft); setEditingNotes(false); }
              else setEditingNotes(true);
            }} className="text-[11px] font-semibold text-court">{editingNotes ? "Save" : "Edit"}</button>
          ) : null}
        </div>
        {editingNotes && isHost ? (
          <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3}
            className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm" />
        ) : (
          <p className="mt-1.5 text-sm leading-snug text-fg">
            {(match.notes ?? "").replace(/^Best of 3\s*[·•]\s*games to 11\s*[·•]\s*make it take it\.?\s*/i, "").trim() || "No notes yet."}
          </p>
        )}
      </div>
      {!isHost ? (
        <div className="rounded-xl border border-border bg-bg-elevated p-3">
          <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">Players you’ve both faced</p>
          {!host || mutual.length === 0 ? (
            <p className="mt-2 text-xs text-fg-muted">No shared opponents yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {mutual.map((row) => {
                const open = expandedMutualId === row.player.id;
                const first = row.player.name.split(" ")[0] ?? row.player.name;
                return (
                  <div key={row.player.id} className="overflow-hidden rounded-xl border border-border bg-bg">
                    <button type="button" onClick={() => setExpandedMutualId(open ? null : row.player.id)}
                      className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left">
                      <PlayerAvatar player={row.player} size="sm" className="!size-9" showRank={false} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{row.player.name}</p>
                        <p className="text-[11px] text-fg-muted">Host {row.hostResult} · You {row.myResult}</p>
                      </div>
                      <span className="text-[11px] text-fg-muted">{open ? "Hide" : "Results"}</span>
                    </button>
                    {open ? (
                      <div className="space-y-2 border-t border-border px-2.5 py-3">
                        <div className="rounded-xl bg-bg-elevated p-3">
                          <p className="text-[10px] font-bold uppercase text-fg-subtle">When {host.name.split(" ")[0]} played {first}</p>
                          <p className="mt-1 text-sm font-semibold">{row.hostResult} {row.hostWins}–{row.hostLosses}</p>
                          <p className="text-xs text-fg-muted">{row.hostScores || "—"} · {row.hostCourt}</p>
                        </div>
                        <div className="rounded-xl bg-bg-elevated p-3">
                          <p className="text-[10px] font-bold uppercase text-fg-subtle">When you played {first}</p>
                          <p className="mt-1 text-sm font-semibold">{row.myResult} {row.myWins}–{row.myLosses}</p>
                          <p className="text-xs text-fg-muted">{row.myScores || "—"} · {row.myCourt}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
      {!isHost ? (
        <>
          <div className="rounded-xl border border-border bg-bg-elevated p-3">
            <button type="button" onClick={() => setHistOpen((v) => !v)} className="flex w-full items-center justify-between">
              <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
                Host history{host ? ` · ${host.wins}W–${host.losses}L · ${hostHistory.length}` : ""}
              </p>
              <span className="text-[11px] text-fg-muted">{histOpen ? "Hide" : "Show"}</span>
            </button>
            {histOpen ? (
              !host || hostHistory.length === 0 ? (
                <p className="mt-2 text-xs text-fg-muted">No games yet.</p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {hostHistory.slice(0, 3).map((m) => {
                    const hostIsA = m.hostId === host.id;
                    const oppId = hostIsA ? m.opponentId! : m.hostId;
                    const opp = playerById.get(oppId);
                    const wins = seriesWins(m.scores, hostIsA ? "a" : "b");
                    const losses = seriesWins(m.scores, hostIsA ? "b" : "a");
                    const won = wins > losses;
                    return (
                      <button key={m.id} type="button" onClick={() => { setHistoryDetailId(m.id); setHistorySheetOpen(true); }}
                        className="flex w-full items-center gap-2 rounded-lg bg-bg px-2.5 py-2 text-left">
                        {opp ? <PlayerAvatar player={opp} size="xs" className="!size-8" showRank={false} /> : <div className="size-8 rounded-full bg-bg-subtle" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">vs {opp?.name ?? "Opponent"}</p>
                          <p className="truncate text-[10px] text-fg-muted">{m.courtName} · {scoreLine(m.scores)}</p>
                        </div>
                        <span className={won ? "text-xs font-bold text-success" : "text-xs font-bold text-danger"}>
                          {won ? "W" : "L"} {wins}–{losses}
                        </span>
                      </button>
                    );
                  })}
                  <button type="button" onClick={() => { setHistoryDetailId(null); setHistorySheetOpen(true); }}
                    className="w-full rounded-lg border border-border py-2.5 text-center text-xs font-semibold text-court">
                    View complete history ({hostHistory.length})
                  </button>
                </div>
              )
            ) : null}
          </div>
          {historySheetOpen && host ? (
            <HostHistorySheet host={host} games={hostHistory} playerById={playerById} focusId={historyDetailId}
              onClose={() => { setHistorySheetOpen(false); setHistoryDetailId(null); }} onOpenPlayer={onOpenPlayer} />
          ) : null}
        </>
      ) : null}
      {!isHost ? (
        <div className="rounded-xl border border-border bg-bg-elevated p-3">
          <button type="button" onClick={() => setRevOpen((v) => !v)} className="flex w-full items-center justify-between">
            <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
              What players say{avgStars != null ? ` · ${avgStars.toFixed(1)}★ · ${hostReviews.length}` : ""}
            </p>
            <span className="text-[11px] text-fg-muted">{revOpen ? "Hide" : "Show"}</span>
          </button>
          {revOpen ? (
            hostReviews.length === 0 ? <p className="mt-2 text-xs text-fg-muted">No reviews yet.</p> : (
              <div className="mt-2 space-y-2">
                {hostReviews.map((r) => {
                  const author = playerById.get(r.authorId);
                  return (
                    <div key={r.id} className="rounded-lg border border-border bg-bg px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        {author ? <PlayerAvatar player={author} size="xs" className="!size-7" showRank={false} /> : <div className="size-7 rounded-full bg-bg-subtle" />}
                        <p className="min-w-0 flex-1 truncate text-xs font-semibold">{r.authorName}</p>
                        <span className="text-[11px] font-bold text-court">{"★".repeat(r.stars)}</span>
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">{r.text}</p>
                    </div>
                  );
                })}
              </div>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function HostHistorySheet({
  host, games, playerById, focusId, onClose, onOpenPlayer,
}: {
  host: Player; games: Match[]; playerById: Map<string, Player>; focusId: string | null;
  onClose: () => void; onOpenPlayer?: (p: Player) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(focusId);
  useEffect(() => { setExpandedId(focusId); }, [focusId]);
  return (
    <div className="fixed inset-0 z-[88] flex items-end justify-center bg-black/55 sm:items-center sm:p-4">
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-bg shadow-xl sm:rounded-2xl">
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <PlayerAvatar player={host} size="md" className="!size-12" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase text-court">Complete game history</p>
            <h3 className="truncate font-display text-lg font-semibold">{host.name}</h3>
            <p className="text-xs text-fg-muted">{host.wins}W–{host.losses}L · {displayRating(host.rating)}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5"><X className="size-4" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {games.map((m) => {
            const hostIsA = m.hostId === host.id;
            const oppId = hostIsA ? m.opponentId! : m.hostId;
            const opp = playerById.get(oppId);
            const wins = seriesWins(m.scores, hostIsA ? "a" : "b");
            const losses = seriesWins(m.scores, hostIsA ? "b" : "a");
            const won = wins > losses;
            const open = expandedId === m.id;
            return (
              <div key={m.id} className="overflow-hidden rounded-xl border border-border bg-bg-elevated">
                <button type="button" onClick={() => setExpandedId(open ? null : m.id)}
                  className="flex w-full items-center gap-2.5 p-2.5 text-left">
                  {opp ? <PlayerAvatar player={opp} size="sm" className="!size-10" /> : <div className="size-10 rounded-full bg-bg-subtle" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">vs {opp?.name ?? "Opponent"}</p>
                    <p className="truncate text-[11px] text-fg-muted">{formatLocalWhen(m.scheduledAt ?? m.preferredAt)}</p>
                  </div>
                  <p className={won ? "text-sm font-black text-success" : "text-sm font-black text-danger"}>
                    {won ? "W" : "L"} {wins}–{losses}
                  </p>
                </button>
                {open ? (
                  <div className="space-y-1 border-t border-border px-3 py-2.5">
                    <p className="text-xs text-fg-muted">{m.courtName}</p>
                    {(m.scores ?? []).map((g, i) => {
                      const hostPts = hostIsA ? g.a : g.b;
                      const oppPts = hostIsA ? g.b : g.a;
                      return (
                        <div key={i} className="flex justify-between rounded-lg bg-bg px-2.5 py-1.5 text-xs">
                          <span className="text-fg-muted">Game {i + 1}</span>
                          <span className="font-semibold">{hostPts}–{oppPts}</span>
                        </div>
                      );
                    })}
                    {opp ? (
                      <button type="button" onClick={() => onOpenPlayer?.(opp)}
                        className="w-full pt-1 text-center text-[11px] font-semibold text-court">View profile</button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="border-t border-border p-3">
          <button type="button" onClick={onClose} className="w-full rounded-full bg-fg py-2.5 text-sm font-semibold text-bg">Done</button>
        </div>
      </div>
    </div>
  );
}

function InviteSheet({
  candidates,
  query,
  onQuery,
  filters,
  onToggleFilter,
  sorts,
  onToggleSort,
  invitedIds,
  friendIds,
  onInvite,
  onAddFriend,
  onClose,
  playersById,
}: {
  candidates: Player[];
  query: string;
  onQuery: (q: string) => void;
  filters: Set<InviteFilter>;
  onToggleFilter: (id: InviteFilter) => void;
  sorts: Set<InviteSortKey>;
  onToggleSort: (id: InviteSortKey) => void;
  invitedIds: string[];
  friendIds: string[];
  /** Return false/reason on failure so we can show it without closing */
  onInvite: (
    id: string,
  ) =>
    | void
    | boolean
    | { ok: true }
    | { ok: false; reason: string }
    | Promise<void | boolean | { ok: true } | { ok: false; reason: string }>;
  onAddFriend: (id: string) => void;
  onClose: () => void;
  playersById?: Map<string, Player>;
}) {
  const [flash, setFlash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const prevInvited = useRef<string[]>(invitedIds);
  const kb = useVisualKeyboard();
  const pinToVv = searchFocused || kb.open;
  const compactSearch = pinToVv && query.trim().length > 0;

  useEffect(() => {
    const prev = new Set(prevInvited.current);
    const added = invitedIds.filter((id) => !prev.has(id));
    prevInvited.current = invitedIds;
    if (added.length === 0) return;
    const id = added[added.length - 1]!;
    const p =
      candidates.find((c) => c.id === id) ??
      playersById?.get(id);
    setErr(null);
    setFlash(`Invite sent to ${p?.name ?? "player"}`);
    const t = window.setTimeout(() => setFlash(null), 2800);
    return () => window.clearTimeout(t);
  }, [invitedIds, candidates, playersById]);

  const invitedPlayers = invitedIds
    .map(
      (id) =>
        candidates.find((c) => c.id === id) ?? playersById?.get(id) ?? null,
    )
    .filter((p): p is Player => !!p);

  const handleInvite = async (p: Player) => {
    setErr(null);
    const r = await onInvite(p.id);
    if (r && typeof r === "object" && "ok" in r) {
      if (!r.ok) {
        setErr(r.reason);
        return;
      }
      // success — flash also fires via invitedIds effect when parent updates
      if (!invitedIds.includes(p.id)) {
        setFlash(`Invite sent to ${p.name}`);
      }
    } else if (r === false) {
      setErr("Couldn’t send invite.");
      return;
    } else if (!invitedIds.includes(p.id)) {
      // parent may update async; optimistic flash
      setFlash(`Invite sent to ${p.name}`);
    }
    onQuery("");
  };

  return (
    <div
      data-uc-invite-sheet="1"
      className={cn(
        "fixed z-[80] flex justify-center overflow-hidden bg-black/50 p-3",
        pinToVv ? "items-stretch" : "inset-0 items-end sm:items-center",
      )}
      style={
        pinToVv
          ? {
              top: kb.offsetTop,
              left: 0,
              right: 0,
              height: kb.height,
              bottom: "auto",
            }
          : undefined
      }
    >
      <div
        className="flex min-h-0 w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-xl"
        style={{
          maxHeight: pinToVv ? "100%" : "85dvh",
          height: pinToVv ? "100%" : undefined,
        }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Invite players</p>
            {!compactSearch ? (
              <p className="text-[11px] text-fg-muted">
                Stay here and invite as many as you want
              </p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="p-2" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        {/* Live confirmation — no need to leave the sheet */}
        {flash ? (
          <div
            className="mx-3 mt-2 flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-[12px] font-semibold text-emerald-300"
            role="status"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/25 text-[11px]">
              ✓
            </span>
            {flash}
          </div>
        ) : null}
        {err ? (
          <div
            className="mx-3 mt-2 rounded-xl border border-danger/35 bg-danger/10 px-3 py-2 text-[12px] font-medium text-danger"
            role="alert"
          >
            {err}
          </div>
        ) : null}

        {invitedPlayers.length > 0 && !compactSearch ? (
          <div className="border-b border-border px-3 py-2">
            <p className="mb-1.5 text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
              Invited · {invitedPlayers.length}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {invitedPlayers.map((p) => (
                <div
                  key={p.id}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 py-1 pr-2.5 pl-1"
                >
                  <PlayerAvatar player={p} size="sm" className="!size-6" />
                  <span className="max-w-[5.5rem] truncate text-[11px] font-semibold text-fg">
                    {p.name.split(" ")[0]}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400">✓</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2 border-b border-border px-3 py-2">
          <div className="flex items-center gap-2 rounded-full border border-border bg-bg-elevated px-3 py-2">
            <Search className="size-3.5 text-fg-subtle" />
            <input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search by name…"
              enterKeyHint="search"
              autoCorrect="off"
              autoCapitalize="none"
              className="min-w-0 flex-1 bg-transparent text-base outline-none"
              style={{ fontSize: 16 }}
            />
          </div>

          {compactSearch ? (
            <p className="text-[11px] font-semibold text-fg-muted">Filters</p>
          ) : (
            <>
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
              Filter · pick any combo
            </p>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["friends", "Friends"],
                  ["available", "Available"],
                  ["active", "Active"],
                ] as const
              ).map(([id, label]) => {
                const on = filters.has(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onToggleFilter(id)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      on ? "bg-fg text-bg" : "bg-bg-elevated text-fg-muted",
                    )}
                  >
                    {on ? "✓ " : ""}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
              Sort · pick any combo
            </p>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["rating", "Player rating"],
                  ["height", "Height"],
                  ["streak", "Win streak"],
                ] as const
              ).map(([id, label]) => {
                const on = sorts.has(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onToggleSort(id)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      on ? "bg-court text-white" : "border border-border bg-bg-elevated text-fg-muted",
                    )}
                  >
                    {on ? "✓ " : ""}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
            </>
          )}
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {candidates.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs text-fg-muted">
              No players match these filters.
            </p>
          ) : null}
          {candidates.map((p) => {
            const invited = invitedIds.includes(p.id);
            const isFriend = friendIds.includes(p.id);
            return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-2.5 py-2",
                  invited
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-border bg-bg-elevated",
                )}
              >
                <PlayerAvatar player={p} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="truncate text-[11px] text-fg-muted">
                    {formatHeightInches(p.heightIn)}
                    {" · "}
                    {displayRating(p.rating)}
                    {(p.streak ?? 0) > 0 ? (
                      <span className="text-success">
                        {" · "}
                        {p.streak} streak
                      </span>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onAddFriend(p.id)}
                  className="p-1.5 text-fg-muted"
                  aria-label={isFriend ? "Friend" : "Add friend"}
                >
                  <UserPlus
                    className={cn("size-3.5", isFriend && "text-court")}
                  />
                </button>
                <button
                  type="button"
                  disabled={invited}
                  onClick={() => handleInvite(p)}
                  className={cn(
                    "min-w-[4.5rem] rounded-full px-2.5 py-1.5 text-[11px] font-semibold",
                    invited
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-court text-white",
                  )}
                >
                  {invited ? "✓ Invited" : "Invite"}
                </button>
              </div>
            );
          })}
        </div>
        {!compactSearch ? (
        <div className="space-y-1.5 border-t border-border p-3">
          {invitedIds.length > 0 ? (
            <p className="text-center text-[11px] text-fg-muted">
              {invitedIds.length} invite{invitedIds.length === 1 ? "" : "s"} ready
              · keep inviting or finish
            </p>
          ) : (
            <p className="text-center text-[11px] text-fg-subtle">
              Tap Invite — confirmation shows here, sheet stays open
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-fg py-2.5 text-sm font-semibold text-bg"
          >
            {invitedIds.length > 0 ? "Done" : "Close"}
          </button>
        </div>
        ) : null}
      </div>
    </div>
  );
}

