import { create } from "zustand";
import { persist } from "zustand/middleware";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DEMO_SEED_IDS = [
  "p-marcus",
  "p-noah",
  "p-kai",
  "p-devon",
  "p-andre",
  "p-cam",
  "p-riley",
  "p-jia",
  "p-sean",
  "p-tess",
];

/** Demo: these players already liked you — ❤️ = instant match (swipe) */
const DEMO_LIKES_YOU = new Set([
  "p-marcus",
  "p-kai",
  "p-jia",
  "p-cam",
  "p-riley",
  "p-tess",
]);

export type HoopCourtMode = "meet_middle" | "picks";

export type HoopDayPrefs = {
  mode: HoopCourtMode;
  courtIds: string[];
  radiusMi?: number;
  shadedOnly?: boolean;
  highestRatedOnly?: boolean;
  label: string;
};

export type SoftTimeBand = "morning" | "afternoon" | "evening" | "late";

export type SoftAvailability = {
  /** YYYY-MM-DD days they cannot play (next ~2 weeks) */
  blockedDates: string[];
  /** Usual free times of day */
  timeBands: SoftTimeBand[];
  /**
   * How far (miles) you're willing to travel for a game.
   * Court is auto-picked (UC quality + convenience). Override later in chat if needed.
   */
  travelRadiusMiles: number;
  /** @deprecated optional legacy prefs — system picks courts now */
  courtIds?: string[];
  /** Free-text note: skill prefs, height, vibe, etc. */
  note?: string;
  updatedAt: string;
};

export const DEFAULT_TRAVEL_RADIUS_MI = 10;
export const TRAVEL_RADIUS_OPTIONS = [3, 5, 8, 10, 15, 20, 25] as const;

export const SOFT_TIME_BANDS: { id: SoftTimeBand; label: string; short: string }[] = [
  { id: "morning", label: "Mornings", short: "mornings" },
  { id: "afternoon", label: "Afternoons", short: "afternoons" },
  { id: "evening", label: "Evenings", short: "evenings" },
  { id: "late", label: "Late night", short: "late" },
];

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Next 14 calendar days starting today */
export function nextTwoWeekDates(): { key: string; label: string; short: string }[] {
  const out = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + i);
    const key = dateKey(d);
    const short = d.toLocaleDateString(undefined, { weekday: "short" });
    const label =
      i === 0
        ? "Today"
        : i === 1
          ? "Tomorrow"
          : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    out.push({ key, label, short });
  }
  return out;
}

function formatBlockedDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Availability line for swipe cards (times + not-available dates) */
export function formatSoftAvailability(av: SoftAvailability | null | undefined): string {
  if (
    !av ||
    (!av.timeBands.length &&
      !av.blockedDates.length &&
      !av.travelRadiusMiles &&
      !av.note?.trim())
  ) {
    return "Availability not set";
  }
  const bandOrder: SoftTimeBand[] = ["morning", "afternoon", "evening", "late"];
  const bands = bandOrder
    .filter((b) => av.timeBands.includes(b))
    .map((b) => SOFT_TIME_BANDS.find((x) => x.id === b)?.short ?? b);
  const bandLine =
    bands.length === 0
      ? "Flexible times"
      : bands.length === 4
        ? "Most times of day"
        : `Usually ${bands.join(" · ")}`;

  const window = nextTwoWeekDates();
  const blocked = new Set(av.blockedDates);
  const freeCount = window.filter((d) => !blocked.has(d.key)).length;
  const blockedDates = window
    .filter((d) => blocked.has(d.key))
    .slice(0, 4)
    .map((d) => formatBlockedDate(d.key));

  let daysLine: string;
  if (blocked.size === 0) daysLine = "open most of the next 2 weeks";
  else if (freeCount <= 3) daysLine = `only ~${freeCount} days free soon`;
  else if (blockedDates.length)
    daysLine = `Not Available ${blockedDates.join(", ")}${blocked.size > 4 ? "…" : ""}`;
  else daysLine = "some days Not Available";

  const radius = av.travelRadiusMiles || DEFAULT_TRAVEL_RADIUS_MI;
  return `${bandLine} · ${daysLine} · up to ${radius} mi`;
}

/** Short court names for bio (pass name lookup) */
export function formatSoftCourts(
  courtIds: string[] | undefined,
  nameFor: (id: string) => string | undefined,
): string {
  if (!courtIds?.length) return "";
  const names = courtIds
    .map((id) => nameFor(id))
    .filter(Boolean)
    .map((n) => (n as string).replace(/\s*Courts?\s*$/i, "").trim())
    ;
  if (!names.length) return "";
  if (names.length <= 3) return names.join(" · ");
  return `${names.slice(0, 3).join(" · ")} +${names.length - 3}`;
}

function seedDemoAvailability(): Record<string, SoftAvailability> {
  const window = nextTwoWeekDates();
  const pick = (idxs: number[]) => idxs.map((i) => window[i]?.key).filter(Boolean) as string[];
  const now = new Date().toISOString();
  const mk = (
    blocked: number[],
    bands: SoftTimeBand[],
    courtIds: string[],
    note?: string,
    travelRadiusMiles: number = DEFAULT_TRAVEL_RADIUS_MI,
  ): SoftAvailability => ({
    blockedDates: pick(blocked),
    timeBands: bands,
    travelRadiusMiles,
    courtIds: [...courtIds],
    note,
    updatedAt: now,
  });
  return {
    "p-marcus": mk([1, 8], ["evening", "late"], ["cat-battle-bend", "cat-zilker", "cat-rosewood"], "Prefer similar rating · clean 1v1"),
    "p-noah": mk([0, 2, 9], ["afternoon", "evening"], ["cat-rosewood", "cat-givens", "cat-metz"], "6ft 2in+ preferred · competitive but respectful"),
    "p-kai": mk([3, 4], ["morning", "evening"], ["cat-pease", "cat-hancock", "cat-butler"], "Beginner-friendly · looking for non-competitive runs"),
    "p-devon": mk([6, 7, 13], ["evening"], ["cat-domain", "cat-walnut-creek", "cat-bartholomew"], "Around my rating or higher"),
    "p-andre": mk([2, 5], ["afternoon", "evening", "late"], ["cat-rosewood", "cat-givens", "cat-zaragoza"], "Afternoons & evenings. Will travel for physical paint runs."),
    "p-cam": mk([], ["morning", "afternoon", "evening", "late"], ["cat-butler", "cat-wooldridge", "cat-pease"], "Flexible · just want to hoop"),
    "p-riley": mk([1, 3, 10], ["evening"], ["cat-pease", "cat-hancock", "cat-reed"], "Friendly games only · no toxic vibes"),
    "p-jia": mk([5, 12], ["afternoon", "evening"], ["cat-metz", "cat-zaragoza", "cat-givens"], "East side evenings. Fair fouls, no flopping."),
    "p-sean": mk([0, 6], ["evening", "late"], ["cat-givens", "cat-battle-bend", "cat-circle-c"], "Rated games preferred"),
    "p-tess": mk([4, 11], ["morning", "afternoon"], ["cat-ramsey", "cat-searight", "cat-garrison"], "Learning · patient partners appreciated"),
  };
}

export type HoopProposalStatus = "pending" | "approved" | "superseded";

export type HoopChatMsg = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  at: string;
  system?: boolean;
  kind?: "text" | "proposal" | "proposal_update";
  proposal?: {
    courtId: string;
    courtName: string;
    whenLocal: string;
    whenLabel: string;
    proposerBall: boolean | null;
    proposedById: string;
    proposedByName: string;
    status: HoopProposalStatus;
  };
};

/** Mutual match after both liked (swipe) */
export type HoopMatch = {
  id: string;
  /** The other player */
  playerId: string;
  /** Who started the like that completed the match */
  fromPlayerId?: string;
  matchedAt: string;
  status: "new" | "locked" | "pending_confirm";
  /** Upset City scheduled game id once court/time locked */
  gameMatchId?: string;
  /** Negotiate before lock */
  chat: HoopChatMsg[];
  proposedCourtId?: string;
  proposedWhenLocal?: string;
  proposedById?: string;
  proposedBall?: boolean;
  activeProposalMsgId?: string;
  /** playerId -> bringing a ball? */
  ballByPlayerId: Record<string, boolean>;
};

export type HoopPendingChallenge = {
  id: string;
  toPlayerId: string;
  fromPlayerId: string;
  courtIds: string[];
  courtLabel: string;
  sentAt: string;
  status: "pending" | "accepted" | "declined" | "superseded";
};

const DEMO_PREFS: Record<string, HoopDayPrefs> = {
  "p-marcus": {
    mode: "picks",
    courtIds: ["cat-zilker", "cat-battle-bend"],
    label: "2 courts selected",
  },
  "p-noah": {
    mode: "picks",
    courtIds: ["cat-rosewood", "cat-givens", "cat-metz"],
    label: "3 courts",
  },
  "p-kai": {
    mode: "meet_middle",
    courtIds: [],
    label: "Best meeting point",
  },
  "p-jia": {
    mode: "meet_middle",
    courtIds: [],
    label: "Best meeting point",
  },
  "p-devon": {
    mode: "picks",
    courtIds: ["cat-domain", "cat-walnut-creek"],
    label: "2 courts",
  },
  "p-andre": {
    mode: "picks",
    courtIds: ["cat-rosewood", "cat-givens"],
    label: "2 courts",
  },
  "p-cam": {
    mode: "meet_middle",
    courtIds: [],
    label: "Best meeting point",
  },
  "p-riley": {
    mode: "picks",
    courtIds: ["cat-pease", "cat-hancock"],
    label: "2 courts · shaded",
  },
  "p-sean": {
    mode: "picks",
    courtIds: ["cat-givens"],
    label: "Givens",
  },
  "p-tess": {
    mode: "meet_middle",
    courtIds: [],
    label: "Best meeting point",
  },
};

type HoopNowState = {
  day: string;
  playerIds: string[];
  prefsById: Record<string, HoopDayPrefs>;
  passedIds: string[];
  /** People you liked (no match yet) */
  likedIds: string[];
  matches: HoopMatch[];
  pending: HoopPendingChallenge[];
  /** Soft availability by player — shown on swipe bios */
  softAvailability: Record<string, SoftAvailability>;
  ensureToday: () => void;
  join: (playerId: string, prefs: HoopDayPrefs) => void;
  leave: (playerId: string) => void;
  pass: (playerId: string) => void;
  rewind: (playerId: string) => void;
  reshuffle: () => void;
  /** Wipe likes, passes, and open matches — full Match Mode reset */
  resetMatchMode: () => void;
  isIn: (playerId: string) => boolean;
  prefsFor: (playerId: string) => HoopDayPrefs | null;
  setSoftAvailability: (playerId: string, av: SoftAvailability) => void;
  clearSoftAvailability: (playerId: string) => void;
  softAvailabilityFor: (playerId: string) => SoftAvailability | null;
  hasSoftAvailability: (playerId: string) => boolean;
  /**
   * swipe like. Always advances deck.
   * Returns a new match when they already liked you (or demo reciprocal).
   */
  like: (
    fromPlayerId: string,
    toPlayerId: string,
  ) => { matched: false } | { matched: true; match: HoopMatch };
  openMatches: () => HoopMatch[];
  markMatchLocked: (hoopMatchId: string, gameMatchId: string) => void;
  postHoopChat: (
    hoopMatchId: string,
    authorId: string,
    authorName: string,
    text: string,
  ) => void;
  setHoopBall: (
    hoopMatchId: string,
    playerId: string,
    bringing: boolean,
  ) => void;
  setHoopProposal: (
    hoopMatchId: string,
    patch: { courtId?: string; whenLocal?: string },
  ) => void;
  submitHoopProposal: (input: {
    hoopMatchId: string;
    proposedById: string;
    proposedByName: string;
    courtId: string;
    courtName: string;
    whenLocal: string;
    whenLabel: string;
    proposerBall: boolean;
  }) => { ok: true; proposalMsgId: string };
  approveHoopProposal: (
    hoopMatchId: string,
    byPlayerId: string,
  ) =>
    | { ok: true; proposal: NonNullable<HoopChatMsg["proposal"]> }
    | { ok: false; reason: string };
  getHoopMatch: (id: string) => HoopMatch | undefined;
  /** Remove match + like; player stays out of deck (still passed) */
  unmatch: (hoopMatchId: string) => { ok: true } | { ok: false; reason: string };
  sendChallenge: (input: {
    fromPlayerId: string;
    toPlayerId: string;
    courtIds: string[];
    courtLabel: string;
  }) => HoopPendingChallenge;
  acceptAndClearOthers: (challengeId: string, fromPlayerId: string) => void;
  supersedeAllPending: (fromPlayerId: string) => void;
  pendingFor: (fromPlayerId: string) => HoopPendingChallenge[];
  incomingFor: (toPlayerId: string) => HoopPendingChallenge[];
  declineChallenge: (challengeId: string) => void;
};

function seedPrefs(): Record<string, HoopDayPrefs> {
  return { ...DEMO_PREFS };
}

export const useHoopNow = create<HoopNowState>()(
  persist(
    (set, get) => ({
      day: todayKey(),
      playerIds: [],
      prefsById: {},
      passedIds: [],
      likedIds: [],
      matches: [],
      pending: [],
      softAvailability: seedDemoAvailability(),
      ensureToday: () => {
        const today = todayKey();
        const s = get();
        if (s.day !== today) {
          // New calendar day: refresh who is "in the pool" for swipe,
          // but keep open matches & history so you can book later in the week.
          set({
            day: today,
            playerIds: [...DEMO_SEED_IDS],
            prefsById: seedPrefs(),
            passedIds: [],
            // keep likedIds + matches + pending
          });
          return;
        }
        const seedAv = seedDemoAvailability();
        const stored = s.softAvailability ?? {};
        const mergedSoft: Record<string, SoftAvailability> = {
          ...seedAv,
          ...stored,
        };
        for (const id of Object.keys(seedAv)) {
          const cur = mergedSoft[id];
          const seed = seedAv[id];
          if (cur && seed?.note && !cur.note?.trim()) {
            mergedSoft[id] = { ...cur, note: seed.note };
          }
        }
        const missing = DEMO_SEED_IDS.filter((id) => !s.playerIds.includes(id));
        if (missing.length > 0 || s.playerIds.length === 0) {
          set({
            playerIds: [...new Set([...DEMO_SEED_IDS, ...s.playerIds])],
            prefsById: { ...seedPrefs(), ...s.prefsById },
            softAvailability: mergedSoft,
          });
        } else if (Object.keys(stored).length === 0) {
          set({ softAvailability: seedAv });
        } else if (
          Object.keys(seedAv).some(
            (id) => seedAv[id]?.note && !stored[id]?.note?.trim(),
          )
        ) {
          set({ softAvailability: mergedSoft });
        }
      },
      join: (playerId, prefs) => {
        get().ensureToday();
        set((s) => ({
          day: todayKey(),
          playerIds: [playerId, ...s.playerIds.filter((id) => id !== playerId)],
          prefsById: { ...s.prefsById, [playerId]: prefs },
        }));
      },
      leave: (playerId) => {
        set((s) => {
          const next = { ...s.prefsById };
          delete next[playerId];
          return {
            playerIds: s.playerIds.filter((id) => id !== playerId),
            prefsById: next,
          };
        });
      },
      pass: (playerId) => {
        set((s) => ({
          passedIds: s.passedIds.includes(playerId)
            ? s.passedIds
            : [...s.passedIds, playerId],
        }));
      },
      rewind: (playerId) => {
        set((s) => ({
          passedIds: s.passedIds.filter((id) => id !== playerId),
          likedIds: s.likedIds.filter((id) => id !== playerId),
        }));
      },
      reshuffle: () => {
        get().ensureToday();
        set((s) => ({
          day: todayKey(),
          playerIds: s.playerIds.length > 0 ? s.playerIds : [...DEMO_SEED_IDS],
          prefsById:
            Object.keys(s.prefsById).length > 0 ? s.prefsById : seedPrefs(),
          passedIds: [],
        }));
      },
      resetMatchMode: () => {
        set({
          day: todayKey(),
          playerIds: [...DEMO_SEED_IDS],
          prefsById: seedPrefs(),
          passedIds: [],
          likedIds: [],
          matches: [],
          pending: [],
        });
      },
      isIn: (playerId) => {
        const s = get();
        if (s.day !== todayKey()) return false;
        return s.playerIds.includes(playerId);
      },
      prefsFor: (playerId) => {
        const s = get();
        if (s.day !== todayKey()) return DEMO_PREFS[playerId] ?? null;
        return s.prefsById[playerId] ?? DEMO_PREFS[playerId] ?? null;
      },
      setSoftAvailability: (playerId, av) => {
        set((s) => ({
          softAvailability: {
            ...s.softAvailability,
            [playerId]: {
              ...av,
              blockedDates: [...new Set(av.blockedDates)].sort(),
              timeBands: [...new Set(av.timeBands)],
              travelRadiusMiles:
                typeof av.travelRadiusMiles === "number" && av.travelRadiusMiles > 0
                  ? av.travelRadiusMiles
                  : DEFAULT_TRAVEL_RADIUS_MI,
              courtIds: [...new Set(av.courtIds ?? [])],
              note: av.note?.trim() || undefined,
              updatedAt: new Date().toISOString(),
            },
          },
        }));
      },
      clearSoftAvailability: (playerId) => {
        set((s) => {
          const next = { ...s.softAvailability };
          delete next[playerId];
          return { softAvailability: next };
        });
      },
      softAvailabilityFor: (playerId) => {
        const s = get();
        const av = s.softAvailability[playerId];
        if (!av) return seedDemoAvailability()[playerId] ?? null;
        return {
          ...av,
          travelRadiusMiles:
            typeof av.travelRadiusMiles === "number" && av.travelRadiusMiles > 0
              ? av.travelRadiusMiles
              : DEFAULT_TRAVEL_RADIUS_MI,
        };
      },
      hasSoftAvailability: (playerId) => {
        const av = get().softAvailability[playerId];
        return !!av && av.timeBands.length > 0;
      },
      like: (fromPlayerId, toPlayerId) => {
        get().ensureToday();
        const s = get();
        const alreadyMatched = s.matches.some(
          (m) => m.playerId === toPlayerId && m.status === "new",
        );
        const likedIds = s.likedIds.includes(toPlayerId)
          ? s.likedIds
          : [...s.likedIds, toPlayerId];
        const passedIds = s.passedIds.includes(toPlayerId)
          ? s.passedIds
          : [...s.passedIds, toPlayerId];

        // Mutual if demo likes you back (or already liked — future real reciprocal)
        const theyLikeYou = DEMO_LIKES_YOU.has(toPlayerId);
        if (theyLikeYou && !alreadyMatched) {
          const match: HoopMatch = {
            id: `hm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            playerId: toPlayerId,
            fromPlayerId,
            matchedAt: new Date().toISOString(),
            status: "new",
            chat: [
              {
                id: `hc-${Date.now()}`,
                authorId: "system",
                authorName: "Upset City",
                text: "It's a match. Chat to lock court & time — both of you need to agree.",
                at: new Date().toISOString(),
                system: true,
              },
            ],
            ballByPlayerId: {},
          };
          set({
            likedIds,
            passedIds,
            matches: [match, ...s.matches.filter((m) => m.playerId !== toPlayerId)],
          });
          return { matched: true, match };
        }

        set({ likedIds, passedIds });
        return { matched: false };
      },
      openMatches: () =>
        get().matches
          .filter((m) => m.status === "new" || m.status === "pending_confirm")
          .map((m) => ({
            ...m,
            chat: m.chat ?? [],
            ballByPlayerId: m.ballByPlayerId ?? {},
          })),
      markMatchLocked: (hoopMatchId, gameMatchId) => {
        // Remove from Match Mode — chat was migrated onto the scheduled game
        set((s) => ({
          matches: s.matches.filter((m) => m.id !== hoopMatchId),
          // gameMatchId kept only if we reintroduce history later
        }));
        void gameMatchId;
      },
      getHoopMatch: (id) => get().matches.find((m) => m.id === id),
      unmatch: (hoopMatchId) => {
        const s0 = get();
        const m =
          s0.matches.find((x) => x.id === hoopMatchId) ??
          s0.matches.find(
            (x) =>
              x.playerId === hoopMatchId &&
              (x.status === "new" || x.status === "pending_confirm"),
          );
        if (!m) return { ok: false as const, reason: "Match not found." };
        if (m.status === "locked") {
          return {
            ok: false as const,
            reason:
              "This run is already scheduled — cancel the game in Play if needed.",
          };
        }
        const pid = m.playerId;
        const mid = m.id;
        set((s) => ({
          matches: s.matches.filter((x) => x.id !== mid && x.playerId !== pid),
          likedIds: s.likedIds.filter((id) => id !== pid),
          passedIds: s.passedIds.includes(pid)
            ? s.passedIds
            : [...s.passedIds, pid],
        }));
        return { ok: true as const };
      },
      postHoopChat: (hoopMatchId, authorId, authorName, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== hoopMatchId) return m;
            const chat = [
              ...(m.chat ?? []),
              {
                id: `hc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                authorId,
                authorName,
                text: trimmed,
                at: new Date().toISOString(),
                system: authorId === "system",
              },
            ];
            return { ...m, chat };
          }),
        }));
      },
      setHoopBall: (hoopMatchId, playerId, bringing) => {
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== hoopMatchId) return m;
            return {
              ...m,
              ballByPlayerId: {
                ...(m.ballByPlayerId ?? {}),
                [playerId]: bringing,
              },
            };
          }),
        }));
      },
      setHoopProposal: (hoopMatchId, patch) => {
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== hoopMatchId) return m;
            return {
              ...m,
              proposedCourtId:
                patch.courtId !== undefined
                  ? patch.courtId
                  : m.proposedCourtId,
              proposedWhenLocal:
                patch.whenLocal !== undefined
                  ? patch.whenLocal
                  : m.proposedWhenLocal,
            };
          }),
        }));
      },
      /**
       * Send time/place/ball summary to match chat for the other player to approve.
       * Does NOT schedule until they approve.
       */
      submitHoopProposal: (input: {
        hoopMatchId: string;
        proposedById: string;
        proposedByName: string;
        courtId: string;
        courtName: string;
        whenLocal: string;
        whenLabel: string;
        proposerBall: boolean;
      }) => {
        const id = `hc-prop-${Date.now()}`;
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== input.hoopMatchId) return m;
            // supersede prior pending proposals in chat
            const chat = (m.chat ?? []).map((c) =>
              c.kind === "proposal" && c.proposal?.status === "pending"
                ? {
                    ...c,
                    proposal: { ...c.proposal, status: "superseded" as const },
                    text: c.text.replace("Needs approval", "Superseded"),
                  }
                : c,
            );
            const who = input.proposedByName.split(" ")[0] || "Someone";
            const isYou =
              who === "You" ||
              input.proposedByName === "You" ||
              input.proposedById === "p-you" ||
              input.proposedById === "you";
            const ballLine = isYou
              ? input.proposerBall
                ? "You are bringing a basketball"
                : "You are not bringing a basketball"
              : input.proposerBall
                ? `${who} is bringing a basketball`
                : `${who} is not bringing a basketball`;
            const hadPlan = (m.chat ?? []).some((c) => c.kind === "proposal");
            const summary = `${isYou ? "You" : who} proposed ${input.courtName} · ${input.whenLabel}. ${ballLine}. Needs approval.`;
            chat.push({
              id,
              authorId: input.proposedById,
              authorName: input.proposedByName,
              text: summary,
              at: new Date().toISOString(),
              kind: "proposal",
              proposal: {
                courtId: input.courtId,
                courtName: input.courtName,
                whenLocal: input.whenLocal,
                whenLabel: input.whenLabel,
                proposerBall: input.proposerBall,
                proposedById: input.proposedById,
                proposedByName: input.proposedByName,
                status: "pending",
              },
            });
            if (hadPlan) {
              chat.push({
                id: `hc-sys-${Date.now()}`,
                authorId: "system",
                authorName: "Upset City",
                text: `${isYou ? "You" : who} proposed a new time\n${input.whenLabel}`,
                at: new Date().toISOString(),
                system: true,
                kind: "proposal_update",
              });
            }
            return {
              ...m,
              status: "pending_confirm" as const,
              chat,
              proposedCourtId: input.courtId,
              proposedWhenLocal: input.whenLocal,
              proposedById: input.proposedById,
              proposedBall: input.proposerBall,
              activeProposalMsgId: id,
              ballByPlayerId: {
                ...(m.ballByPlayerId ?? {}),
                [input.proposedById]: input.proposerBall,
              },
            };
          }),
        }));
        return { ok: true as const, proposalMsgId: id };
      },
      approveHoopProposal: (hoopMatchId: string, byPlayerId: string) => {
        let result:
          | { ok: true; proposal: NonNullable<HoopChatMsg["proposal"]> }
          | { ok: false; reason: string } = {
          ok: false,
          reason: "No pending plan.",
        };
        set((s) => {
          const m = s.matches.find((x) => x.id === hoopMatchId);
          if (!m) {
            result = { ok: false, reason: "Match not found." };
            return s;
          }
          const msg = (m.chat ?? []).find(
            (c) =>
              c.id === m.activeProposalMsgId ||
              (c.kind === "proposal" && c.proposal?.status === "pending"),
          );
          if (!msg?.proposal || msg.proposal.status !== "pending") {
            result = { ok: false, reason: "No pending plan to approve." };
            return s;
          }
          // Allow proposer to demo-approve for NPC, or real opponent
          result = { ok: true, proposal: msg.proposal };
          const chat = (m.chat ?? []).map((c) =>
            c.id === msg.id && c.proposal
              ? {
                  ...c,
                  proposal: { ...c.proposal, status: "approved" as const },
                  text: c.text.replace("Needs approval", "Approved ✓"),
                }
              : c,
          );
          chat.push({
            id: `hc-ok-${Date.now()}`,
            authorId: "system",
            authorName: "Upset City",
            text: `✓ Game confirmed\n${msg.proposal.courtName.replace(/\s*Courts?\s*$/i, "")} · ${msg.proposal.whenLabel}`,
            at: new Date().toISOString(),
            system: true,
          });
          return {
            ...s,
            matches: s.matches.map((x) =>
              x.id === hoopMatchId
                ? {
                    ...x,
                    chat,
                    // stay pending_confirm until markMatchLocked sets locked
                  }
                : x,
            ),
          };
        });
        return result;
      },
      sendChallenge: ({ fromPlayerId, toPlayerId, courtIds, courtLabel }) => {
        get().ensureToday();
        const row: HoopPendingChallenge = {
          id: `hn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          fromPlayerId,
          toPlayerId,
          courtIds,
          courtLabel,
          sentAt: new Date().toISOString(),
          status: "pending",
        };
        set((s) => ({ pending: [row, ...s.pending] }));
        return row;
      },
      acceptAndClearOthers: (challengeId, fromPlayerId) => {
        set((s) => ({
          pending: s.pending.map((p) => {
            if (p.fromPlayerId !== fromPlayerId) return p;
            if (p.id === challengeId)
              return { ...p, status: "accepted" as const };
            if (p.status === "pending")
              return { ...p, status: "superseded" as const };
            return p;
          }),
        }));
      },
      supersedeAllPending: (fromPlayerId) => {
        set((s) => ({
          pending: s.pending.map((p) =>
            p.fromPlayerId === fromPlayerId && p.status === "pending"
              ? { ...p, status: "superseded" as const }
              : p,
          ),
        }));
      },
      pendingFor: (fromPlayerId) =>
        get().pending.filter(
          (p) => p.fromPlayerId === fromPlayerId && p.status === "pending",
        ),
      incomingFor: (toPlayerId) =>
        get().pending.filter(
          (p) => p.toPlayerId === toPlayerId && p.status === "pending",
        ),
      declineChallenge: (challengeId) => {
        set((s) => ({
          pending: s.pending.map((p) =>
            p.id === challengeId && p.status === "pending"
              ? { ...p, status: "declined" as const }
              : p,
          ),
        }));
      },
    }),
    {
      name: "uc-hoop-now-v15",
      migrate: (persisted: unknown) => {
        const s = (persisted ?? {}) as Partial<HoopNowState> & {
          softAvailability?: Record<string, SoftAvailability>;
          playerIds?: string[];
          prefsById?: Record<string, unknown>;
        };
        const soft = { ...(s.softAvailability ?? {}) };
        delete soft["p-you"];
        delete soft["you"];
        const prefs = { ...(s.prefsById ?? {}) };
        delete prefs["p-you"];
        delete prefs["you"];
        return {
          ...s,
          softAvailability: soft,
          playerIds: [...DEMO_SEED_IDS],
          prefsById: { ...seedPrefs(), ...prefs },
          passedIds: [],
          likedIds: [],
          matches: [],
          pending: [],
        };
      },
      version: 2,
    },
  ),
);

export function hoopNowDayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
