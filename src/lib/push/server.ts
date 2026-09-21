import webpush from "web-push";
import { appLog, appLogError } from "@/lib/log";
import type { Sql } from "@/lib/db";

const g = globalThis as typeof globalThis & {
  __ucVapid?: { publicKey: string; privateKey: string };
};

function vapidKeys(): { publicKey: string; privateKey: string } | null {
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (pub && priv) return { publicKey: pub, privateKey: priv };
  if (process.env.DATABASE_URL?.trim()) return null;
  g.__ucVapid = g.__ucVapid ?? webpush.generateVAPIDKeys();
  return g.__ucVapid;
}

export function pushPublicKey(): string | null {
  return vapidKeys()?.publicKey ?? null;
}

function mailFrom(): string {
  return process.env.MAIL_FROM?.trim() || "mailto:seanvoss23@gmail.com";
}

export async function sendPushToPlayer(
  sql: Sql,
  playerId: string,
  payload: { title: string; body: string; url: string; tag?: string },
) {
  const keys = vapidKeys();
  if (!keys) return;
  webpush.setVapidDetails(mailFrom(), keys.publicKey, keys.privateKey);
  await sql.query(`
    create table if not exists push_subscription (
      endpoint text primary key,
      player_id text not null,
      p256dh text not null,
      auth text not null,
      created_at timestamptz not null default now()
    )
  `);
  const rows = await sql.query<{
    endpoint: string;
    p256dh: string;
    auth: string;
  }>(
    `select endpoint, p256dh, auth from push_subscription where player_id = $1`,
    [playerId],
  );
  const body = JSON.stringify(payload);
  for (const row of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        body,
      );
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await sql.query(`delete from push_subscription where endpoint = $1`, [row.endpoint]);
        appLog("push.expired");
      } else {
        appLogError("push.failed", err);
      }
    }
  }
}
