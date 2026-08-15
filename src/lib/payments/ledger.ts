/**
 * Production settlement ledger (audit trail).
 * App does not custody funds — charity = alz.org + record; peer = Cash App/etc + record.
 * Stripe: set VITE_STRIPE_PUBLISHABLE_KEY when Checkout is wired.
 */
export type PaymentKind = "charity" | "peer";
export type PaymentStatus =
  | "pending"
  | "awaiting_external"
  | "settled"
  | "failed"
  | "disputed";

export type PaymentRecord = {
  id: string;
  matchId: string;
  kind: PaymentKind;
  amountDollars: number;
  currency: "usd";
  status: PaymentStatus;
  payerId: string;
  payeeId?: string;
  method?: string;
  externalRef?: string;
  note?: string;
  createdAt: string;
  settledAt?: string;
  updatedAt: string;
};

const LS = "uc-payment-ledger-v1";

function load(): PaymentRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PaymentRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(rows: PaymentRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS, JSON.stringify(rows.slice(0, 500)));
}

function uid() {
  return `pay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function listPayments(matchId?: string): PaymentRecord[] {
  const all = load();
  if (!matchId) return all;
  return all.filter((r) => r.matchId === matchId);
}

export function createPaymentIntent(input: {
  matchId: string;
  kind: PaymentKind;
  amountDollars: number;
  payerId: string;
  payeeId?: string;
  note?: string;
}): PaymentRecord {
  const now = new Date().toISOString();
  const row: PaymentRecord = {
    id: uid(),
    matchId: input.matchId,
    kind: input.kind,
    amountDollars: Math.round(input.amountDollars * 100) / 100,
    currency: "usd",
    status: "awaiting_external",
    payerId: input.payerId,
    payeeId: input.payeeId,
    note: input.note,
    createdAt: now,
    updatedAt: now,
  };
  const all = load().filter(
    (r) => !(r.matchId === input.matchId && r.status !== "settled"),
  );
  all.unshift(row);
  save(all);
  return row;
}

export function markPaymentSettled(
  matchId: string,
  method: string,
  opts?: {
    amountDollars?: number;
    payerId?: string;
    kind?: PaymentKind;
    externalRef?: string;
  },
): PaymentRecord {
  const all = load();
  const i = all.findIndex((r) => r.matchId === matchId && r.status !== "settled");
  const now = new Date().toISOString();
  if (i < 0) {
    const row: PaymentRecord = {
      id: uid(),
      matchId,
      kind: opts?.kind ?? "charity",
      amountDollars: opts?.amountDollars ?? 0,
      currency: "usd",
      status: "settled",
      payerId: opts?.payerId ?? "unknown",
      method,
      externalRef: opts?.externalRef,
      createdAt: now,
      settledAt: now,
      updatedAt: now,
    };
    all.unshift(row);
    save(all);
    return row;
  }
  all[i] = {
    ...all[i],
    status: "settled",
    method,
    externalRef: opts?.externalRef ?? all[i].externalRef,
    settledAt: now,
    updatedAt: now,
  };
  save(all);
  return all[i];
}

export function stripeEnabled(): boolean {
  try {
    const k = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    return Boolean(k && String(k).length > 8);
  } catch {
    return false;
  }
}
