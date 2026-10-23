// Generates reminders/HHMM.ics: one repeating daily calendar event per half hour.
// They're static files (not generated in the browser) because iPhone Safari only
// offers "Add to Calendar" for .ics files served with a text/calendar content type.
//
// Run: node scripts/generate-reminders.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const START_DATE = "20261023";
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "reminders");
mkdirSync(outDir, { recursive: true });

const pad = (n) => String(n).padStart(2, "0");

for (let hour = 0; hour < 24; hour++) {
  for (const minute of [0, 30]) {
    const hhmm = `${pad(hour)}${pad(minute)}`;
    // Floating local time (no TZID) so the reminder follows the phone's time zone.
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Gratitude//Daily Reminder//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:gratitude-daily-reminder-${hhmm}@gratitude`,
      `DTSTAMP:${START_DATE}T000000Z`,
      `DTSTART:${START_DATE}T${hhmm}00`,
      "DURATION:PT5M",
      "RRULE:FREQ=DAILY",
      "SUMMARY:Gratitude moment",
      "DESCRIPTION:Take a minute to write down something you're grateful for.",
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:What are you grateful for today?",
      "TRIGGER:PT0M",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    writeFileSync(join(outDir, `${hhmm}.ics`), ics);
  }
}
