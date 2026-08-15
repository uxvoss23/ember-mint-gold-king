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
  MessageCircle,
  RotateCcw,
  X,
  Zap,
} from "lucide-react";
import {
  CreateWhenPicker,
  parseLocalDateTime,
  toLocalDateTimeValue,
} from "@/components/compete/create-when-picker";
import { ImageCarousel } from "@/components/image-carousel";
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
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-elevated p-4">
        <p className="text-[15px] font-semibold text-fg">
          Unmatch {unmatchConfirm.name}?
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
            <div className="overflow-hidden rounded-2xl border border-border bg-bg-elevated">
              <div className="relative aspect-video bg-bg-subtle">
                {pickedImgs[0] ? (
                  <img
                    src={pickedImgs[0]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="space-y-1 px-3 py-2.5">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-court uppercase">
                  {isAuto ? "Best meet" : "You chose this court"}
                </p>
                <p className="font-display text-lg leading-tight font-semibold text-fg">
                  {courtShort(picked.name)}
                </p>
                {rankedPicked?.reasons?.length ? (
                  <p className="text-[12px] text-fg-muted">
                    {rankedPicked.reasons.slice(0, 3).join(" · ")}
                  </p>
                ) : null}
                <p className="text-[12px] text-fg-muted">
                  {[
                    rankedPicked
                      ? `${rankedPicked.youMi.toFixed(1)} mi from you`
                      : null,
                    rankedPicked
                      ? `${rankedPicked.themMi.toFixed(1)} mi ${firstName}`
                      : null,
                    lockOpponent.homeCourtId === picked.id
                      ? `${firstName}'s home`
                      : null,
                    picked.neighborhood,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <button
                  type="button"
                  onClick={() => setLockPickOpen((v) => !v)}
                  className="flex min-h-10 items-center gap-0.5 pt-0.5 text-[13px] font-semibold text-fg"
                >
                  {lockPickOpen ? "Done" : "Change court"}
                  <ChevronRight className="size-4 text-fg-muted" />
                </button>
              </div>
              {lockPickOpen ? (
                <div className="flex gap-2 overflow-x-auto overscroll-x-contain border-t border-border px-2.5 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {ranked.map((c) => {
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
                          "w-[38%] max-w-[8.5rem] shrink-0 overflow-hidden rounded-xl border text-left",
                          selected
                            ? "border-court ring-2 ring-court/40"
                            : "border-border bg-bg",
                        )}
                      >
                        <div className="relative aspect-[5/4] bg-bg-subtle">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                          {c.isTopPick ? (
                            <span className="absolute top-1 left-1 rounded-full bg-court px-1.5 py-0.5 text-[8px] font-bold text-white uppercase">
                              Best
                            </span>
                          ) : null}
                        </div>
                        <div className="px-1.5 py-1">
                          <p className="line-clamp-1 text-[11px] font-semibold text-fg">
                            {courtShort(c.name)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">
              When
            </p>
            <CreateWhenPicker
              value={lockWhen}
              onChange={setLockWhen}
              variant="plan"
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
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => openChat(p, m.id)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-bg-elevated px-3 py-2.5 text-left"
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
                    <MessageCircle className="size-4 text-court" />
                  </button>
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
