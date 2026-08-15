import type { MatchGame, MatchStakes, Player, StakeMode } from "./types";

export const ALZHEIMERS_CHARITY = {
  name: "Alzheimer's Association",
  short: "Alzheimer's research",
  url: "https://www.alz.org/donate",
} as const;

/** Fixed charity gift options (USD) */
export const CHARITY_DONATION_OPTIONS = [5, 10, 15, 20] as const;
export const DEFAULT_CHARITY_DONATION = 10;
export const MAX_STAKE_DOLLARS = 5000;
export const MIN_STAKE_DOLLARS = 1;

export const STAKE_MODE_LABEL: Record<StakeMode, string> = {
  fun: "Just for fun",
  stakes: "Money on the line",
  charity: "Play for charity",
};

export type SettleMethodId =
  | "cashapp"
  | "venmo"
  | "zelle"
  | "cash"
  | "charity";

/** Sum of point margins across every game. 10–2 + 10–5 → 13 */
export function seriesMarginPoints(scores: MatchGame[]): number {
  return scores.reduce((n, g) => n + Math.abs(g.a - g.b), 0);
}

export function hostWonSeries(scores: MatchGame[]): boolean {
  const hostGames = scores.reduce((n, g) => n + (g.a > g.b ? 1 : 0), 0);
  const oppGames = scores.reduce((n, g) => n + (g.b > g.a ? 1 : 0), 0);
  return hostGames > oppGames;
}

export function computeStakePayout(
  stakes: MatchStakes,
  scores: MatchGame[],
  hostId: string,
  opponentId: string,
): MatchStakes {
  if (stakes.mode === "fun") return { ...stakes };
  const hostWon = hostWonSeries(scores);
  const winnerId = hostWon ? hostId : opponentId;
  const loserId = hostWon ? opponentId : hostId;

  // Stakes = name your price (fixed)
  if (stakes.mode === "stakes") {
    const raw = Number(stakes.fixedPriceDollars ?? stakes.amountDollars ?? 0);
    const amountDollars =
      Math.round(
        Math.min(MAX_STAKE_DOLLARS, Math.max(MIN_STAKE_DOLLARS, raw)) * 100,
      ) / 100;
    return {
      ...stakes,
      fixedPriceDollars: amountDollars,
      amountDollars,
      totalMarginPoints: seriesMarginPoints(scores),
      winnerId,
      loserId,
      settled: false,
    };
  }

  // Charity = fixed gift amount (host picks $5 / $10 / $15 / $20)
  if (stakes.mode === "charity") {
    const raw = Number(stakes.fixedPriceDollars ?? stakes.amountDollars ?? 10);
    const amountDollars =
      Math.round(Math.min(MAX_STAKE_DOLLARS, Math.max(MIN_STAKE_DOLLARS, raw)) * 100) /
      100;
    return {
      ...stakes,
      fixedPriceDollars: amountDollars,
      amountDollars,
      totalMarginPoints: seriesMarginPoints(scores),
      winnerId,
      loserId,
      settled: false,
    };
  }

  return { ...stakes, winnerId, loserId, settled: false };
}

export function stakesChipLabel(stakes?: MatchStakes | null): string | null {
  const parts = stakesChipParts(stakes);
  if (!parts) return null;
  return parts.money ? `${parts.kind} · ${parts.money}` : parts.kind;
}

/** Split kind + money for green money styling in UI */
export function stakesChipParts(
  stakes?: MatchStakes | null,
): { kind: string; money: string | null } | null {
  if (!stakes || stakes.mode === "fun") return null;
  if (stakes.mode === "charity") {
    const price = stakes.fixedPriceDollars ?? stakes.amountDollars;
    if (price != null && price > 0) {
      return { kind: "Charity", money: formatMoney(price) };
    }
    return { kind: "Charity", money: null };
  }
  const price = stakes.fixedPriceDollars ?? stakes.amountDollars;
  if (price != null && price > 0) {
    return { kind: "Stakes", money: formatMoney(price) };
  }
  return { kind: "Stakes", money: null };
}

export function stakesExplain(stakes?: MatchStakes | null): string {
  if (!stakes || stakes.mode === "fun") {
    return "Just for fun — rating only, no money.";
  }
  if (stakes.mode === "charity") {
    const price = stakes.fixedPriceDollars ?? stakes.amountDollars ?? 10;
    return `Loser donates ${formatMoney(price)} to ${stakes.charityName ?? "charity"} after the game.`;
  }
  const price = stakes.fixedPriceDollars ?? stakes.amountDollars ?? 0;
  return `Name your price: loser pays winner ${formatMoney(price)} after scores confirm. Peer settle privately — Upset City never holds money.`;
}

export function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`;
}

export function moneyAmountString(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function cleanHandle(raw?: string | null): string {
  if (!raw) return "";
  return raw.trim().replace(/^\$/, "").replace(/^@/, "");
}

/** Build best-effort deep links / copy payloads for private peer settle */
export function settleTargets(
  method: SettleMethodId,
  amount: number,
  payee: Player | null | undefined,
  stakes: MatchStakes,
  note: string,
): {
  openUrl?: string;
  copyPrimary: string;
  copyLabel: string;
  hint: string;
} {
  const amt = moneyAmountString(amount);
  const cash = cleanHandle(payee?.payCashApp);
  const venmo = cleanHandle(payee?.payVenmo);
  const zelle = (payee?.payZelle ?? "").trim();

  if (method === "charity") {
    return {
      openUrl: stakes.charityUrl ?? ALZHEIMERS_CHARITY.url,
      copyPrimary: amt,
      copyLabel: "Copy amount",
      hint: "Donate on the charity site, then mark complete. Upset City never holds your money.",
    };
  }
  if (method === "cashapp") {
    const url = cash
      ? `https://cash.app/$${encodeURIComponent(cash)}/${amt}`
      : undefined;
    return {
      openUrl: url,
      copyPrimary: cash ? `$${cash}` : amt,
      copyLabel: cash ? "Copy $cashtag" : "Copy amount",
      hint: cash
        ? `Send ${formatMoney(amount)} to $${cash} on Cash App.`
        : "Copy the amount, open Cash App, send to the winner. Ask them for their $cashtag if needed.",
    };
  }
  if (method === "venmo") {
    const params = new URLSearchParams({
      txn: "pay",
      amount: amt,
      note: note.slice(0, 50),
    });
    const url = venmo
      ? `https://venmo.com/${encodeURIComponent(venmo)}?${params}`
      : undefined;
    return {
      openUrl: url,
      copyPrimary: venmo ? `@${venmo}` : amt,
      copyLabel: venmo ? "Copy Venmo" : "Copy amount",
      hint: venmo
        ? `Send ${formatMoney(amount)} to @${venmo}. Set the payment to Private.`
        : "Copy amount → Venmo → pay the winner → set to Private.",
    };
  }
  if (method === "zelle") {
    return {
      copyPrimary: zelle || amt,
      copyLabel: zelle ? "Copy Zelle contact" : "Copy amount",
      hint: zelle
        ? `Zelle ${formatMoney(amount)} to ${zelle} from your bank app.`
        : "Copy amount, open your bank’s Zelle, send to the winner.",
    };
  }
  // cash
  return {
    copyPrimary: amt,
    copyLabel: "Copy amount",
    hint: `Pay ${formatMoney(amount)} in cash at the court. Tap settled when done.`,
  };
}
