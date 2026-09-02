import { useEffect } from "react";
import { create } from "zustand";

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
  addReview: (
    courtId: string,
    rating: number,
    text: string,
    author?: string,
  ) => Promise<void>;
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
  ) => Promise<void>;
  setWorkOrderStatus: (id: string, status: WorkOrderStatus) => Promise<void>;
  bumpFavorite: (courtId: string) => void;
  addCheckIn: (input: {
    courtId: string;
    courtName?: string;
    photoUrl: string;
    author?: string;
  }) => Promise<HoopCheckIn | null>;
  verifyCheckIn: (checkInId: string, author?: string) => Promise<void>;
  postHoopChat: (checkInId: string, text: string, author?: string) => Promise<void>;
  commentOnCheckIn: (checkInId: string, text: string, author?: string) => Promise<void>;
  clearCheckIns: () => void;
  applySnapshot: (snap: {
    reviews: CourtReview[];
    workOrders: WorkOrder[];
    checkIns: HoopCheckIn[];
  }) => void;
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

function applySnap(
  snap: { reviews: CourtReview[]; workOrders: WorkOrder[]; checkIns: HoopCheckIn[] },
) {
  useCourtSocial.setState({
    reviews: snap.reviews,
    workOrders: snap.workOrders,
    checkIns: snap.checkIns,
  });
}

export async function refreshCourtSocial() {
  const { listCourtSocialFn } = await import("@/lib/courts/social-fns");
  const snap = await listCourtSocialFn();
  applySnap(snap);
  return snap;
}

export const useCourtSocial = create<CourtSocialState>()((set, get) => ({
  reviews: [],
  favoriteBonus: {},
  workOrders: [],
  checkIns: [],
  applySnapshot: (snap) => applySnap(snap),
  addReview: async (courtId, rating, text) => {
    const t = text.trim();
    if (!t) return;
    const { addCourtReviewFn } = await import("@/lib/courts/social-fns");
    applySnap(
      await addCourtReviewFn({ data: { courtId, rating, text: t } }),
    );
  },
  addWorkOrder: async (courtId, kind, detail, meta) => {
    const { addWorkOrderFn } = await import("@/lib/courts/social-fns");
    applySnap(
      await addWorkOrderFn({
        data: {
          courtId,
          kind,
          courtName: meta?.courtName,
          detail: detail?.trim() || undefined,
          photos: meta?.photos?.length
            ? meta.photos
            : meta?.photoUrl
              ? [meta.photoUrl]
              : undefined,
        },
      }),
    );
  },
  setWorkOrderStatus: async (id, status) => {
    const { setWorkOrderStatusFn } = await import("@/lib/courts/social-fns");
    applySnap(await setWorkOrderStatusFn({ data: { id, status } }));
  },
  bumpFavorite: (courtId) => {
    set((s) => ({
      favoriteBonus: {
        ...s.favoriteBonus,
        [courtId]: (s.favoriteBonus[courtId] ?? 0) + 1,
      },
    }));
  },
  addCheckIn: async ({ courtId, courtName, photoUrl }) => {
    if (!photoUrl) return null;
    const { addHoopCheckInFn } = await import("@/lib/courts/social-fns");
    applySnap(
      await addHoopCheckInFn({ data: { courtId, courtName, photoUrl } }),
    );
    return (
      get().checkIns.find(
        (c) => c.courtId === courtId && c.photoUrl === photoUrl,
      ) ?? get().checkIns[0] ?? null
    );
  },
  verifyCheckIn: async (checkInId) => {
    const { verifyHoopCheckInFn } = await import("@/lib/courts/social-fns");
    applySnap(await verifyHoopCheckInFn({ data: { checkInId } }));
  },
  postHoopChat: async (checkInId, text) => {
    const t = text.trim();
    if (!t) return;
    const { postHoopChatFn } = await import("@/lib/courts/social-fns");
    applySnap(await postHoopChatFn({ data: { checkInId, text: t } }));
  },
  commentOnCheckIn: async (checkInId, text) => {
    await get().postHoopChat(checkInId, text);
  },
  clearCheckIns: () => set({ checkIns: [] }),
}));

export function useHydrateCourtSocial() {
  useEffect(() => {
    void refreshCourtSocial().catch(() => {
      /* empty until signed actions or next retry */
    });
  }, []);
}

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
