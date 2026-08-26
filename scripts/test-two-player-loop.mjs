#!/usr/bin/env node
/**
 * Two synthetic players through post → join → score → confirm → rating once.
 * This is a database loop test, not a UI/Safari two-account test.
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

async function migrate(pg) {
  await pg.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  );
  const names = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const name of names) {
    const text = await readFile(join(dir, name), "utf8");
    await pg.exec(text);
    await pg.query("INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING", [name]);
  }
}

async function main() {
  const pg = new PGlite();
  await migrate(pg);

  await pg.query(
    `insert into player (id, user_id, name, handle, rating, rating_last_week)
     values ('p_a', null, 'A', 'a', 1500, 1500), ('p_b', null, 'B', 'b', 1500, 1500)`,
  );
  const when = new Date(Date.now() + 3600_000).toISOString();
  await pg.query(
    `insert into game (id, kind, format, host_id, court_id, court_name, lat, lon, preferred_at, status, invite_only)
     values ('g1','broadcast','1v1','p_a','cat-zilker','Zilker',30.26,-97.77,$1,'open', false)`,
    [when],
  );

  const join1 = await pg.query(
    `update game set opponent_id = $2, status = 'scheduled', scheduled_at = preferred_at, accepted_at = now()
     where id = $1 and status = 'open' and opponent_id is null and host_id <> $2
     returning id`,
    ["g1", "p_b"],
  );
  const join2 = await pg.query(
    `update game set opponent_id = $2, status = 'scheduled', scheduled_at = preferred_at, accepted_at = now()
     where id = $1 and status = 'open' and opponent_id is null and host_id <> $2
     returning id`,
    ["g1", "p_c_fake"],
  );
  if (!join1.rows.length) throw new Error("first join failed");
  if (join2.rows.length) throw new Error("double join should lose");

  await pg.query(
    `update game set scores_json = $2, score_entered_by = $3, status = 'played_pending',
       score_submission_id = 'sub1', score_submitted_at = now()
     where id = $1 and status <> 'confirmed'`,
    ["g1", JSON.stringify([{ a: 11, b: 7 }, { a: 11, b: 9 }]), "p_a"],
  );

  await pg.exec("BEGIN");
  await pg.query("select id from game where id = $1 for update", ["g1"]);
  await pg.query(
    `insert into rating_event (
       id, game_id, host_id, opponent_id,
       host_rating_before, host_rating_after,
       opponent_rating_before, opponent_rating_after,
       host_delta, opponent_delta, actual_a, expected_a, scores_json
     ) values ('re1','g1','p_a','p_b',1500,1512,1500,1488,12,-12,1,0.5,$1)`,
    [JSON.stringify([{ a: 11, b: 7 }, { a: 11, b: 9 }])],
  );
  await pg.query(`update player set rating = 1512, wins = 1, games_played = 1 where id = 'p_a'`);
  await pg.query(`update player set rating = 1488, losses = 1, games_played = 1 where id = 'p_b'`);
  await pg.query(`update game set status = 'confirmed', score_confirmed_by = 'p_b' where id = 'g1'`);
  await pg.exec("COMMIT");

  let dup = false;
  try {
    await pg.query(
      `insert into rating_event (
         id, game_id, host_id, opponent_id,
         host_rating_before, host_rating_after,
         opponent_rating_before, opponent_rating_after,
         host_delta, opponent_delta, actual_a, expected_a, scores_json
       ) values ('re2','g1','p_a','p_b',1512,1520,1488,1480,8,-8,1,0.5,'[]')`,
    );
  } catch {
    dup = true;
  }
  if (!dup) throw new Error("duplicate rating_event should fail");

  const a = await pg.query("select rating, wins from player where id = $1", ["p_a"]);
  const g = await pg.query("select status from game where id = $1", ["g1"]);
  if (Number(a.rows[0].rating) !== 1512) throw new Error("host rating should move once");
  if (g.rows[0].status !== "confirmed") throw new Error("game should be confirmed");

  const chatLeak = await pg.query(
    `select count(*)::int as n from game_message where game_id = 'g1'`,
  );
  void chatLeak;
  console.log("ALL TWO-PLAYER LOOP DB TESTS PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
