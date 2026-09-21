/**
 * Server-only court photo persistence.
 * Data URLs from the editor are written to disk + `court_photo`, then replaced
 * with a stable `/api/court-photos/:id` URL in `court_override`.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import type { Sql } from "../db.ts";

const PHOTO_DIR = join(process.cwd(), "data", "court-photos");
const ID_RE = /^[a-f0-9]{24,64}$/;

export function parseImageDataUrl(raw: string): { mime: string; bytes: Buffer } | null {
  const m = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i.exec(
    raw.trim(),
  );
  if (!m) return null;
  const mime = m[1]!.toLowerCase() === "image/jpg" ? "image/jpeg" : m[1]!.toLowerCase();
  try {
    const bytes = Buffer.from(m[2]!.replace(/\s+/g, ""), "base64");
    if (bytes.length < 32) return null;
    return { mime, bytes };
  } catch {
    return null;
  }
}

export function isStablePhotoUrl(value: string): boolean {
  return (
    value.startsWith("/api/court-photos/") ||
    value.startsWith("https://") ||
    (value.startsWith("/") && !value.startsWith("/data") && !value.startsWith("data:"))
  );
}

function asBuffer(value: unknown): Buffer | null {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value.length ? value : null;
  if (value instanceof Uint8Array) return value.length ? Buffer.from(value) : null;
  if (typeof value === "string") {
    if (value.startsWith("\\x")) {
      const buf = Buffer.from(value.slice(2), "hex");
      return buf.length ? buf : null;
    }
    try {
      const buf = Buffer.from(value, "base64");
      return buf.length ? buf : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function ensurePhotoTable(sql: Sql) {
  await sql.query(`
    create table if not exists court_photo (
      id text primary key,
      court_id text not null,
      mime text not null,
      bytes bytea not null,
      created_at timestamptz not null default now()
    )
  `);
}

export async function persistCourtPhoto(
  sql: Sql,
  courtId: string,
  raw: string,
): Promise<string> {
  if (isStablePhotoUrl(raw)) return raw;
  const parsed = parseImageDataUrl(raw);
  if (!parsed) throw new Error("Couldn’t save that photo.");
  await ensurePhotoTable(sql);
  const id = randomBytes(16).toString("hex");
  await mkdir(PHOTO_DIR, { recursive: true });
  await writeFile(join(PHOTO_DIR, id), parsed.bytes);
  await sql.query(
    `insert into court_photo (id, court_id, mime, bytes) values ($1, $2, $3, $4)`,
    [id, courtId, parsed.mime, parsed.bytes],
  );
  return `/api/court-photos/${id}`;
}

export async function persistCourtPhotoList(
  sql: Sql,
  courtId: string,
  photos: string[],
): Promise<string[]> {
  const out: string[] = [];
  for (const p of photos) out.push(await persistCourtPhoto(sql, courtId, p));
  return out;
}

export async function readCourtPhoto(
  sql: Sql,
  id: string,
): Promise<{ mime: string; bytes: Buffer } | null> {
  if (!ID_RE.test(id)) return null;
  await ensurePhotoTable(sql);
  const rows = await sql.query<{ mime: string; bytes: unknown }>(
    `select mime, bytes from court_photo where id = $1`,
    [id],
  );
  const row = rows[0];
  if (row) {
    const bytes = asBuffer(row.bytes);
    if (bytes?.length) return { mime: row.mime || "image/jpeg", bytes };
  }
  try {
    const bytes = await readFile(join(PHOTO_DIR, id));
    if (bytes.length) return { mime: "image/jpeg", bytes };
  } catch {
    /* missing on disk */
  }
  return null;
}
