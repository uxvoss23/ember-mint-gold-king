/**
 * Structured app logs. Never attach secrets, tokens, emails, or raw GPS.
 */

const DROP = /email|token|authorization|password|cookie|secret|bearer|gps|lat|lon|photo|body/i;

export function appLog(
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const safe: Record<string, unknown> = { ts: new Date().toISOString(), event };
  for (const [key, value] of Object.entries(fields)) {
    if (DROP.test(key)) continue;
    if (typeof value === "string" && value.length > 200) continue;
    safe[key] = value;
  }
  console.info(JSON.stringify(safe));
}

export function appLogError(event: string, err: unknown, fields: Record<string, unknown> = {}): void {
  const message = err instanceof Error ? err.message : "error";
  appLog(event, {
    ...fields,
    ok: false,
    err: message.slice(0, 160),
  });
}
