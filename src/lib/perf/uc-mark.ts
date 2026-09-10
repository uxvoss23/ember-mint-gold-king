/** Lightweight stage timings for Create-map diagnosis. */

export type UcPerfRow = { stage: string; t: number };

function store(): UcPerfRow[] {
  if (typeof window === "undefined") return [];
  const w = window as Window & { __ucPerf?: UcPerfRow[] };
  if (!w.__ucPerf) w.__ucPerf = [];
  return w.__ucPerf;
}

export function ucMark(stage: string) {
  const t = typeof performance !== "undefined" ? Math.round(performance.now()) : Date.now();
  store().push({ stage, t });
}

export function ucPerfSnapshot() {
  const rows = store();
  if (rows.length === 0) return [];
  const t0 = rows[0]!.t;
  return rows.map((r) => ({ stage: r.stage, at: r.t, dt: r.t - t0 }));
}
