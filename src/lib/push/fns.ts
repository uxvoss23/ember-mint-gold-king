import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { pushPublicKey } from "./server";

export const getPushPublicKeyFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ publicKey: string | null }> => ({
    publicKey: pushPublicKey(),
  }),
);

export const savePushSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        endpoint: z.string().url().max(2000),
        p256dh: z.string().min(8).max(200),
        auth: z.string().min(8).max(200),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await sql.query<{ id: string }>(
      `select id from player where user_id = $1`,
      [context.userId],
    );
    if (!me[0]) return { ok: false as const };
    await sql.query(`
      create table if not exists push_subscription (
        endpoint text primary key,
        player_id text not null,
        p256dh text not null,
        auth text not null,
        created_at timestamptz not null default now()
      )
    `);
    await sql.query(
      `insert into push_subscription (endpoint, player_id, p256dh, auth)
       values ($1,$2,$3,$4)
       on conflict (endpoint) do update set
         player_id = excluded.player_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth`,
      [data.endpoint, me[0].id, data.p256dh, data.auth],
    );
    return { ok: true as const };
  });
