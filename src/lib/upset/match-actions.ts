import type { Match, Player } from "./types";

export type MatchActionKind =
  | "confirm_score"
  | "enter_score"
  | "waiting_confirm";

export type MatchAction = {
  match: Match;
  kind: MatchActionKind;
  /** Higher = more urgent */
  priority: number;
  label: string;
  sub: string;
};

function isParty(m: Match, meId: string) {
  return m.hostId === meId || m.opponentId === meId;
}

/** Games on Play that need the user's attention */
export function matchActionsForPlayer(
  matches: Match[],
  me: Player,
): MatchAction[] {
  const meId = me.id;
  const out: MatchAction[] = [];

  for (const m of matches) {
    if (!isParty(m, meId) || !m.opponentId) continue;

    if (m.status === "played_pending" && m.scores?.length) {
      if (m.scoreEnteredBy !== meId) {
        out.push({
          match: m,
          kind: "confirm_score",
          priority: 100,
          label: "Confirm score",
          sub: "Opponent submitted — dual-confirm to lock ratings",
        });
      } else {
        out.push({
          match: m,
          kind: "waiting_confirm",
          priority: 20,
          label: "Waiting on them",
          sub: "You submitted — opponent still needs to confirm",
        });
      }
      continue;
    }

    if (m.status === "disputed") {
      out.push({
        match: m,
        kind: "enter_score",
        priority: 90,
        label: "Re-submit score",
        sub: "Disputed — agree and enter the final result",
      });
      continue;
    }

    if (m.status === "scheduled" || m.status === "matched") {
      out.push({
        match: m,
        kind: "enter_score",
        priority: 50,
        label: "Enter final score",
        sub: "After you play — submit for opponent to confirm",
      });
    }
  }

  return out.sort(
    (a, b) =>
      b.priority - a.priority ||
      (a.match.scheduledAt ?? a.match.preferredAt).localeCompare(
        b.match.scheduledAt ?? a.match.preferredAt,
      ),
  );
}

export function actionCountForPlayer(matches: Match[], me: Player) {
  return matchActionsForPlayer(matches, me).filter(
    (a) => a.kind !== "waiting_confirm",
  ).length;
}
