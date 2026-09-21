import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { markNoticesRead } from "@/lib/game/notices";

export const markNoticesReadFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) =>
    z
      .object({
        ids: z.array(z.string()).max(40).optional(),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await sql.query<{ id: string }>(
      `select id from player where user_id = $1`,
      [context.userId],
    );
    if (!me[0]) return { ok: true as const };
    await markNoticesRead(sql, me[0].id, data.ids);
    return { ok: true as const };
  });
