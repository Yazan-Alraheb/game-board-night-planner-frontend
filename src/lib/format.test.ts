/// <reference types="bun" />
// TypeScript 7 doesn't auto-load @types packages, so the Bun test types are referenced here.
import { describe, expect, test } from "bun:test";
import { formatEventDate } from "@/lib/format";

/*
 * formatEventDate shows the viewer's local time. These tests build dates with the
 * local-time Date constructor (months are 0-based), so they pass in any time zone.
 */

/** Some ICU versions put a narrow no-break space before AM/PM. */
function format(date: Date, now: Date): string {
  return formatEventDate(date.toISOString(), now).replace(/ /g, " ");
}

describe("formatEventDate", () => {
  const now = new Date(2026, 10, 25, 12, 0); // Wed, Nov 25 2026, local noon

  test("formats local weekday, date and 12-hour time", () => {
    expect(format(new Date(2026, 11, 4, 19, 0), now)).toBe("Fri, Dec 4 · 7:00 PM");
    expect(format(new Date(2026, 10, 26, 9, 5), now)).toBe("Thu, Nov 26 · 9:05 AM");
  });

  test("omits the year for events in the current year", () => {
    expect(format(new Date(2026, 11, 31, 20, 0), now)).not.toContain("2026");
  });

  test("shows the year for events outside the current year", () => {
    expect(format(new Date(2027, 0, 8, 19, 30), now)).toBe("Fri, Jan 8, 2027 · 7:30 PM");
    expect(format(new Date(2025, 11, 31, 19, 0), now)).toBe("Wed, Dec 31, 2025 · 7:00 PM");
  });

  test("midnight and just before midnight land on the right local day", () => {
    expect(format(new Date(2026, 11, 4, 0, 0), now)).toBe("Fri, Dec 4 · 12:00 AM");
    expect(format(new Date(2026, 11, 4, 23, 59), now)).toBe("Fri, Dec 4 · 11:59 PM");
    expect(format(new Date(2026, 11, 4, 12, 0), now)).toBe("Fri, Dec 4 · 12:00 PM");
  });

  test("year change: one minute apart across New Year's midnight", () => {
    const newYearsEve = new Date(2026, 11, 31, 23, 59);
    expect(format(new Date(2026, 11, 31, 23, 59), newYearsEve)).toBe("Thu, Dec 31 · 11:59 PM");
    expect(format(new Date(2027, 0, 1, 0, 0), newYearsEve)).toBe("Fri, Jan 1, 2027 · 12:00 AM");
  });

  test("the year is compared to 'now' in local time, not UTC", () => {
    const justAfterNewYear = new Date(2027, 0, 1, 0, 0, 30);
    expect(format(new Date(2027, 0, 1, 20, 0), justAfterNewYear)).toBe("Fri, Jan 1 · 8:00 PM");
    expect(format(new Date(2026, 11, 31, 20, 0), justAfterNewYear)).toBe("Thu, Dec 31, 2026 · 8:00 PM");
  });

  test("a UTC timestamp from the API is shown on the viewer's local calendar day", () => {
    // 23:30Z on Dec 31 is still 2026 in UTC but already 2027 east of Greenwich.
    const iso = "2026-12-31T23:30:00Z";
    const local = new Date(iso);
    const showsYear = local.getFullYear() !== 2026;
    const text = formatEventDate(iso, new Date(2026, 5, 1)).replace(/ /g, " ");

    expect(text.includes(", 2027")).toBe(showsYear);
    expect(text).toContain(`${local.getDate()} `.trimEnd());
    const hour12 = local.getHours() % 12 || 12;
    expect(text).toContain(`${hour12}:${String(local.getMinutes()).padStart(2, "0")}`);
  });
});
