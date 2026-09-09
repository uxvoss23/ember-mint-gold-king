import type { Sql } from "@/lib/db";

export const RATE_LIMITS = {
  createGame: { max: 8, windowSec: 60 * 60 },
  challenge: { max: 20, windowSec: 60 * 60 },
  dm: { max: 30, windowSec: 10 * 60 },
  chat: { max: 60, windowSec: 10 * 60 },
  review: { max: 10, windowSec: 60 * 60 },
  report: { max: 8, windowSec: 60 * 60 },
  checkin: { max: 20, windowSec: 60 * 60 },
  upload: { max: 12, windowSec: 60 * 60 },
} as const;

export type RateBucket = keyof typeof RATE_LIMITS;

export class RateLimitError extends Error {
  retryAfterSec: number;
  status = 429;
  constructor(retryAfterSec: number) {
    super(`Slow down — try again in ${retryAfterSec} seconds.`);
    this.name = "RateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}

function windowStart(windowSec: number, now = Date.now()): Date {
  const ms = windowSec * 1000;
  return new Date(Math.floor(now / ms) * ms);
}

export async function consumeRateLimit(
  sql: Sql,
  bucket: RateBucket,
  subject: string,
): Promise<void> {
  await sql.query(`
    create table if not exists rate_limit_hit (
      bucket text not null,
      subject text not null,
      window_start timestamptz not null,
      hits integer not null default 0,
      primary key (bucket, subject, window_start)
    )
  `);
  const spec = RATE_LIMITS[bucket];
  const start = windowStart(spec.windowSec);
  await sql.query(
    `insert into rate_limit_hit (bucket, subject, window_start, hits)
     values ($1,$2,$3,1)
     on conflict (bucket, subject, window_start)
     do update set hits = rate_limit_hit.hits + 1`,
    [bucket, subject, start.toISOString()],
  );
  const rows = await sql.query<{ hits: number }>(
    `select hits from rate_limit_hit where bucket = $1 and subject = $2 and window_start = $3`,
    [bucket, subject, start.toISOString()],
  );
  const hits = Number(rows[0]?.hits ?? 0);
  if (hits > spec.max) {
    const retry = spec.windowSec - Math.floor((Date.now() - start.getTime()) / 1000);
    throw new RateLimitError(Math.max(1, retry));
  }
}
