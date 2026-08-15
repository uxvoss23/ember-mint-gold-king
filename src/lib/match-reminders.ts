/**
 * Phone-friendly game reminders.
 *
 * Browsers cannot silently schedule true native alarms. The reliable path is a
 * calendar event with VALARM alerts (24h + 3h) — Apple Calendar / Google Calendar
 * on the phone then fire those notifications even when the app is closed.
 *
 * Optional: browser Notification API for same-device pings while the app can run.
 */

export type ReminderMatch = {
  id: string;
  courtName: string;
  lat: number;
  lon: number;
  whenIso: string;
  hostName: string;
  oppName: string;
  notes?: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** UTC ICS timestamp */
function icsUtc(d: Date): string {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** ~90 min game block */
function endDate(start: Date): Date {
  return new Date(start.getTime() + 90 * 60e3);
}

export function buildMatchIcs(m: ReminderMatch): string {
  const start = new Date(m.whenIso);
  const end = endDate(start);
  const title = `Upset City 1v1 · ${m.hostName} vs ${m.oppName}`;
  const desc = [
    `Rated 1v1 at ${m.courtName}`,
    `${m.hostName} vs ${m.oppName}`,
    m.notes ?? "Best of 3 games · to 11 · win by 2 · call your own fouls",
    "Reminders: 24 hours before · 3 hours before",
  ].join("\\n");
  const uid = `${m.id}@upsetcity.app`;
  const now = icsUtc(new Date());

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Upset City//Match Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(end)}`,
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(desc.replace(/\\n/g, "\n")).replace(/\n/g, "\\n")}`,
    `LOCATION:${escapeIcs(m.courtName)}`,
    `GEO:${m.lat};${m.lon}`,
    // 24 hours before tip-off
    "BEGIN:VALARM",
    "TRIGGER:-PT24H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Upset City — game tomorrow",
    "END:VALARM",
    // 3 hours before tip-off
    "BEGIN:VALARM",
    "TRIGGER:-PT3H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Upset City — game in 3 hours",
    "END:VALARM",
    // 1 hour before tip-off
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Upset City — game in 1 hour",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadMatchIcs(m: ReminderMatch): void {
  const ics = buildMatchIcs(m);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `upset-city-${m.id}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Google Calendar template with text notes about reminders (GCal UI sets alerts on import differently) */
export function googleCalendarUrl(m: ReminderMatch): string {
  const start = new Date(m.whenIso);
  const end = endDate(start);
  const fmt = (d: Date) =>
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Upset City 1v1 · ${m.hostName} vs ${m.oppName}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: [
      `Rated 1v1 at ${m.courtName}`,
      `${m.hostName} vs ${m.oppName}`,
      m.notes ?? "Best of 3 games · to 11 · win by 2 · call your own fouls",
      "Add alerts: 1 day before + 3 hours before",
    ].join("\n"),
    location: m.courtName,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const LS_KEY = "uc-match-reminders-v1";

type Stored = Record<
  string,
  { calendar?: boolean; notifs?: boolean; dismissed?: boolean }
>;

function loadStored(): Stored {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as Stored;
  } catch {
    return {};
  }
}

export function reminderState(matchId: string) {
  return loadStored()[matchId] ?? {};
}

/** True once the user added calendar / dismissed the card — don't show again */
export function remindersCompleted(matchId: string): boolean {
  const s = reminderState(matchId);
  return Boolean(s.calendar || s.dismissed);
}

export function markReminder(
  matchId: string,
  kind: "calendar" | "notifs" | "dismissed",
) {
  const all = loadStored();
  const cur = all[matchId] ?? {};
  all[matchId] = {
    ...cur,
    ...(kind === "calendar"
      ? { calendar: true }
      : kind === "notifs"
        ? { notifs: true }
        : { dismissed: true }),
  };
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

/**
 * Best-effort in-browser notifications (only while the browser can fire them).
 * Calendar is still the real phone reminder path.
 */
export async function scheduleBrowserReminders(
  m: ReminderMatch,
): Promise<{ ok: boolean; reason?: string }> {
  if (typeof Notification === "undefined") {
    return { ok: false, reason: "Notifications not supported on this device." };
  }
  let perm = Notification.permission;
  if (perm === "default") {
    perm = await Notification.requestPermission();
  }
  if (perm !== "granted") {
    return { ok: false, reason: "Notification permission denied." };
  }

  const tip = new Date(m.whenIso).getTime();
  const now = Date.now();
  const targets = [
    { at: tip - 24 * 3600e3, label: "24 hours" },
    { at: tip - 3 * 3600e3, label: "3 hours" },
    { at: tip - 1 * 3600e3, label: "1 hour" },
  ];

  let scheduled = 0;
  for (const t of targets) {
    const delay = t.at - now;
    if (delay <= 0) continue;
    // Cap: browsers throttle long timers; still useful for same-day games.
    if (delay > 7 * 24 * 3600e3) continue;
    window.setTimeout(() => {
      try {
        new Notification(`Upset City · tip-off in ${t.label}`, {
          body: `${m.hostName} vs ${m.oppName} · ${m.courtName}`,
          tag: `uc-${m.id}-${t.label}`,
        });
      } catch {
        /* ignore */
      }
    }, delay);
    scheduled += 1;
  }

  if (scheduled === 0) {
    return {
      ok: false,
      reason: "Game is too soon (or too far) for in-app alerts — use Calendar.",
    };
  }
  markReminder(m.id, "notifs");
  return { ok: true };
}
