import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { optionalAuthMiddleware } from "@/lib/auth/optional-middleware";
import { assertModeratorEmail } from "@/lib/auth/admin";
import { getSql, type Sql } from "@/lib/db";
import type { CourtAdminOverride, CourtFieldOverride } from "@/lib/courts/admin-overrides";
import type { CourtAmenity, CourtSurface } from "@/lib/courts/types";

const photoSchema = z
  .string()
  .max(280_000)
  .refine(
    (s) => s.startsWith("data:image/") || s.startsWith("https://") || s.startsWith("/"),
    "Invalid photo",
  );

const surfaceSchema = z.enum(["concrete", "asphalt", "rubber", "unknown"]);
const amenitySchema = z.enum([
  "lights",
  "full_court",
  "half_court",
  "multiple",
  "water",
  "parking",
  "fence",
  "shade",
]);

type OverrideRow = {
  court_id: string;
  name: string | null;
  address: string | null;
  neighborhood: string | null;
  notes: string | null;
  surface: string | null;
  hoops: number | null;
  amenities: unknown;
  lights_hours: string | null;
  hours: string | null;
  preview_url: string | null;
  gallery: unknown;
  updated_at: string;
};

async function ensureSchema(sql: Sql) {
  await sql.query(`
    create table if not exists court_override (
      court_id text primary key,
      name text,
      address text,
      neighborhood text,
      notes text,
      surface text,
      hoops int,
      amenities jsonb,
      lights_hours text,
      hours text,
      preview_url text,
      gallery jsonb not null default '[]'::jsonb,
      updated_at timestamptz not null default now(),
      updated_by text
    )
  `);
}

async function requireModerator(sql: Sql, userId: string) {
  const users = await sql.query<{ email: string | null }>(
    `select email from "user" where id = $1`,
    [userId],
  );
  assertModeratorEmail(users[0]?.email ?? "");
}

function toOverride(row: OverrideRow): CourtAdminOverride {
  const amenities = Array.isArray(row.amenities)
    ? (row.amenities as CourtAmenity[])
    : undefined;
  const gallery = Array.isArray(row.gallery)
    ? (row.gallery as string[]).filter((p) => typeof p === "string")
    : [];
  return {
    name: row.name ?? undefined,
    address: row.address ?? undefined,
    neighborhood: row.neighborhood ?? undefined,
    notes: row.notes ?? undefined,
    surface: (row.surface as CourtSurface | null) ?? undefined,
    hoops: row.hoops ?? undefined,
    amenities,
    lightsHours: row.lights_hours ?? undefined,
    hours: row.hours ?? undefined,
    photos:
      row.preview_url || gallery.length
        ? { preview: row.preview_url ?? undefined, gallery }
        : undefined,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function loadAll(sql: Sql): Promise<Record<string, CourtAdminOverride>> {
  await ensureSchema(sql);
  const rows = await sql.query<OverrideRow>(`select * from court_override`);
  const out: Record<string, CourtAdminOverride> = {};
  for (const row of rows) out[row.court_id] = toOverride(row);
  return out;
}

async function ensureRow(sql: Sql, courtId: string, userId: string) {
  await ensureSchema(sql);
  await sql.query(
    `insert into court_override (court_id, updated_by) values ($1, $2)
     on conflict (court_id) do nothing`,
    [courtId, userId],
  );
}

export const listCourtOverridesFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .handler(async () => {
    const sql = await getSql();
    return loadAll(sql);
  });

export const upsertCourtFieldsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        courtId: z.string().min(1).max(80),
        fields: z.object({
          name: z.string().max(120).optional(),
          address: z.string().max(200).optional(),
          neighborhood: z.string().max(80).optional(),
          notes: z.string().max(800).optional(),
          surface: surfaceSchema.optional(),
          hoops: z.number().int().min(0).max(40).optional(),
          amenities: z.array(amenitySchema).max(12).optional(),
          lightsHours: z.string().max(80).optional(),
          hours: z.string().max(80).optional(),
        }),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureSchema(sql);
    await requireModerator(sql, context.userId);
    const f: CourtFieldOverride = data.fields;
    await sql.query(
      `insert into court_override
         (court_id, name, address, neighborhood, notes, surface, hoops, amenities, lights_hours, hours, updated_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)
       on conflict (court_id) do update set
         name = excluded.name,
         address = excluded.address,
         neighborhood = excluded.neighborhood,
         notes = excluded.notes,
         surface = excluded.surface,
         hoops = excluded.hoops,
         amenities = excluded.amenities,
         lights_hours = excluded.lights_hours,
         hours = excluded.hours,
         updated_at = now(),
         updated_by = excluded.updated_by`,
      [
        data.courtId,
        f.name ?? null,
        f.address ?? null,
        f.neighborhood ?? null,
        f.notes ?? null,
        f.surface ?? null,
        f.hoops ?? null,
        JSON.stringify(f.amenities ?? []),
        f.lightsHours ?? null,
        f.hours ?? null,
        context.userId,
      ],
    );
    return loadAll(sql);
  });

export const setCourtPreviewFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        courtId: z.string().min(1).max(80),
        photoUrl: photoSchema.nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireModerator(sql, context.userId);
    await ensureRow(sql, data.courtId, context.userId);
    await sql.query(
      `update court_override set preview_url = $2, updated_at = now(), updated_by = $3 where court_id = $1`,
      [data.courtId, data.photoUrl, context.userId],
    );
    return loadAll(sql);
  });

export const addCourtGalleryPhotosFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        courtId: z.string().min(1).max(80),
        photos: z.array(photoSchema).min(1).max(8),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireModerator(sql, context.userId);
    await ensureRow(sql, data.courtId, context.userId);
    const rows = await sql.query<{ gallery: unknown }>(
      `select gallery from court_override where court_id = $1`,
      [data.courtId],
    );
    const prev = Array.isArray(rows[0]?.gallery) ? (rows[0]!.gallery as string[]) : [];
    const gallery = [...prev, ...data.photos].slice(0, 12);
    await sql.query(
      `update court_override set gallery = $2::jsonb, updated_at = now(), updated_by = $3 where court_id = $1`,
      [data.courtId, JSON.stringify(gallery), context.userId],
    );
    return loadAll(sql);
  });

export const replaceCourtGalleryPhotoFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        courtId: z.string().min(1).max(80),
        index: z.number().int().min(0).max(20),
        photoUrl: photoSchema,
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireModerator(sql, context.userId);
    const rows = await sql.query<{ gallery: unknown }>(
      `select gallery from court_override where court_id = $1`,
      [data.courtId],
    );
    const gallery = Array.isArray(rows[0]?.gallery) ? [...(rows[0]!.gallery as string[])] : [];
    if (data.index < 0 || data.index >= gallery.length) throw new Error("Photo not found.");
    gallery[data.index] = data.photoUrl;
    await sql.query(
      `update court_override set gallery = $2::jsonb, updated_at = now(), updated_by = $3 where court_id = $1`,
      [data.courtId, JSON.stringify(gallery), context.userId],
    );
    return loadAll(sql);
  });

export const removeCourtGalleryPhotoFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        courtId: z.string().min(1).max(80),
        index: z.number().int().min(0).max(20),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireModerator(sql, context.userId);
    const rows = await sql.query<{ gallery: unknown }>(
      `select gallery from court_override where court_id = $1`,
      [data.courtId],
    );
    const gallery = Array.isArray(rows[0]?.gallery)
      ? (rows[0]!.gallery as string[]).filter((_, i) => i !== data.index)
      : [];
    await sql.query(
      `update court_override set gallery = $2::jsonb, updated_at = now(), updated_by = $3 where court_id = $1`,
      [data.courtId, JSON.stringify(gallery), context.userId],
    );
    return loadAll(sql);
  });

export const reorderCourtGalleryFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        courtId: z.string().min(1).max(80),
        fromIndex: z.number().int().min(0).max(20),
        toIndex: z.number().int().min(0).max(20),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireModerator(sql, context.userId);
    const rows = await sql.query<{ gallery: unknown }>(
      `select gallery from court_override where court_id = $1`,
      [data.courtId],
    );
    const gallery = Array.isArray(rows[0]?.gallery)
      ? [...(rows[0]!.gallery as string[])]
      : [];
    const from = data.fromIndex;
    const to = data.toIndex;
    if (from < 0 || from >= gallery.length || to < 0 || to >= gallery.length) {
      throw new Error("Photo not found.");
    }
    if (from !== to) {
      const [shot] = gallery.splice(from, 1);
      gallery.splice(to, 0, shot!);
    }
    await sql.query(
      `update court_override set gallery = $2::jsonb, updated_at = now(), updated_by = $3 where court_id = $1`,
      [data.courtId, JSON.stringify(gallery), context.userId],
    );
    return loadAll(sql);
  });

export const promoteCourtGalleryPhotoFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        courtId: z.string().min(1).max(80),
        index: z.number().int().min(0).max(20),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireModerator(sql, context.userId);
    const rows = await sql.query<{ gallery: unknown; preview_url: string | null }>(
      `select gallery, preview_url from court_override where court_id = $1`,
      [data.courtId],
    );
    const row = rows[0];
    const gallery = Array.isArray(row?.gallery) ? [...(row!.gallery as string[])] : [];
    if (data.index < 0 || data.index >= gallery.length) throw new Error("Photo not found.");
    const shot = gallery[data.index]!;
    gallery.splice(data.index, 1);
    if (row?.preview_url) gallery.unshift(row.preview_url);
    await sql.query(
      `update court_override
          set preview_url = $2, gallery = $3::jsonb, updated_at = now(), updated_by = $4
        where court_id = $1`,
      [data.courtId, shot, JSON.stringify(gallery), context.userId],
    );
    return loadAll(sql);
  });
