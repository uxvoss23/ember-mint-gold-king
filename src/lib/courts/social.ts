import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WorkOrderKind =
  | "new_net"
  | "broken_rim"
  | "broken_backboard"
  | "construction"
  | "event"
  | "closed"
  | "other";
export type WorkOrderStatus = "submitted" | "received" | "in_progress" | "resolved";

export interface CourtReview {
  id: string;
  courtId: string;
  author: string;
  rating: number; // 1–5
  text: string;
  at: string;
}

export interface WorkOrder {
  id: string;
  courtId: string;
  courtName?: string;
  kind: WorkOrderKind;
  detail?: string;
  at: string;
  status: WorkOrderStatus;
  reporter?: string;
  photoUrl?: string;
  photos?: string[];
}

export interface HoopVerification {
  author: string;
  at: string;
  /** Optional photo if someone chooses to attach one */
  photoUrl?: string;
  note?: string;
}

export interface HoopChatMessage {
  id: string;
  author: string;
  text: string;
  at: string;
  /** Optional photo attached to this chat message (e.g. auto announce) */
  photoUrl?: string;
  /** System-generated announce (not typed by a player) */
  system?: boolean;
}

/** @deprecated use HoopChatMessage — same shape, chat replaces comments */
export type HoopComment = HoopChatMessage;

/**
 * Live pickup post: first person posts a photo.
 * Auto chat announce is seeded on create. Others confirm with one tap.
 */
export interface HoopCheckIn {
  id: string;
  courtId: string;
  courtName?: string;
  author: string;
  /** @deprecated free-form notes removed — use auto chat announce */
  note?: string;
  photoUrl: string;
  at: string;
  verifications: HoopVerification[];
  /** Group chat for this hooping-now session (any player can join) */
  chat: HoopChatMessage[];
  /** Legacy persist key — migrated into chat on read */
  comments?: HoopChatMessage[];
}

interface CourtSocialState {
  reviews: CourtReview[];
  favoriteBonus: Record<string, number>;
  workOrders: WorkOrder[];
  checkIns: HoopCheckIn[];
  addReview: (courtId: string, rating: number, text: string, author?: string) => void;
  addWorkOrder: (
    courtId: string,
    kind: WorkOrderKind,
    detail?: string,
    meta?: {
      courtName?: string;
      reporter?: string;
      photoUrl?: string;
      photos?: string[];
    },
  ) => void;
  setWorkOrderStatus: (id: string, status: WorkOrderStatus) => void;
  bumpFavorite: (courtId: string) => void;
  /** First reporter: photo required. Auto-posts chat announce. Returns the new post. */
  addCheckIn: (input: {
    courtId: string;
    courtName?: string;
    photoUrl: string;
    author?: string;
  }) => HoopCheckIn | null;
  /** Later arrivals: simple one-tap confirm on an existing live post */
  verifyCheckIn: (checkInId: string, author?: string) => void;
  /** Post to the hooping-now group chat (open to everyone) */
  postHoopChat: (checkInId: string, text: string, author?: string) => void;
  /** @deprecated use postHoopChat */
  commentOnCheckIn: (checkInId: string, text: string, author?: string) => void;
  clearCheckIns: () => void;
}

function hashCount(id: string, min: number, max: number) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const n = Math.abs(h);
  return min + (n % (max - min + 1));
}

export function baseFavoriteCount(courtId: string) {
  return hashCount(courtId, 4, 48);
}

/** Check-ins older than this no longer light the pin as "hooping now" */
export const HOOPING_NOW_MS = 3 * 60 * 60 * 1000; // 3 hours

export function isCheckInLive(
  at: string,
  now = Date.now(),
  windowMs = HOOPING_NOW_MS,
): boolean {
  const t = new Date(at).getTime();
  if (Number.isNaN(t)) return false;
  return now - t >= 0 && now - t <= windowMs;
}

export function liveCheckIns(
  checkIns: HoopCheckIn[],
  now = Date.now(),
): HoopCheckIn[] {
  return checkIns.filter((c) => isCheckInLive(c.at, now));
}

/** Normalize legacy `comments` into `chat` for UI */
export function hoopChatMessages(c: HoopCheckIn): HoopChatMessage[] {
  if (c.chat && c.chat.length) return c.chat;
  return c.comments ?? [];
}

export function liveCheckInsForCourt(
  checkIns: HoopCheckIn[],
  courtId: string,
  now = Date.now(),
): HoopCheckIn[] {
  return liveCheckIns(checkIns, now).filter((c) => c.courtId === courtId);
}

/** Latest live post for a court (first reporter's post) */
export function latestLiveCheckIn(
  checkIns: HoopCheckIn[],
  courtId: string,
  now = Date.now(),
): HoopCheckIn | null {
  const live = liveCheckInsForCourt(checkIns, courtId, now);
  if (!live.length) return null;
  return live.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  )[0]!;
}

export function courtIdsHoopingNow(
  checkIns: HoopCheckIn[],
  now = Date.now(),
): Set<string> {
  const ids = new Set<string>();
  for (const c of liveCheckIns(checkIns, now)) ids.add(c.courtId);
  return ids;
}

export function formatCheckInTime(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const mins = Math.round((now - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Exact clock time for auto announce under the court / in chat */
export function formatCheckInClock(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Standard auto-message when someone confirms people are hooping */
export function hoopingNowAnnounceText(courtName?: string): string {
  const name = (courtName ?? "this court").trim() || "this court";
  return `There are people hooping at ${name} now.`;
}

/** Confirm count = original poster + verifiers */
export function confirmCount(ci: HoopCheckIn): number {
  return 1 + (ci.verifications?.length ?? 0);
}

export function hasVerified(ci: HoopCheckIn, author = "You"): boolean {
  if (ci.author === author) return true;
  return (ci.verifications ?? []).some((v) => v.author === author);
}

/** Learn patterns: typical day/hour windows for pickup at this court */
export function patternsForCourt(
  checkIns: HoopCheckIn[],
  courtId: string,
): { summary: string | null; sample: number } {
  const mine = checkIns.filter((c) => c.courtId === courtId);
  if (mine.length < 2) {
    return { summary: null, sample: mine.length };
  }

  const dayHour = new Map<string, number>(); // "Fri-18"
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (const c of mine) {
    const d = new Date(c.at);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${dayNames[d.getDay()]}-${d.getHours()}`;
    dayHour.set(key, (dayHour.get(key) ?? 0) + 1);
  }

  let bestSlot: string | null = null;
  let bestSlotN = 0;
  for (const [k, n] of dayHour) {
    if (n > bestSlotN) {
      bestSlotN = n;
      bestSlot = k;
    }
  }

  if (!bestSlot) {
    return { summary: null, sample: mine.length };
  }

  const [day, hourStr] = bestSlot.split("-");
  const hour = Number(hourStr);
  const ampm =
    hour === 0
      ? "12am"
      : hour < 12
        ? `${hour}am`
        : hour === 12
          ? "12pm"
          : `${hour - 12}pm`;
  const summary = `Pickup often · ${day}s around ${ampm}`;
  return { summary, sample: mine.length };
}

const SEED_REVIEWS: CourtReview[] = [
  {
    id: "r1",
    courtId: "cat-zilker",
    author: "Marcus H.",
    rating: 5,
    text: "Best outdoor run in central Austin. Bring water on weekends.",
    at: "2026-07-12T18:00:00.000Z",
  },
  {
    id: "r2",
    courtId: "cat-battle-bend",
    author: "Cam O.",
    rating: 4,
    text: "Solid surface, gets busy Friday nights. Nets are good.",
    at: "2026-07-20T19:30:00.000Z",
  },
  {
    id: "r3",
    courtId: "cat-givens",
    author: "Sean R.",
    rating: 5,
    text: "East side staple. Lights until late. Competitive but fair.",
    at: "2026-07-28T21:00:00.000Z",
  },
  {
    id: "r4",
    courtId: "cat-pease",
    author: "Jia N.",
    rating: 4,
    text: "Shady in the afternoon. Great for kids earlier, then adult runs.",
    at: "2026-08-01T16:00:00.000Z",
  },
  {
    id: "r5",
    courtId: "cat-bartholomew",
    author: "Riley C.",
    rating: 3,
    text: "Courts are fine — one rim is a little soft. Still playable.",
    at: "2026-07-15T17:00:00.000Z",
  },
];

const SEED_ORDERS: WorkOrder[] = [
  {
    id: "wo-seed-1",
    courtId: "cat-bartholomew",
    courtName: "Bartholomew District Park",
    kind: "broken_rim",
    at: "2026-08-03T15:20:00.000Z",
    status: "submitted",
    reporter: "Riley C.",
  },
  {
    id: "wo-seed-2",
    courtId: "cat-rosewood",
    courtName: "Rosewood Park",
    kind: "new_net",
    at: "2026-08-04T19:05:00.000Z",
    status: "received",
    reporter: "Marcus H.",
  },
];

function minutesAgo(mins: number): string {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

function daysAgoAt(days: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
}

/** Empty on purpose — start fresh; users create live posts via Confirm Pick Game */
const SEED_CHECKINS: HoopCheckIn[] = [];

export const useCourtSocial = create<CourtSocialState>()(
  persist(
    (set) => ({
      reviews: SEED_REVIEWS,
      favoriteBonus: {},
      workOrders: SEED_ORDERS,
      checkIns: SEED_CHECKINS,
      addReview: (courtId, rating, text, author = "You") => {
        const t = text.trim();
        if (!t) return;
        set((s) => ({
          reviews: [
            {
              id: `r-${Date.now().toString(36)}`,
              courtId,
              author,
              rating: Math.min(5, Math.max(1, rating)),
              text: t,
              at: new Date().toISOString(),
            },
            ...s.reviews,
          ],
        }));
      },
      addWorkOrder: (courtId, kind, detail, meta) => {
        set((s) => ({
          workOrders: [
            {
              id: `wo-${Date.now().toString(36)}`,
              courtId,
              courtName: meta?.courtName,
              kind,
              detail: detail?.trim() || undefined,
              at: new Date().toISOString(),
              status: "submitted",
              reporter: meta?.reporter ?? "Player",
              photoUrl: meta?.photos?.[0] ?? meta?.photoUrl,
              photos:
                meta?.photos && meta.photos.length
                  ? meta.photos
                  : meta?.photoUrl
                    ? [meta.photoUrl]
                    : undefined,
            },
            ...s.workOrders,
          ],
        }));
      },
      setWorkOrderStatus: (id, status) => {
        set((s) => ({
          workOrders: s.workOrders.map((w) =>
            w.id === id ? { ...w, status } : w,
          ),
        }));
      },
      bumpFavorite: (courtId) => {
        set((s) => ({
          favoriteBonus: {
            ...s.favoriteBonus,
            [courtId]: (s.favoriteBonus[courtId] ?? 0) + 1,
          },
        }));
      },
      addCheckIn: ({ courtId, courtName, photoUrl, author }) => {
        if (!photoUrl) return null;
        const at = new Date().toISOString();
        const who = author ?? "You";
        const announce: HoopChatMessage = {
          id: `hm-auto-${Date.now().toString(36)}`,
          author: who,
          text: hoopingNowAnnounceText(courtName),
          at,
          photoUrl,
          system: true,
        };
        const row: HoopCheckIn = {
          id: `ci-${Date.now().toString(36)}`,
          courtId,
          courtName,
          author: who,
          photoUrl,
          at,
          verifications: [],
          chat: [announce],
          comments: [],
        };
        set((s) => ({
          checkIns: [row, ...s.checkIns],
        }));
        return row;
      },
      verifyCheckIn: (checkInId, author = "You") => {
        set((s) => ({
          checkIns: s.checkIns.map((c) => {
            if (c.id !== checkInId) return c;
            if (c.author === author) return c;
            if ((c.verifications ?? []).some((v) => v.author === author)) {
              return c;
            }
            return {
              ...c,
              verifications: [
                ...(c.verifications ?? []),
                { author, at: new Date().toISOString() },
              ],
            };
          }),
        }));
      },
      postHoopChat: (checkInId, text, author = "You") => {
        const t = text.trim();
        if (!t) return;
        const msg: HoopChatMessage = {
          id: `hc-${Date.now().toString(36)}`,
          author,
          text: t,
          at: new Date().toISOString(),
        };
        set((s) => ({
          checkIns: s.checkIns.map((c) => {
            if (c.id !== checkInId) return c;
            const prev = c.chat?.length ? c.chat : (c.comments ?? []);
            return {
              ...c,
              chat: [...prev, msg],
              comments: [...prev, msg],
            };
          }),
        }));
      },
      commentOnCheckIn: (checkInId, text, author = "You") => {
        // legacy alias
        const t = text.trim();
        if (!t) return;
        const msg: HoopChatMessage = {
          id: `hc-${Date.now().toString(36)}`,
          author,
          text: t,
          at: new Date().toISOString(),
        };
        set((s) => ({
          checkIns: s.checkIns.map((c) => {
            if (c.id !== checkInId) return c;
            const prev = c.chat?.length ? c.chat : (c.comments ?? []);
            return {
              ...c,
              chat: [...prev, msg],
              comments: [...prev, msg],
            };
          }),
        }));
      },
      clearCheckIns: () => set({ checkIns: [] }),
    }),
    { name: "court-social-v9" },
  ),
);

export function favoriteCountFor(
  courtId: string,
  userFavorited: boolean,
  bonus: Record<string, number>,
) {
  return baseFavoriteCount(courtId) + (bonus[courtId] ?? 0) + (userFavorited ? 0 : 0);
}

export function reviewsFor(reviews: CourtReview[], courtId: string) {
  return reviews.filter((r) => r.courtId === courtId);
}

export const WORK_ORDER_LABELS: Record<WorkOrderKind, string> = {
  new_net: "New net",
  broken_rim: "Broken rim",
  broken_backboard: "Broken backboard",
  construction: "Construction",
  event: "Event",
  closed: "Closed",
  other: "Other",
};

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  submitted: "New",
  received: "Received",
  in_progress: "In progress",
  resolved: "Resolved",
};

// Admin is email-gated — see `@/lib/auth/admin` (seanvoss23@gmail.com)
