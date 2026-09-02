import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { optionalAuthMiddleware } from "@/lib/auth/optional-middleware";
import { requireModerator } from "@/lib/auth/moderator.server";
import { getSql, type Sql } from "@/lib/db";
import { newId } from "@/lib/game/map";
import type { HoopCheckIn, CourtReview, WorkOrder, WorkOrderKind, WorkOrderStatus } from "@/lib/courts/social";

const kindSchema = z.enum([
  "new_net",
  "broken_rim",
  "broken_backboard",
  "construction",
  "event",
  "closed",
  "other",
]);
const statusSchema = z.enum(["submitted", "received", "in_progress", "resolved"]);
const photoSchema = z
  .string()
  .max(280_000)
  .refine(
    (s) => s.startsWith("data:image/") || s.startsWith("https://"),
    "Invalid photo",
  );

async function requireNamedPlayer(sql: Sql, userId: string) {
  const rows = await sql.query<{ id: string; name: string }>(
    `select id, name from player where user_id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) throw new Error("Sign in to continue.");
  return row;
}

type ReviewRow = {
  id: string;
  court_id: string;
  author_name: string;
  rating: number;
  body: string;
  created_at: string;
};
type OrderRow = {
  id: string;
  court_id: string;
  court_name: string | null;
  kind: string;
  detail: string | null;
  status: string;
  reporter_name: string | null;
  photo_url: string | null;
  photos: unknown;
  created_at: string;
};
type CheckInRow = {
  id: string;
  court_id: string;
  court_name: string | null;
  author_name: string;
  photo_url: string;
  created_at: string;
};

function toReview(row: ReviewRow): CourtReview {
  return {
    id: row.id,
    courtId: row.court_id,
    author: row.author_name,
    rating: Number(row.rating),
    text: row.body,
    at: new Date(row.created_at).toISOString(),
  };
}

function toOrder(row: OrderRow): WorkOrder {
  const photos = Array.isArray(row.photos)
    ? (row.photos as string[]).filter((p) => typeof p === "string")
    : [];
  return {
    id: row.id,
    courtId: row.court_id,
    courtName: row.court_name ?? undefined,
    kind: row.kind as WorkOrderKind,
    detail: row.detail ?? undefined,
    at: new Date(row.created_at).toISOString(),
    status: row.status as WorkOrderStatus,
    reporter: row.reporter_name ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    photos: photos.length ? photos : undefined,
  };
}

export type CourtSocialSnapshot = {
  reviews: CourtReview[];
  workOrders: WorkOrder[];
  checkIns: HoopCheckIn[];
};

async function loadSnapshot(sql: Sql): Promise<CourtSocialSnapshot> {
  const [reviews, orders, checkIns, verifies, chats] = await Promise.all([
    sql.query<ReviewRow>(
      `select id, court_id, author_name, rating, body, created_at
       from court_review order by created_at desc limit 400`,
    ),
    sql.query<OrderRow>(
      `select id, court_id, court_name, kind, detail, status, reporter_name, photo_url, photos, created_at
       from work_order order by created_at desc limit 400`,
    ),
    sql.query<CheckInRow>(
      `select id, court_id, court_name, author_name, photo_url, created_at
       from hoop_checkin
       where created_at > now() - interval '12 hours'
       order by created_at desc limit 200`,
    ),
    sql.query<{ checkin_id: string; author_name: string; created_at: string }>(
      `select checkin_id, author_name, created_at from hoop_verify`,
    ),
    sql.query<{
      id: string;
      checkin_id: string;
      author_name: string;
      body: string;
      photo_url: string | null;
      system: boolean;
      created_at: string;
    }>(
      `select id, checkin_id, author_name, body, photo_url, system, created_at
       from hoop_chat order by created_at asc`,
    ),
  ]);

  const verBy = new Map<string, { author: string; at: string }[]>();
  for (const v of verifies) {
    const list = verBy.get(v.checkin_id) ?? [];
    list.push({ author: v.author_name, at: new Date(v.created_at).toISOString() });
    verBy.set(v.checkin_id, list);
  }
  const chatBy = new Map<string, HoopCheckIn["chat"]>();
  for (const c of chats) {
    const list = chatBy.get(c.checkin_id) ?? [];
    list.push({
      id: c.id,
      author: c.author_name,
      text: c.body,
      at: new Date(c.created_at).toISOString(),
      photoUrl: c.photo_url ?? undefined,
      system: c.system,
    });
    chatBy.set(c.checkin_id, list);
  }

  return {
    reviews: reviews.map(toReview),
    workOrders: orders.map(toOrder),
    checkIns: checkIns.map((row) => ({
      id: row.id,
      courtId: row.court_id,
      courtName: row.court_name ?? undefined,
      author: row.author_name,
      photoUrl: row.photo_url,
      at: new Date(row.created_at).toISOString(),
      verifications: verBy.get(row.id) ?? [],
      chat: chatBy.get(row.id) ?? [],
    })),
  };
}

export const listCourtSocialFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .handler(async () => {
    const sql = await getSql();
    return loadSnapshot(sql);
  });

export const addCourtReviewFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        courtId: z.string().min(1).max(80),
        rating: z.number().int().min(1).max(5),
        text: z.string().trim().min(2).max(600),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requireNamedPlayer(sql, context.userId);
    await sql.query(
      `insert into court_review (id, court_id, author_id, author_name, rating, body)
       values ($1,$2,$3,$4,$5,$6)`,
      [newId("rv"), data.courtId, me.id, me.name, data.rating, data.text],
    );
    return loadSnapshot(sql);
  });

export const addWorkOrderFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        courtId: z.string().min(1).max(80),
        courtName: z.string().max(120).optional(),
        kind: kindSchema,
        detail: z.string().max(400).optional(),
        photos: z.array(photoSchema).max(3).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requireNamedPlayer(sql, context.userId);
    const photos = data.photos ?? [];
    await sql.query(
      `insert into work_order
         (id, court_id, court_name, kind, detail, status, reporter_id, reporter_name, photo_url, photos)
       values ($1,$2,$3,$4,$5,'submitted',$6,$7,$8,$9::jsonb)`,
      [
        newId("wo"),
        data.courtId,
        data.courtName ?? null,
        data.kind,
        data.detail ?? null,
        me.id,
        me.name,
        photos[0] ?? null,
        JSON.stringify(photos),
      ],
    );
    return loadSnapshot(sql);
  });

export const setWorkOrderStatusFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z.object({ id: z.string().min(1), status: statusSchema }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireModerator(sql, context.userId);
    await sql.query(
      `update work_order set status = $2, updated_at = now() where id = $1`,
      [data.id, data.status],
    );
    return loadSnapshot(sql);
  });

export const addHoopCheckInFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        courtId: z.string().min(1).max(80),
        courtName: z.string().max(120).optional(),
        photoUrl: photoSchema,
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requireNamedPlayer(sql, context.userId);
    const id = newId("ci");
    const name = (data.courtName ?? "this court").trim() || "this court";
    const announce = `There are people hooping at ${name} now.`;
    await sql.query(
      `insert into hoop_checkin (id, court_id, court_name, author_id, author_name, photo_url)
       values ($1,$2,$3,$4,$5,$6)`,
      [id, data.courtId, data.courtName ?? null, me.id, me.name, data.photoUrl],
    );
    await sql.query(
      `insert into hoop_chat (id, checkin_id, author_id, author_name, body, photo_url, system)
       values ($1,$2,$3,$4,$5,$6,true)`,
      [newId("hc"), id, me.id, me.name, announce, data.photoUrl],
    );
    return loadSnapshot(sql);
  });

export const verifyHoopCheckInFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => z.object({ checkInId: z.string().min(1) }).parse(raw))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requireNamedPlayer(sql, context.userId);
    const rows = await sql.query<{ author_id: string }>(
      `select author_id from hoop_checkin where id = $1`,
      [data.checkInId],
    );
    if (!rows[0]) throw new Error("That hooping-now post is gone.");
    if (rows[0].author_id === me.id) return loadSnapshot(sql);
    await sql.query(
      `insert into hoop_verify (checkin_id, author_id, author_name)
       values ($1,$2,$3) on conflict do nothing`,
      [data.checkInId, me.id, me.name],
    );
    return loadSnapshot(sql);
  });

export const postHoopChatFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        checkInId: z.string().min(1),
        text: z.string().trim().min(1).max(400),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requireNamedPlayer(sql, context.userId);
    const exists = await sql.query<{ id: string }>(
      `select id from hoop_checkin where id = $1`,
      [data.checkInId],
    );
    if (!exists[0]) throw new Error("That hooping-now post is gone.");
    await sql.query(
      `insert into hoop_chat (id, checkin_id, author_id, author_name, body)
       values ($1,$2,$3,$4,$5)`,
      [newId("hc"), data.checkInId, me.id, me.name, data.text],
    );
    return loadSnapshot(sql);
  });
