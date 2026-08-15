import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Info,
  MessageCircle,
  RotateCcw,
  SlidersHorizontal,
  X,
  Zap,
} from "lucide-react";
import {
  CreateWhenPicker,
  parseLocalDateTime,
  toLocalDateTimeValue,
} from "@/components/compete/create-when-picker";
import { ImageCarousel } from "@/components/image-carousel";
import { CourtsMap } from "@/components/courts-map";
import { CourtAboutSheet } from "@/components/compete/court-about-sheet";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { PlayerBrowseFilters } from "@/components/compete/player-browse-filters";
import { MatchChat } from "@/components/compete/match-chat";
import type { Court } from "@/lib/courts/types";
import { courtImagesFor } from "@/lib/courts/images";
import { haversineMi } from "@/lib/maps/midpoint-courts";
import { rankSmartMeetCourts } from "@/lib/maps/smart-meet-courts";
import { displayRating } from "@/lib/rating/engine";
import { cityRankOf, ensureCityRanks } from "@/lib/upset/city-rank";
import {
  DEFAULT_BROWSE_FILTERS,
  playerMatchesBrowseFilters,
  type BrowseFilters,
} from "@/lib/upset/browse-filters";
import {
  DEFAULT_TRAVEL_RADIUS_MI,
  formatSoftAvailability,
  type SoftAvailability,
  useHoopNow,
} from "@/lib/upset/hoop-now";
import { useUpsetStore } from "@/lib/upset/store";
import type { Match, Player } from "@/lib/upset/types";
import { cn, formatHeightInches } from "@/lib/utils";

function courtShort(name: string) {
  return name.replace(/\s*Courts?\s*$/i, "") || name;
}

const RECOMMENDED_COURT_IDS = new Set([
  "cat-butler","cat-wooldridge","cat-rosewood","cat-zaragoza","cat-givens","cat-metz",
  "cat-hancock","cat-ramsey","cat-domain","cat-battle-bend","cat-pease","cat-bartholomew",
  "cat-reed","cat-garrison","cat-walnut-creek","cat-circle-c","cat-searight",
]);
function isShadedCourt(c: { amenities?: string[] }) {
  return (c.amenities ?? []).includes("shade");
}
function isRecommendedCourt(c: { id: string }) {
  return RECOMMENDED_COURT_IDS.has(c.id);
}
function formatMiles(mi: number) {
  if (mi < 0.1) return "<0.1 mi";
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}

function formatWhenLabel(local: string) {
  const d = parseLocalDateTime(local);
  const day = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

function playerGeo(
  p: Player,
  courts: Court[],
): { lat: number; lon: number } {
  const home = courts.find((c) => c.id === p.homeCourtId);
  if (home) return { lat: home.lat, lon: home.lon };
  return { lat: 30.2672, lon: -97.7431 };
}

type Phase = "soft" | "deck" | "matches" | "celebration" | "chat" | "lock";

interface HoopNowFlowProps {
  me: Player;
  players: Player[];
  courts: Court[];
  matches?: Match[];
  userLat?: number;
  userLon?: number;
  browseFilters?: BrowseFilters;
  onBrowseFiltersChange?: (next: BrowseFilters) => void;
  onBack: () => void;
  onChallenge?: (p: Player) => void;
  onMatchLocked?: (matchId: string) => void;
}

export function HoopNowFlow({
  me,
  players,
  courts,
  userLat,
  userLon,
  browseFilters: browseFiltersProp,
  onBrowseFiltersChange,
  onBack,
  onChallenge,
  onMatchLocked,
}: HoopNowFlowProps) {
  const hoop = useHoopNow();
  const store = useUpsetStore();

  const [phase, setPhase] = useState<Phase>("deck");
  const [lockOpponent, setLockOpponent] = useState<Player | null>(null);
  const [lockHoopMatchId, setLockHoopMatchId] = useState<string | null>(null);
  const [lockChatDraft, setLockChatDraft] = useState("");
  const [lockCourtId, setLockCourtId] = useState("");
  const [lockWhen, setLockWhen] = useState("");
  const [lockMyBall, setLockMyBall] = useState<boolean | null>(true);
  const [lockMsg, setLockMsg] = useState<string | null>(null);
  const [lockPickOpen, setLockPickOpen] = useState(false);
  const [lockFiltersOpen, setLockFiltersOpen] = useState(false);
  const [lockSorts, setLockSorts] = useState<Set<string>>(
    () => new Set(["highest_rated", "nearest"]),
  );
  const [lockHood, setLockHood] = useState("all");
  const [lockRadiusMi, setLockRadiusMi] = useState(5);
  const [lockPickMode, setLockPickMode] = useState<"photos" | "map">("photos");
  const [lockInfoId, setLockInfoId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<{
    id: string;
    kind: "pass" | "like";
  } | null>(null);
  const [celebrationName, setCelebrationName] = useState("");
  const [unmatchConfirm, setUnmatchConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [localFilters, setLocalFilters] = useState<BrowseFilters>(
    DEFAULT_BROWSE_FILTERS,
  );
  const browseFilters = browseFiltersProp ?? localFilters;
  const setBrowseFilters = onBrowseFiltersChange ?? setLocalFilters;

  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [fly, setFly] = useState<"left" | "right" | null>(null);
  const pointer = useRef<{
    id: number;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);
  const deckSlotRef = useRef<HTMLDivElement>(null);
  const [cardMaxH, setCardMaxH] = useState<number | null>(null);

  useLayoutEffect(() => {
    const GAP = 16;
    const measure = () => {
      const slot = deckSlotRef.current;
      if (!slot) return;
      const slotTop = slot.getBoundingClientRect().top;
      const bar = document.getElementById("uc-bottom-tab-bar");
      const barTop = bar?.getBoundingClientRect().top;
      const fallbackTab =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--uc-tab-h",
          ),
        ) || 72;
      const viewH = Math.round(
        window.visualViewport?.height ?? window.innerHeight,
      );
      const limit = barTop != null ? barTop : viewH - fallbackTab;
      setCardMaxH(Math.max(240, Math.floor(limit - slotTop - GAP)));
    };
    measure();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    if (deckSlotRef.current) ro?.observe(deckSlotRef.current);
    const bar = document.getElementById("uc-bottom-tab-bar");
    if (bar) ro?.observe(bar);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [phase]);

  useEffect(() => {
    hoop.ensureToday();
    if (!hoop.hasSoftAvailability(me.id)) {
      const av: SoftAvailability = {
        blockedDates: [],
        timeBands: ["evening"],
        travelRadiusMiles: DEFAULT_TRAVEL_RADIUS_MI,
        updatedAt: new Date().toISOString(),
      };
      hoop.setSoftAvailability(me.id, av);
      hoop.join(me.id, {
        mode: "meet_middle",
        courtIds: [],
        radiusMi: DEFAULT_TRAVEL_RADIUS_MI,
        label: formatSoftAvailability(av),
      });
    }
    setPhase((p) => (p === "soft" ? "deck" : p));
  }, [me.id, hoop]);

  useEffect(() => {
    ensureCityRanks(players);
  }, [players]);

  const youGeo = useMemo(() => {
    if (userLat != null && userLon != null)
      return { lat: userLat, lon: userLon };
    return playerGeo(me, courts);
  }, [userLat, userLon, me, courts]);

  const playerById = useMemo(() => {
    const m = new Map(players.map((p) => [p.id, p]));
    m.set(me.id, me);
    return m;
  }, [players, me]);

  const openMatches = hoop.openMatches();
  const matchedIds = useMemo(
    () => new Set(openMatches.map((m) => m.playerId)),
    [openMatches],
  );

  const deck = useMemo(() => {
    return players
      .filter((p) => {
        if (p.id === me.id) return false;
        if (!hoop.isIn(p.id)) return false;
        if (hoop.passedIds.includes(p.id)) return false;
        if (matchedIds.has(p.id)) return false;
        const geo = playerGeo(p, courts);
        const miles = haversineMi(youGeo, geo);
        return playerMatchesBrowseFilters(p, browseFilters, miles);
      })
      .sort((a, b) => b.rating - a.rating);
  }, [
    players,
    me.id,
    hoop,
    hoop.passedIds,
    hoop.playerIds,
    matchedIds,
    courts,
    youGeo,
    browseFilters,
  ]);

  const top = deck[0] ?? null;

  const onPass = useCallback(
    (p: Player) => {
      hoop.pass(p.id);
      setLastAction({ id: p.id, kind: "pass" });
    },
    [hoop],
  );

  const onLike = useCallback(
    (p: Player) => {
      const result = hoop.like(me.id, p.id);
      setLastAction({ id: p.id, kind: "like" });
      if (result.matched) {
        setCelebrationName(p.name.split(" ")[0]);
        setLockOpponent(p);
        setLockHoopMatchId(result.match.id);
        setPhase("celebration");
      }
    },
    [hoop, me.id],
  );

  const onUndo = useCallback(() => {
    if (!lastAction) return;
    hoop.rewind(lastAction.id);
    setLastAction(null);
  }, [hoop, lastAction]);

  const commitSwipe = useCallback(
    (dir: "left" | "right") => {
      if (!top || fly) return;
      setFly(dir);
      setDrag({ x: dir === "right" ? 520 : -520, y: 18 });
      window.setTimeout(() => {
        if (dir === "right") onLike(top);
        else onPass(top);
        setDrag({ x: 0, y: 0 });
        setFly(null);
        pointer.current = null;
      }, 200);
    },
    [top, fly, onLike, onPass],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (fly) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, active: true };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = pointer.current;
    if (!p?.active || p.id !== e.pointerId) return;
    setDrag({ x: e.clientX - p.x, y: (e.clientY - p.y) * 0.22 });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    pointer.current = { ...p, active: false };
    if (drag.x > 88) commitSwipe("right");
    else if (drag.x < -88) commitSwipe("left");
    else setDrag({ x: 0, y: 0 });
  };

  const meetRanked = (opp: Player) => {
    const themGeo = playerGeo(opp, courts);
    const youSoft = hoop.softAvailabilityFor(me.id);
    const theirSoft = hoop.softAvailabilityFor(opp.id);
    const maxOneWay = Math.max(
      5,
      Math.min(
        youSoft?.travelRadiusMiles ?? DEFAULT_TRAVEL_RADIUS_MI,
        theirSoft?.travelRadiusMiles ?? DEFAULT_TRAVEL_RADIUS_MI,
        15,
      ),
    );
    return rankSmartMeetCourts(
      courts,
      youGeo,
      themGeo,
      {
        youHomeCourtId: me.homeCourtId,
        themHomeCourtId: opp.homeCourtId,
      },
      { maxOneWayMi: maxOneWay, limit: 8 },
    );
  };

  const startLockFor = (opp: Player, hoopMatchId?: string) => {
    setLockOpponent(opp);
    if (hoopMatchId) setLockHoopMatchId(hoopMatchId);
    const ranked = meetRanked(opp);
    const hm = hoop.getHoopMatch(hoopMatchId ?? lockHoopMatchId ?? "");
    const pending = (hm?.chat ?? []).find(
      (c) => c.kind === "proposal" && c.proposal?.status === "pending",
    )?.proposal;
    setLockCourtId(pending?.courtId ?? ranked[0]?.id ?? courts[0]?.id ?? "");
    if (pending?.whenLocal) {
      setLockWhen(pending.whenLocal);
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(17, 0, 0, 0);
      setLockWhen(toLocalDateTimeValue(d));
    }
    if (pending?.proposerBall != null) setLockMyBall(pending.proposerBall);
    setLockMsg(null);
    setLockPickOpen(false);
    setPhase("lock");
  };

  const startLock = () => {
    if (!lockOpponent) return;
    startLockFor(lockOpponent, lockHoopMatchId ?? undefined);
  };

  const openChat = (p: Player, hoopMatchId: string) => {
    setLockOpponent(p);
    setLockHoopMatchId(hoopMatchId);
    setLockChatDraft("");
    const hm = hoop.getHoopMatch(hoopMatchId);
    const hasPlan = (hm?.chat ?? []).some((c) => c.kind === "proposal");
    if (hasPlan) setPhase("chat");
    else startLockFor(p, hoopMatchId);
  };

  const sendChat = () => {
    if (!lockHoopMatchId || !lockChatDraft.trim()) return;
    hoop.postHoopChat(lockHoopMatchId, me.id, me.name, lockChatDraft.trim());
    setLockChatDraft("");
  };

  const confirmLock = () => {
    if (!lockOpponent || !lockHoopMatchId) return;
    const court = courts.find((c) => c.id === lockCourtId);
    if (!court || !lockWhen) {
      setLockMsg("Pick a court and a time.");
      return;
    }
    const when = parseLocalDateTime(lockWhen);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
      setLockMsg("Pick a time in the future.");
      return;
    }
    hoop.submitHoopProposal({
      hoopMatchId: lockHoopMatchId,
      proposedById: me.id,
      proposedByName: me.name,
      courtId: court.id,
      courtName: court.name,
      whenLocal: lockWhen,
      whenLabel: formatWhenLabel(lockWhen),
      proposerBall: lockMyBall === true,
    });
    setLockMsg(null);
    setPhase("chat");
  };

  const approvePlan = (asDemo = false) => {
    if (!lockOpponent || !lockHoopMatchId) return;
    const r = hoop.approveHoopProposal(lockHoopMatchId, me.id);
    if (!r.ok) {
      setLockMsg(r.reason);
      return;
    }
    const court = courts.find((c) => c.id === r.proposal.courtId);
    if (!court) return;
    const when = parseLocalDateTime(r.proposal.whenLocal);
    const res = store.createHoopLockedMatch({
      opponentId: lockOpponent.id,
      courtId: court.id,
      courtName: court.name,
      lat: court.lat,
      lon: court.lon,
      preferredAt: when.toISOString(),
      hostBringingBall: r.proposal.proposerBall === true,
    });
    if (!res.ok) {
      setLockMsg(res.reason);
      return;
    }
    hoop.markMatchLocked(lockHoopMatchId, res.match.id);
    onMatchLocked?.(res.match.id);
    void asDemo;
  };

  const unmatchModal = unmatchConfirm ? (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-elevated p-4 shadow-lg">
        <p className="text-[15px] font-semibold text-fg">
          Unmatch {unmatchConfirm.name}?
        </p>
        <p className="mt-1.5 text-[12px] text-fg-muted">
          This match disappears for both of you. You won’t see each other here
          anymore.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setUnmatchConfirm(null)}
            className="flex-1 rounded-full border border-border py-2.5 text-[13px] font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              hoop.unmatch(unmatchConfirm.id);
              if (lockHoopMatchId === unmatchConfirm.id) {
                setLockOpponent(null);
                setLockHoopMatchId(null);
              }
              setUnmatchConfirm(null);
              setPhase("matches");
            }}
            className="flex-1 rounded-full bg-danger py-2.5 text-[13px] font-semibold text-white"
          >
            Unmatch
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (phase === "celebration" && lockOpponent) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-bg px-6 text-center">
        <Heart className="size-12 fill-court text-court" />
        <p className="mt-4 font-display text-3xl font-bold text-fg">It’s a match</p>
        <p className="mt-2 text-[14px] text-fg-muted">
          You and {celebrationName} both liked each other. Pick a court and
          tip-off to lock the run.
        </p>
        <button
          type="button"
          onClick={() => startLock()}
          className="mt-6 rounded-full bg-court px-6 py-3 text-[14px] font-semibold text-white"
        >
          Game details
        </button>
        <button
          type="button"
          onClick={() => setPhase("deck")}
          className="mt-3 text-[12px] font-medium text-fg-muted"
        >
          Keep swiping
        </button>
      </div>
    );
  }

  if (phase === "chat" && lockOpponent && lockHoopMatchId) {
    const hm = hoop.getHoopMatch(lockHoopMatchId);
    if (!hm) return null;
    return (
      <>
        {unmatchModal}
        <MatchChat
          me={me}
          opponent={lockOpponent}
          hoopMatch={hm}
          draft={lockChatDraft}
          onDraftChange={setLockChatDraft}
          onSend={sendChat}
          onBack={() => setPhase("matches")}
          onEditPlan={startLock}
          onApprove={approvePlan}
          error={lockMsg}
        />
      </>
    );
  }

  if (phase === "lock" && lockOpponent) {
    const ranked = meetRanked(lockOpponent);
    const rankedPicked = ranked.find((c) => c.id === lockCourtId) ?? ranked[0];
    const picked =
      rankedPicked ?? courts.find((c) => c.id === lockCourtId);
    const firstName = lockOpponent.name.split(" ")[0];
    const theirSoft = hoop.softAvailabilityFor(lockOpponent.id);
    const hasExistingPlan = (
      hoop.getHoopMatch(lockHoopMatchId ?? "")?.chat ?? []
    ).some((c) => c.kind === "proposal");
    const pickedImgs = picked ? courtImagesFor(picked.id, 5) : [];
    const isAuto = rankedPicked != null && picked?.id === ranked[0]?.id;
    const courtOptions = courts
      .map((c) => ({
        ...c,
        miles: haversineMi(youGeo, { lat: c.lat, lon: c.lon }),
        isTopPick: ranked[0]?.id === c.id,
      }))
      .sort((a, b) => a.miles - b.miles);
    const hoods = Array.from(
      new Set(
        courtOptions
          .map((c) => c.neighborhood)
          .filter((n): n is string => !!n && n.length > 0),
      ),
    ).sort();
    const wantHighest = lockSorts.has("highest_rated");
    const wantShaded = lockSorts.has("shaded");
    const wantNearest = lockSorts.has("nearest");
    let filteredCourts = [...courtOptions];
    if (lockHood !== "all") {
      filteredCourts = filteredCourts.filter((c) => c.neighborhood === lockHood);
    }
    if (lockSorts.size > 0) {
      if (wantHighest)
        filteredCourts = filteredCourts.filter((c) => isRecommendedCourt(c));
      if (wantShaded)
        filteredCourts = filteredCourts.filter((c) => isShadedCourt(c));
      if (wantNearest) {
        filteredCourts = filteredCourts.filter(
          (c) => c.miles <= lockRadiusMi + 0.05,
        );
      }
    }
    filteredCourts.sort((a, b) => {
      if (wantHighest) {
        const aUc = RECOMMENDED_COURT_IDS.has(a.id) ? 1 : 0;
        const bUc = RECOMMENDED_COURT_IDS.has(b.id) ? 1 : 0;
        if (bUc !== aUc) return bUc - aUc;
      }
      return a.miles - b.miles;
    });
    const filterCount = lockSorts.size + (lockHood !== "all" ? 1 : 0);
    return (
      <div
        className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-bg"
        style={{
          maxHeight: "calc(100dvh - var(--uc-tab-h, 72px) - 3.25rem)",
        }}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          <button
            type="button"
            onClick={() => setPhase(hasExistingPlan ? "chat" : "matches")}
            className="flex h-10 items-center gap-0.5 rounded-full border border-border pr-3 pl-1.5 text-[13px] font-semibold text-fg"
          >
            <ChevronLeft className="size-5" />
            Back
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-fg">
              Propose time & place
            </p>
            <p className="text-[11px] text-fg-muted">
              Best options for you and {firstName}
            </p>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [-webkit-overflow-scrolling:touch]">
          {picked ? (
            <div className="overflow-hidden rounded-2xl border border-court/40 bg-court/10">
              {pickedImgs.length > 0 ? (
                <ImageCarousel
                  images={pickedImgs}
                  alt={picked.name}
                  className="w-full"
                  priority
                />
              ) : (
                <div className="aspect-[16/10] w-full bg-bg-subtle" />
              )}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="truncate text-[13px] font-semibold text-fg">
                      {courtShort(picked.name)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setLockInfoId(picked.id)}
                      className="flex size-5 shrink-0 items-center justify-center rounded-full bg-court/20 text-court"
                      aria-label="About this court"
                    >
                      <Info className="size-3" strokeWidth={2.25} />
                    </button>
                  </div>
                  <p className="truncate text-[11px] text-fg-muted">
                    {picked.neighborhood ?? "Austin"}
                    {` · ${formatMiles(
                      haversineMi(youGeo, { lat: picked.lat, lon: picked.lon }),
                    )}`}
                    {isAuto ? " · Best meet" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLockPickOpen((v) => !v)}
                  className="shrink-0 text-[11px] font-semibold text-fg-subtle underline-offset-2"
                >
                  {lockPickOpen ? "Done" : "Change"}
                </button>
              </div>
              {lockPickOpen ? (
                <div className="overflow-hidden border-t border-border">
                  <div className="px-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setLockFiltersOpen((v) => !v)}
                      className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-court/45 bg-court/10 px-3 text-left"
                      aria-expanded={lockFiltersOpen}
                    >
                      <SlidersHorizontal
                        className="size-4 shrink-0 text-court"
                        strokeWidth={2.25}
                      />
                      <span className="text-[14px] font-semibold text-fg">
                        Filters
                      </span>
                      {filterCount > 0 ? (
                        <span className="rounded-full bg-court/20 px-2 py-0.5 text-[11px] font-semibold text-court">
                          {filterCount} active
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-fg-muted">
                          off
                        </span>
                      )}
                      <ChevronRight
                        className={cn(
                          "ml-auto size-4 shrink-0 text-fg-muted transition-transform",
                          lockFiltersOpen && "rotate-90",
                        )}
                      />
                    </button>
                    {lockFiltersOpen ? (
                      <div className="mt-2 space-y-1.5">
                        <p className="text-[10px] font-medium text-fg-subtle">
                          Deselect all to see every court
                        </p>
                        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {(
                            [
                              { id: "highest_rated", label: "Highest rated" },
                              { id: "nearest", label: "Near me" },
                              { id: "shaded", label: "Shaded" },
                            ] as const
                          ).map((opt) => {
                            const on = lockSorts.has(opt.id);
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  setLockSorts((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(opt.id)) next.delete(opt.id);
                                    else next.add(opt.id);
                                    return next;
                                  })
                                }
                                className={cn(
                                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                                  on
                                    ? "bg-fg text-bg"
                                    : "border border-border bg-bg-elevated text-fg-muted",
                                )}
                              >
                                {on ? "✓ " : ""}
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          <button
                            type="button"
                            onClick={() => setLockHood("all")}
                            className={cn(
                              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                              lockHood === "all"
                                ? "bg-fg text-bg"
                                : "border border-border bg-bg-elevated text-fg-muted",
                            )}
                          >
                            {lockHood === "all" ? "✓ " : ""}
                            All areas
                          </button>
                          {hoods.map((h) => (
                            <button
                              key={h}
                              type="button"
                              onClick={() =>
                                setLockHood((prev) => (prev === h ? "all" : h))
                              }
                              className={cn(
                                "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                                lockHood === h
                                  ? "bg-fg text-bg"
                                  : "border border-border bg-bg-elevated text-fg-muted",
                              )}
                            >
                              {lockHood === h ? "✓ " : ""}
                              {h}
                            </button>
                          ))}
                        </div>
                        {wantNearest ? (
                          <div className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {[1, 3, 5, 8, 10, 15].map((mi) => (
                              <button
                                key={mi}
                                type="button"
                                onClick={() => setLockRadiusMi(mi)}
                                className={cn(
                                  "h-7 shrink-0 rounded-full px-2 text-[10px] font-semibold tabular-nums",
                                  lockRadiusMi === mi
                                    ? "bg-court text-white"
                                    : "border border-border bg-bg-elevated text-fg-muted",
                                )}
                              >
                                {mi}mi
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1">
                    <p className="min-w-0 flex-1 truncate text-[10px] text-fg-subtle">
                      {lockPickMode === "map"
                        ? "Tap a pin to select"
                        : wantNearest
                          ? `Near you · ${lockRadiusMi}mi`
                          : "Browse courts"}
                    </p>
                    <div className="flex shrink-0 rounded-full border border-border bg-bg-elevated p-0.5">
                      <button
                        type="button"
                        onClick={() => setLockPickMode("photos")}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          lockPickMode === "photos"
                            ? "bg-fg text-bg"
                            : "text-fg-muted",
                        )}
                      >
                        List
                      </button>
                      <button
                        type="button"
                        onClick={() => setLockPickMode("map")}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          lockPickMode === "map"
                            ? "bg-fg text-bg"
                            : "text-fg-muted",
                        )}
                      >
                        Map
                      </button>
                    </div>
                  </div>
                  {lockPickMode === "map" ? (
                    <CourtsMap
                      courts={filteredCourts}
                      location={{
                        lat: youGeo.lat,
                        lon: youGeo.lon,
                        label: "You",
                      }}
                      selectedId={lockCourtId || null}
                      onSelect={(c) => setLockCourtId(c.id)}
                      variant="finder"
                      mapClassName="h-[min(38dvh,260px)]"
                    />
                  ) : (
                    <div className="flex gap-2 overflow-x-auto overscroll-x-contain px-2.5 pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {filteredCourts.map((c) => {
                        const thumb = courtImagesFor(c.id, 1)[0];
                        const selected = c.id === lockCourtId;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setLockCourtId(c.id);
                              setLockPickOpen(false);
                            }}
                            className={cn(
                              "w-[44%] max-w-[10.5rem] shrink-0 snap-start overflow-hidden rounded-2xl border text-left",
                              selected
                                ? "border-court ring-2 ring-court/50 shadow-md"
                                : "border-border bg-bg-elevated",
                            )}
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
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setLockInfoId(c.id);
                                }}
                                className="absolute top-1.5 left-1.5 z-10 flex size-7 items-center justify-center rounded-full bg-black/55 text-white"
                                aria-label={`About ${c.name}`}
                              >
                                <Info className="size-3.5" strokeWidth={2.25} />
                              </button>
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
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pt-6 pb-1.5">
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
                                {courtShort(c.name)}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                      {filteredCourts.length === 0 ? (
                        <p className="w-full py-3 text-center text-[11px] text-fg-muted">
                          No courts match. Turn off a filter or expand radius.
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {lockInfoId && lockPickMode !== "map" ? (
            <CourtAboutSheet
              court={
                courtOptions.find((c) => c.id === lockInfoId) ??
                courts.find((c) => c.id === lockInfoId) ??
                null
              }
              onClose={() => setLockInfoId(null)}
              onSelectCourt={(id) => {
                setLockCourtId(id);
                setLockInfoId(null);
              }}
              isSelected={lockCourtId === lockInfoId}
              userLat={youGeo.lat}
              userLon={youGeo.lon}
            />
          ) : null}

          <div className="mt-4">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">
              When
            </p>
            <CreateWhenPicker
              value={lockWhen}
              onChange={setLockWhen}
              roomy
              guide={{
                opponentName: firstName,
                blockedDates: theirSoft?.blockedDates,
                preferredBands: theirSoft?.timeBands,
              }}
            />
            {lockMsg ? (
              <p className="mt-2 text-[12px] text-danger">{lockMsg}</p>
            ) : null}
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">
              Basketball
            </p>
            <label className="flex min-h-12 items-center gap-2.5 rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-[13px] font-medium text-fg">
              <input
                type="checkbox"
                checked={lockMyBall === true}
                onChange={(e) => setLockMyBall(e.target.checked)}
                className="size-4 accent-[var(--color-court)]"
              />
              I’ll bring a basketball
            </label>
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-bg px-3 pt-2.5 pb-2">
          <p className="truncate text-[14px] font-semibold text-fg">
            {picked ? courtShort(picked.name) : "Pick a court"}
          </p>
          <p className="text-[12px] text-fg-muted">
            {lockWhen ? formatWhenLabel(lockWhen) : "Choose a day and time"}
          </p>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {lockMyBall === true
              ? "You’re bringing a ball"
              : "No ball confirmed yet"}
          </p>
          <button
            type="button"
            onClick={confirmLock}
            className="mt-2.5 w-full rounded-full bg-court py-3.5 text-[15px] font-semibold text-white"
          >
            Send proposed plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
      {unmatchModal}
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 items-center gap-0.5 rounded-full border border-border pr-3 pl-1.5 text-[13px] font-semibold text-fg"
        >
          <ChevronLeft className="size-5" />
          Back
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-fg">Match Mode</p>
          <p className="text-[11px] text-fg-muted">
            {openMatches.length} open · {deck.length} nearby
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPhase("matches")}
          className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-fg"
        >
          Matches
        </button>
        {phase !== "matches" ? (
          <PlayerBrowseFilters
            value={browseFilters}
            onChange={setBrowseFilters}
            iconOnly
          />
        ) : null}
      </header>

      {phase === "matches" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {openMatches.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <MessageCircle className="mx-auto size-8 text-fg-subtle" />
              <p className="mt-3 text-sm font-semibold text-fg">No matches yet</p>
              <button
                type="button"
                onClick={() => setPhase("deck")}
                className="mt-4 rounded-full bg-court px-5 py-2.5 text-[13px] font-semibold text-white"
              >
                Back to deck
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {openMatches.map((m) => {
                const p = playerById.get(m.playerId);
                if (!p) return null;
                const pending = (m.chat ?? []).some(
                  (c) => c.kind === "proposal" && c.proposal?.status === "pending",
                );
                return (
                  <div
                    key={m.id}
                    className="flex w-full items-center gap-2 rounded-2xl border border-border bg-bg-elevated px-3 py-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => openChat(p, m.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <PlayerAvatar player={p} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-fg">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-fg-muted">
                          {displayRating(p.rating)}
                          {pending ? " · plan waiting" : " · tap to set court"}
                        </p>
                      </div>
                      <MessageCircle className="size-4 shrink-0 text-court" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setUnmatchConfirm({
                          id: m.id,
                          name: p.name.split(" ")[0] || p.name,
                        })
                      }
                      className="shrink-0 rounded-full border border-border px-2.5 py-1.5 text-[11px] font-semibold text-fg-muted"
                    >
                      Unmatch
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pt-2">
          {!top ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <p className="text-sm font-semibold text-fg">No one left nearby</p>
              <p className="mt-1 text-[12px] text-fg-muted">
                Reset filters or check Matches.
              </p>
              <button
                type="button"
                onClick={() => hoop.reshuffle()}
                className="mt-4 rounded-full border border-border px-4 py-2 text-[12px] font-semibold"
              >
                Reshuffle deck
              </button>
            </div>
          ) : (
            <div
              ref={deckSlotRef}
              className="flex min-h-0 flex-1 flex-col items-center"
            >
              <article
                className="flex w-full max-w-[380px] min-h-0 touch-none select-none flex-col overflow-hidden rounded-[28px] bg-black"
                style={{
                  height: cardMaxH ?? undefined,
                  maxHeight: cardMaxH ?? "100%",
                  transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x * 0.035}deg)`,
                  transition:
                    fly || !pointer.current?.active
                      ? "transform 180ms ease"
                      : "none",
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <div className="relative min-h-0 flex-1 overflow-hidden">
                  {top.photoUrl ? (
                    <img
                      src={top.photoUrl}
                      alt=""
                      draggable={false}
                      className="absolute inset-0 h-full w-full object-cover object-[50%_18%]"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-bg-subtle" />
                  )}
                  {cityRankOf(top.id) ? (
                    <span className="absolute top-3 left-3 z-10 rounded-full bg-black/70 px-2.5 py-1 text-[12px] font-semibold text-white">
                      #{cityRankOf(top.id)}
                    </span>
                  ) : null}
                  {drag.x > 28 ? (
                    <span className="absolute top-5 right-4 z-10 rotate-12 rounded-lg border-2 border-emerald-400 px-2.5 py-0.5 text-[13px] font-black tracking-wide text-emerald-400">
                      LIKE
                    </span>
                  ) : null}
                  {drag.x < -28 ? (
                    <span className="absolute top-5 left-4 z-10 -rotate-12 rounded-lg border-2 border-rose-400 px-2.5 py-0.5 text-[13px] font-black tracking-wide text-rose-400">
                      NOPE
                    </span>
                  ) : null}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-4 pt-20 pb-3">
                    <p className="font-display text-[32px] leading-none font-bold tracking-tight text-white">
                      {top.name}
                    </p>
                    <p className="mt-1.5 text-[15px] text-white/70">
                      {formatHeightInches(top.heightIn)}
                    </p>
                    <div className="mt-3 grid grid-cols-4 divide-x divide-white/15">
                      <div className="pr-2">
                        <p className="text-[18px] font-bold tabular-nums text-court">
                          {displayRating(top.rating)}
                        </p>
                        <p className="mt-0.5 text-[8px] font-semibold tracking-[0.12em] text-white/45 uppercase">
                          Rating
                        </p>
                      </div>
                      <div className="px-2">
                        <p className="text-[18px] font-bold tabular-nums text-white">
                          {top.wins}–{top.losses}
                        </p>
                        <p className="mt-0.5 text-[8px] font-semibold tracking-[0.12em] text-white/45 uppercase">
                          W-L Record
                        </p>
                      </div>
                      <div className="px-2">
                        <p className="text-[16px] font-bold text-white">
                          {cityRankOf(top.id)
                            ? `City #${cityRankOf(top.id)}`
                            : "—"}
                        </p>
                        <p className="mt-0.5 text-[8px] font-semibold tracking-[0.12em] text-white/45 uppercase">
                          Rank
                        </p>
                      </div>
                      <div className="pl-2">
                        <p className="truncate text-[15px] font-bold text-white">
                          {top.neighborhood ?? "Austin"}
                        </p>
                        <p className="mt-0.5 text-[8px] font-semibold tracking-[0.12em] text-white/45 uppercase">
                          Location
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 bg-black px-4 pt-3 pb-3.5">
                  <div className="flex items-center justify-center gap-4">
                    <button
                      type="button"
                      aria-label="Undo"
                      disabled={!lastAction}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={onUndo}
                      className={cn(
                        "flex size-12 items-center justify-center rounded-full border-2",
                        lastAction
                          ? "border-amber-400/70 text-amber-400"
                          : "border-white/15 text-white/25",
                      )}
                    >
                      <RotateCcw className="size-5" strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      aria-label="Pass"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => commitSwipe("left")}
                      className="flex size-[3.25rem] items-center justify-center rounded-full border-2 border-rose-400/80 text-rose-400"
                    >
                      <X className="size-7" strokeWidth={2.6} />
                    </button>
                    <button
                      type="button"
                      aria-label="Like"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => commitSwipe("right")}
                      className="flex size-[3.85rem] items-center justify-center rounded-full border-2 border-emerald-400 text-emerald-400"
                    >
                      <Heart className="size-8 fill-emerald-400" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      aria-label="Challenge"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => onChallenge?.(top)}
                      className="flex size-12 items-center justify-center rounded-full border-2 border-sky-400/80 text-sky-400"
                    >
                      <Zap className="size-5 fill-sky-400" strokeWidth={2.2} />
                    </button>
                  </div>
                  <p className="mt-2.5 text-center text-[11px] text-white/40">
                    Swipe right to like · left to pass
                  </p>
                </div>
              </article>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
