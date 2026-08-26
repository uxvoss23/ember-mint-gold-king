/** Pregame attendance window and reliability — pure rules. */

export const CHECKIN_OPEN_MS = 45 * 60 * 1000;
export const CHECKIN_CLOSE_MS = 30 * 60 * 1000;
export const NOSHOW_GRACE_MS = 30 * 60 * 1000;
const RELIABILITY_WINDOW = 20;
const RELIABILITY_FLOOR = 1;
const RELIABILITY_CEILING = 5;
const RELIABILITY_BASE = 5;

export type ReliabilityKind =
  | "confirmed_game"
  | "checkin_on_time"
  | "score_confirm_timely"
  | "late_cancel"
  | "verified_noshow";

export const RELIABILITY_WEIGHT: Record<ReliabilityKind, number> = {
  confirmed_game: 0.15,
  checkin_on_time: 0.2,
  score_confirm_timely: 0.15,
  late_cancel: -0.7,
  verified_noshow: -1.1,
};

export function checkInWindow(tipMs: number, nowMs: number): {
  canCheckIn: boolean;
  canReportNoShow: boolean;
} {
  return {
    canCheckIn: nowMs >= tipMs - CHECKIN_OPEN_MS && nowMs <= tipMs + CHECKIN_CLOSE_MS,
    canReportNoShow: nowMs >= tipMs + NOSHOW_GRACE_MS,
  };
}

export function canCheckIn(input: {
  hostId: string;
  opponentId?: string | null;
  actorId: string;
  status: string;
  tipMs: number;
  nowMs: number;
}): { ok: true } | { ok: false; reason: string } {
  if (input.actorId !== input.hostId && input.actorId !== input.opponentId) {
    return { ok: false, reason: "Only participants can check in." };
  }
  if (!input.opponentId) return { ok: false, reason: "Game has no opponent yet." };
  if (input.status !== "scheduled" && input.status !== "matched" && input.status !== "played_pending") {
    return { ok: false, reason: "This game is not in the check-in window." };
  }
  const { canCheckIn: open } = checkInWindow(input.tipMs, input.nowMs);
  if (!open) return { ok: false, reason: "Check-in opens 45 minutes before tip and closes 30 minutes after." };
  return { ok: true };
}

export function canReportNoShow(input: {
  hostId: string;
  opponentId?: string | null;
  actorId: string;
  actorCheckedIn: boolean;
  status: string;
  tipMs: number;
  nowMs: number;
}): { ok: true } | { ok: false; reason: string } {
  if (input.actorId !== input.hostId && input.actorId !== input.opponentId) {
    return { ok: false, reason: "Only participants can report a no-show." };
  }
  if (!input.opponentId) return { ok: false, reason: "Game has no opponent." };
  if (input.status === "confirmed" || input.status === "cancelled") {
    return { ok: false, reason: "This game is already closed." };
  }
  if (!input.actorCheckedIn) {
    return { ok: false, reason: "Check in first before reporting a no-show." };
  }
  const { canReportNoShow: open } = checkInWindow(input.tipMs, input.nowMs);
  if (!open) return { ok: false, reason: "Wait until 30 minutes after tip-off." };
  return { ok: true };
}

export function reliabilityFromEvents(
  events: Array<{ kind: ReliabilityKind }>,
): { score: number; explain: string } {
  const slice = events.slice(-RELIABILITY_WINDOW);
  let acc = RELIABILITY_BASE;
  for (const e of slice) acc += RELIABILITY_WEIGHT[e.kind] ?? 0;
  const score = Math.min(RELIABILITY_CEILING, Math.max(RELIABILITY_FLOOR, Math.round(acc * 10) / 10));
  const noshows = slice.filter((e) => e.kind === "verified_noshow").length;
  const completed = slice.filter((e) => e.kind === "confirmed_game").length;
  const late = slice.filter((e) => e.kind === "late_cancel").length;
  const explain = `${completed} confirmed game${completed === 1 ? "" : "s"} in the last ${slice.length || 0} events${
    late ? ` · ${late} late cancel${late === 1 ? "" : "s"}` : ""
  }${noshows ? ` · ${noshows} verified no-show${noshows === 1 ? "" : "s"}` : ""}. One early mistake fades as you keep showing up.`;
  return { score, explain };
}
