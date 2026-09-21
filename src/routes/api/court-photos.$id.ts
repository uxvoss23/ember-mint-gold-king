import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { readCourtPhoto } from "@/lib/courts/photo-store";

export const Route = createFileRoute("/api/court-photos/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const id =
          params.id ||
          new URL(request.url).pathname.split("/").filter(Boolean).pop() ||
          "";
        const sql = await getSql();
        const photo = await readCourtPhoto(sql, id);
        if (!photo) {
          return new Response("Not found", { status: 404 });
        }
        return new Response(new Uint8Array(photo.bytes), {
          status: 200,
          headers: {
            "Content-Type": photo.mime,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
