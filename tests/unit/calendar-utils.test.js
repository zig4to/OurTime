const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadCalendarModule } = require("../support/load-calendar-module.js");

const m = loadCalendarModule();

test("splitDuration: en dash (current format)", () => {
  assert.deepEqual(m.splitDuration("20:00–22:00"), { start: "20:00", end: "22:00" });
});

test("splitDuration: plain hyphen with spaces (legacy format)", () => {
  // Regression: real event "Odbojka" was stored as "20:00 - 22:00" before the
  // en-dash format was standardized. Editing it must still prefill the time
  // inputs instead of leaving them blank.
  assert.deepEqual(m.splitDuration("20:00 - 22:00"), { start: "20:00", end: "22:00" });
});

test("splitDuration: single time, no end", () => {
  assert.deepEqual(m.splitDuration("18:00"), { start: "18:00", end: "" });
});

test("splitDuration: empty/undefined", () => {
  assert.deepEqual(m.splitDuration(""), { start: "", end: "" });
  assert.deepEqual(m.splitDuration(undefined), { start: "", end: "" });
});

test("decodeEvent: legacy empty id is preserved, not coerced to null/undefined", () => {
  // Regression: three real events in the shared calendar were created before
  // per-day event ids existed, so their storage key has no id suffix and
  // decodeEvent is called with id === "". Any code downstream that checks
  // "id ? ... : null" instead of "id != null ? ... : null" silently treats
  // this as "no id" and loses the event.
  const raw = JSON.stringify({
    title: "Odbojka",
    description: "Poden",
    duration: "20:00 - 22:00",
    createdBy: "Žiga Tomše",
    attendees: ["Žiga Tomše"],
  });
  const ev = m.decodeEvent(raw, "");
  assert.equal(ev.id, "");
  assert.equal(ev.title, "Odbojka");
  assert.equal(ev.createdBy, "Žiga Tomše");
  assert.deepEqual(ev.attendees, ["Žiga Tomše"]);
});

test("decodeEvent: invalid JSON returns null", () => {
  assert.equal(m.decodeEvent("not json", "123"), null);
});

test("decodeEvent: keyword defaults to empty string when absent (older events)", () => {
  const raw = JSON.stringify({ title: "Brez ključne besede", createdBy: "X", attendees: [] });
  const ev = m.decodeEvent(raw, "1");
  assert.equal(ev.keyword, "");
});

test("decodeEvent: keyword round-trips", () => {
  const raw = JSON.stringify({ title: "Odbojka", keyword: "šport", createdBy: "X", attendees: [] });
  const ev = m.decodeEvent(raw, "1");
  assert.equal(ev.keyword, "šport");
});

test("eventKey: legacy id (empty string) round-trips through the key format", () => {
  const key = m.eventKey("2026-08-27", "");
  assert.equal(key, "avail:2026-08-27:__event__");
  assert.equal(m.isoFromKey(key), "2026-08-27");
  assert.equal(m.personFromKey(key), "__event__");
});

test("eventKey: normal id", () => {
  const key = m.eventKey("2026-08-27", "1699999999999");
  assert.equal(key, "avail:2026-08-27:__event__1699999999999");
});

test("encodeHours / decodeHours round-trip", () => {
  const hours = Array(24).fill(null);
  hours[9] = "free";
  hours[10] = "free";
  hours[18] = "busy";
  const encoded = m.encodeHours(hours);
  assert.equal(encoded.length, 24);
  assert.deepEqual(m.decodeHours(encoded), hours);
});

test("decodeHours: legacy whole-day formats", () => {
  assert.deepEqual(m.decodeHours("free"), Array(24).fill("free"));
  assert.deepEqual(m.decodeHours("busy"), Array(24).fill("busy"));
});

test("decodeHours: legacy window JSON format", () => {
  const raw = JSON.stringify({ type: "window", from: 9, to: 12, mode: "busy" });
  const hours = m.decodeHours(raw);
  assert.equal(hours[8], null);
  assert.equal(hours[9], "busy");
  assert.equal(hours[11], "busy");
  assert.equal(hours[12], null);
});

test("decodeHours: empty/garbage falls back to blank", () => {
  assert.deepEqual(m.decodeHours(""), m.blankHours());
  assert.deepEqual(m.decodeHours("garbage"), m.blankHours());
});

test("encodeEntry / decodeEntry round-trip with a note", () => {
  const entry = { hours: m.blankHours(), note: "na jošta | z vejico in črko č" };
  entry.hours[10] = "free";
  const encoded = m.encodeEntry(entry);
  const decoded = m.decodeEntry(encoded);
  assert.deepEqual(decoded.hours, entry.hours);
  assert.equal(decoded.note, entry.note);
});

test("encodeEntry: blank note is omitted (no trailing separator)", () => {
  const encoded = m.encodeEntry({ hours: m.blankHours(), note: "  " });
  assert.equal(encoded.includes("|"), false);
});

test("normalizeName: trims, collapses whitespace, capitalizes each part", () => {
  assert.equal(m.normalizeName("  tina  ", "brdnik"), "Tina Brdnik");
  assert.equal(m.normalizeName("žiga", "tomše"), "Žiga Tomše");
});

test("hasSurname", () => {
  assert.equal(m.hasSurname("Žiga Tomše"), true);
  assert.equal(m.hasSurname("Žiga"), false);
  assert.equal(m.hasSurname(""), false);
});

test("splitName", () => {
  assert.deepEqual(m.splitName("Žiga Tomše"), { first: "Žiga", last: "Tomše" });
  assert.deepEqual(m.splitName("Žiga"), { first: "Žiga", last: "" });
});

test("personFromKey: names containing a colon survive the round trip", () => {
  assert.equal(m.personFromKey("avail:2026-08-27:Ime: s dvopičjem"), "Ime: s dvopičjem");
  assert.equal(m.personFromKey("avail:2026-08-27"), null);
});

test("addDays / dayLabel across a DST-adjacent date", () => {
  // Ljubljana switches to CEST on the last Sunday of March; date math is done
  // at UTC midnight so this must not skip or repeat a day.
  assert.equal(m.addDays("2026-03-28", 1), "2026-03-29");
  assert.equal(m.addDays("2026-03-29", 1), "2026-03-30");
});

test("shortDateLabel: weekday abbrev + day.month, no leading zeros", () => {
  assert.equal(m.shortDateLabel("2026-08-22"), "sob. 22.8");
  assert.equal(m.shortDateLabel("2026-02-01"), "ned. 1.2");
});

test("dayLabel: Danes/Jutri override weekday names", () => {
  const today = "2026-08-27";
  assert.equal(m.dayLabel(today, today), "Danes");
  assert.equal(m.dayLabel(m.addDays(today, 1), today), "Jutri");
});

test("freeBusyTier / dominantStatus / groupSegments", () => {
  const allFree = Array(24).fill("free");
  const allBusy = Array(24).fill("busy");
  const mixed = m.blankHours();
  mixed[8] = "busy";
  mixed[9] = "busy";
  mixed[14] = "free";

  assert.equal(m.freeBusyTier(allFree), "free");
  assert.equal(m.freeBusyTier(allBusy), "busy");
  assert.equal(m.freeBusyTier(mixed), "partial");

  assert.equal(m.dominantStatus(mixed), "busy"); // 2 busy vs 1 free
  assert.equal(m.dominantStatus(m.blankHours()), null);

  assert.deepEqual(m.groupSegments(mixed), [
    { from: 8, to: 10, status: "busy" },
    { from: 14, to: 15, status: "free" },
  ]);
});

test("initials / capitalize / fmtHour / entryCountLabel", () => {
  assert.equal(m.initials("Žiga Tomše"), "ŽT");
  assert.equal(m.capitalize("žiga"), "Žiga");
  assert.equal(m.fmtHour(9), "09:00");
  assert.equal(m.entryCountLabel(0), "Še nihče ni vnesel");
  assert.equal(m.entryCountLabel(1), "1 vnos");
  assert.equal(m.entryCountLabel(3), "3 vnosi");
  assert.equal(m.entryCountLabel(7), "7 vnosov");
});

test("assignEventColors: no two cards on screen share a color", () => {
  // Twelve is the palette size, i.e. the worst case that still has to come
  // out clean. Plain hashing does not: several of these titles collide.
  const titles = [
    "SUP na Savi", "Odbojka", "Hribi", "Plezanje", "Pica", "Kino",
    "Kolesarjenje", "Tek ob Savi", "Rojstni dan", "Koncert", "Savna", "Piknik",
  ];
  const events = titles.map((title, i) => ({ id: String(i), title }));

  const colors = m.assignEventColors(events);
  assert.equal(colors.length, titles.length);
  assert.equal(new Set(colors).size, titles.length, "a color was reused");
});

test("assignEventColors: stable for an unchanged list, and survives overflow", () => {
  const events = [
    { id: "1", title: "SUP na Savi" },
    { id: "2", title: "Odbojka" },
    { id: "3", title: "Hribi" },
  ];
  assert.deepEqual(m.assignEventColors(events), m.assignEventColors(events));

  // A short list gets to keep the hashed hue outright -- nothing to collide
  // with -- which is what keeps a card's color steady across refreshes.
  events.forEach((ev, i) => {
    assert.equal(m.assignEventColors(events)[i], m.assignEventColors([ev])[0]);
  });

  // Past the palette repeats are unavoidable; it must still colour every card.
  const many = Array.from({ length: 30 }, (_, i) => ({ id: String(i), title: `Dogodek ${i}` }));
  const overflow = m.assignEventColors(many);
  assert.equal(overflow.length, 30);
  assert.ok(overflow.every((c) => typeof c === "string" && c.length > 0));
});

test("eventsNearestFirst: soonest date first, then start time, then id", () => {
  const dayEvents = {
    // Deliberately not in key order: Object.entries follows insertion order
    // for string keys, so the sort has to do the work, not the map.
    "2026-08-30": [{ id: "5", title: "SUP na Savi", duration: "13:00–16:00" }],
    "2026-08-23": [
      { id: "9", title: "Hribi pozno", duration: "18:00–20:00" },
      { id: "2", title: "Hribi zgodaj", duration: "07:00–15:00" },
    ],
    "2026-08-27": [{ id: "7", title: "Odbojka", duration: "20:00–22:00" }],
  };

  assert.deepEqual(
    m.eventsNearestFirst(dayEvents).map((ev) => ev.title),
    ["Hribi zgodaj", "Hribi pozno", "Odbojka", "SUP na Savi"]
  );
});

test("eventsNearestFirst: total order, so card colors can't shuffle on rerender", () => {
  // Same day, same start time: only the id can separate these two, and it has
  // to, or their positions (and therefore their colors) flip between renders.
  const dayEvents = {
    "2026-08-23": [
      { id: "20", title: "Drugi", duration: "10:00–11:00" },
      { id: "10", title: "Prvi", duration: "10:00–11:00" },
    ],
  };
  assert.deepEqual(
    m.eventsNearestFirst(dayEvents).map((ev) => ev.title),
    ["Prvi", "Drugi"]
  );

  // A legacy event stored with a blank id sorts as 0 rather than NaN, which
  // would make the comparator return NaN and leave the order undefined.
  const withLegacy = {
    "2026-08-23": [
      { id: "10", title: "Novi", duration: "10:00–11:00" },
      { id: "", title: "Legacy", duration: "10:00–11:00" },
    ],
  };
  assert.deepEqual(
    m.eventsNearestFirst(withLegacy).map((ev) => ev.title),
    ["Legacy", "Novi"]
  );
});
