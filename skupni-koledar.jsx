import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users,
  ChevronRight,
  Pencil,
  Eraser,
  Trash2,
  MessageSquare,
  Settings,
  Sun,
  Moon,
  Plus,
} from "lucide-react";
import {
  styles,
  GREEN,
  GREEN_BG,
  ORANGE,
  RED,
  RED_BG,
  PINK,
  NEUTRAL_BG,
  NEUTRAL_TEXT,
} from "styles";

const THEME_CSS = `
  :root[data-theme="light"] {
    --bg: #FAF9F6;
    --card-bg: #FFFFFF;
    --input-bg: #FDFCFA;
    --text: #233029;
    --text-heading: #1B2E24;
    --text-strong: #374840;
    --text-secondary: #5B6862;
    --text-muted: #8A9A91;
    --text-faint: #9AA5A0;
    --text-note: #7C8A83;
    --text-fainter: #B3BBB5;
    --neutral-text: #AEB4AC;
    --surface-strong: #1B2E24;
    --border: #EEEDE7;
    --border-input: #E3E1D9;
    --divider: #F1F0EA;
    --divider-soft: #F5F4EF;
    --avatar-border: #CFE4DA;
    --green: #2F6F5E;
    --green-bg: #E4F1EC;
    --red: #B23434;
    --red-bg: #F7E9E4;
    --orange: #C6862F;
    --pink: #B85C7A;
  }
  :root[data-theme="dark"] {
    --bg: #14181A;
    --card-bg: #1D2321;
    --input-bg: #191F1D;
    --text: #E7EBE6;
    --text-heading: #F4F6F2;
    --text-strong: #D6DDD6;
    --text-secondary: #A6B0A9;
    --text-muted: #8A968E;
    --text-faint: #7C8983;
    --text-note: #93A099;
    --text-fainter: #63706A;
    --neutral-text: #57635D;
    --surface-strong: #2E3733;
    --border: #2A302E;
    --border-input: #3A423E;
    --divider: #262C2A;
    --divider-soft: #232928;
    --avatar-border: #34443C;
    --green: #4FA88E;
    --green-bg: #1D2E28;
    --red: #E15A5A;
    --red-bg: #34211C;
    --orange: #E0A855;
    --pink: #E08FA8;
  }
`;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const AUTH_CODE = "122333";
const ADMIN_NAME = "žiga tomše";
const TIME_ZONE = "Europe/Ljubljana";

// Days are plain "YYYY-MM-DD" strings anchored to Ljubljana rather than Date
// objects in the viewer's timezone. The druženje happens in Ljubljana, so
// "Danes" has to mean today *there* even if someone opens this from abroad --
// and calendar-date strings can't drift the way timestamps can.
const ljubljanaParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayIso() {
  const parts = ljubljanaParts.formatToParts(new Date());
  const part = (type) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// Date maths is done at UTC midnight so Ljubljana's DST switch (where a local
// day is 23 or 25 hours long) can never add or drop a day.
export function utcFromIso(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(iso, n) {
  const dt = utcFromIso(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function dayNumber(iso) {
  return Number(iso.slice(8, 10));
}

export function monthNumber(iso) {
  return Number(iso.slice(5, 7));
}

const WEEKDAY_NAMES = ["ned", "pon", "tor", "sre", "čet", "pet", "sob"];

export function weekdayAbbrev(iso) {
  return WEEKDAY_NAMES[utcFromIso(iso).getUTCDay()];
}

export function dayLabel(iso, today) {
  if (iso === today) return "Danes";
  if (iso === addDays(today, 1)) return "Jutri";
  return weekdayAbbrev(iso);
}

// "ned. 12.2" -- short weekday + day.month, no leading zeros. Used on the
// recent-events cards where the day-list's own "Danes"/"Jutri" framing
// (dayLabel) would be ambiguous once cards from several different days sit
// side by side.
export function shortDateLabel(iso) {
  return `${weekdayAbbrev(iso)}. ${dayNumber(iso)}.${monthNumber(iso)}`;
}

export function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// The full "Ime Priimek" string is the identity, so it gets normalised on the
// way in: without this, "tina brdnik" and "Tina Brdnik" would become two
// different people with two separate sets of entries.
export function normalizeName(first, last) {
  const clean = (s) => (s || "").trim().replace(/\s+/g, " ");
  return `${capitalize(clean(first))} ${capitalize(clean(last))}`.trim();
}

export function splitName(full) {
  const parts = (full || "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") };
}

export function hasSurname(full) {
  return (full || "").trim().split(/\s+/).filter(Boolean).length >= 2;
}

// Keys look like "avail:2026-08-20:Ime Priimek"; everything past the second
// colon is the person, so names containing a colon survive the round trip.
export function personFromKey(key) {
  const parts = key.split(":");
  return parts.length >= 3 ? parts.slice(2).join(":") : null;
}

export function isoFromKey(key) {
  return key.split(":")[1] || null;
}

export function blankHours() {
  return Array(24).fill(null);
}

// Encode hours array -> compact 24-char string: 'f' free, 'b' busy, '.' unset
export function encodeHours(hours) {
  return hours.map((h) => (h === "free" ? "f" : h === "busy" ? "b" : ".")).join("");
}

// Decode storage value -> 24-length hours array. Handles the current
// 24-char format plus a couple of older formats for backward compatibility.
export function decodeHours(raw) {
  if (!raw) return blankHours();
  if (raw.length === 24 && /^[fb.]+$/.test(raw)) {
    return raw.split("").map((c) => (c === "f" ? "free" : c === "b" ? "busy" : null));
  }
  if (raw === "free") return Array(24).fill("free");
  if (raw === "busy") return Array(24).fill("busy");
  try {
    const parsed = JSON.parse(raw);
    const hours = blankHours();
    if (parsed?.type === "free") return Array(24).fill("free");
    if (parsed?.type === "busy") return Array(24).fill("busy");
    if (parsed?.type === "window") {
      const from = parseInt(parsed.from, 10);
      const to = parseInt(parsed.to, 10);
      for (let h = from; h < to && h < 24; h++) hours[h] = parsed.mode;
    }
    return hours;
  } catch (e) {
    return blankHours();
  }
}

// Encode { hours, note } -> storage string: hours, plus an optional
// '|'-separated, URI-encoded note (so raw '|' or newlines in the note
// can't break parsing).
export function encodeEntry(entry) {
  const hoursPart = encodeHours(entry.hours);
  const note = (entry.note || "").trim();
  return note ? `${hoursPart}|${encodeURIComponent(note)}` : hoursPart;
}

export function decodeEntry(raw) {
  if (!raw) return { hours: blankHours(), note: "" };
  const sep = raw.indexOf("|");
  if (sep === -1) return { hours: decodeHours(raw), note: "" };
  let note = "";
  try {
    note = decodeURIComponent(raw.slice(sep + 1));
  } catch (e) {
    note = "";
  }
  return { hours: decodeHours(raw.slice(0, sep)), note };
}

// The Supabase RLS policies (see supabase-schema.sql) only grant access to
// keys matching "avail:%", so a day's group events piggyback on that same
// prefix using a reserved "person" segment that can never collide with a
// real "Ime Priimek" identity (real names always contain a space). A day
// can have several events, so the marker carries a per-event id suffix
// (a creation timestamp, which also gives events their display order).
const EVENT_MARKER = "__event__";

export function eventKey(iso, id) {
  return `avail:${iso}:${EVENT_MARKER}${id}`;
}

export function encodeEvent(ev) {
  return JSON.stringify(ev);
}

export function decodeEvent(raw, id) {
  try {
    const parsed = JSON.parse(raw);
    return {
      id,
      title: parsed.title || "",
      description: parsed.description || "",
      keyword: parsed.keyword || "",
      duration: parsed.duration || "",
      createdBy: parsed.createdBy || "",
      attendees: Array.isArray(parsed.attendees) ? parsed.attendees : [],
    };
  } catch (e) {
    return null;
  }
}

// duration is stored as a single "HH:MM–HH:MM" display string; split it back
// into the two <input type="time"> values when re-opening the edit form.
// Accepts a plain hyphen too, since some events were saved before the en
// dash format was standardized.
export function splitDuration(duration) {
  if (!duration) return { start: "", end: "" };
  const [start, end] = duration.split(/\s*[–-]\s*/);
  return { start: (start || "").trim(), end: (end || "").trim() };
}

// Short inline summary shown next to a person's name, e.g. "danes prost".
export function quickStatusText(hours, dayLabelText) {
  const anySet = hours.some((h) => h !== null);
  if (!anySet) return null;
  const allFree = hours.every((h) => h === "free");
  const allBusy = hours.every((h) => h === "busy");
  const prefix = dayLabelText.toLowerCase();
  if (allFree) return `${prefix} prost`;
  if (allBusy) return `${prefix} zaseden`;
  return `${prefix} delno zaseden`;
}

// Three-tier day status for a person's avatar circle: green only if every
// hour is free, red only if every hour is explicitly busy (e.g. "Zaseden
// cel dan"), orange for anything in between -- partial, mixed, or nothing
// set at all. Red is reserved for an explicit whole-day busy mark so it
// isn't confused with "hasn't really said yet."
export function freeBusyTier(hours) {
  if (hours.every((h) => h === "free")) return "free";
  if (hours.every((h) => h === "busy")) return "busy";
  return "partial";
}

export function tierColor(tier) {
  return tier === "free" ? GREEN : tier === "busy" ? RED : ORANGE;
}

// Accent hues for the "recent events" cards, as bare "r, g, b" triplets so
// the same hue can drive the background tint, border, and shadow at
// different alphas (see styles.recentEventCard) -- translucent so they read
// as pastel over the light theme and moodier over the dark one, without
// needing separate light/dark palettes.
const RECENT_CARD_HUES = [
  "59, 130, 246",
  "168, 85, 247",
  "236, 72, 153",
  "249, 115, 22",
  "20, 184, 166",
  "234, 179, 8",
];

// Deterministic (not re-randomized every render) so a given event keeps the
// same color across re-renders/refreshes.
export function colorForEvent(ev) {
  const s = ev.title || ev.id || "";
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return RECENT_CARD_HUES[hash % RECENT_CARD_HUES.length];
}

export function dominantStatus(hours) {
  let free = 0;
  let busy = 0;
  hours.forEach((h) => {
    if (h === "free") free++;
    if (h === "busy") busy++;
  });
  if (free === 0 && busy === 0) return null;
  return free >= busy ? "free" : "busy";
}

// Turn an hours array into readable contiguous ranges, e.g.
// [null,null,'busy','busy',...] -> [{ from: 2, to: 4, status: 'busy' }, ...]
export function groupSegments(hours) {
  const segments = [];
  let i = 0;
  while (i < 24) {
    const status = hours[i];
    if (status) {
      let j = i;
      while (j < 24 && hours[j] === status) j++;
      segments.push({ from: i, to: j, status });
      i = j;
    } else {
      i++;
    }
  }
  return segments;
}

export function fmtHour(h) {
  return `${String(h % 24).padStart(2, "0")}:00`;
}

export function entryCountLabel(n) {
  if (n === 0) return "Še nihče ni vnesel";
  if (n === 1) return "1 vnos";
  if (n >= 2 && n <= 4) return `${n} vnosi`;
  return `${n} vnosov`;
}

function useIsDesktop(breakpoint = 860) {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= breakpoint : false
  );
  useEffect(() => {
    function onResize() {
      setIsDesktop(window.innerWidth >= breakpoint);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isDesktop;
}

// Auto-advancing "Aktualni dogodki" strip: shows 3 cards, and every 5s slides
// one card-width left to reveal the next event, wrapping back to the start.
// The wrap is seamless: a copy of the first 3 events is appended after the
// real list, so the slide *into* that copy looks identical to sliding into
// the real first 3 -- once that copy is fully in view, the offset snaps back
// to 0 with the transition briefly disabled, which is visually a no-op.
function RecentEventsCarousel({ events }) {
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    if (events.length <= 3) return;
    const timer = setInterval(() => setOffset((o) => o + 1), 5000);
    return () => clearInterval(timer);
  }, [events.length]);

  useEffect(() => {
    if (offset < events.length) return;
    const t = setTimeout(() => {
      setAnimate(false);
      setOffset(0);
    }, 520); // just past the 500ms slide transition
    return () => clearTimeout(t);
  }, [offset, events.length]);

  useEffect(() => {
    if (animate) return;
    const raf = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  if (events.length === 0) return null;

  const extended = events.length > 3 ? events.concat(events.slice(0, 3)) : events;
  const slotPercent = 100 / extended.length;

  return (
    <>
      <div style={styles.recentEventsHeading}>Aktualni dogodki</div>
      <div style={styles.recentEventsViewport}>
        <div style={styles.recentEventsTrack(extended.length, offset, animate)}>
          {extended.map((ev, i) => (
            <div key={`${ev.id}-${i}`} style={styles.recentEventSlot(slotPercent)}>
              <div style={styles.recentEventCard(colorForEvent(ev))}>
                <div style={styles.recentEventTitle(Boolean(ev.keyword))}>{ev.title}</div>
                <div style={styles.recentEventDate}>{shortDateLabel(ev._iso)}</div>
                {ev.duration && (
                  <div style={styles.recentEventTime}>{splitDuration(ev.duration).start}</div>
                )}
                {ev.keyword && <div style={styles.recentEventKeyword}>{ev.keyword}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(null);
  const [firstDraft, setFirstDraft] = useState("");
  const [lastDraft, setLastDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [needsSurname, setNeedsSurname] = useState(false);
  const [duplicateName, setDuplicateName] = useState(null);
  const [checkingName, setCheckingName] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [pinDraft, setPinDraft] = useState("");
  const [authError, setAuthError] = useState(false);
  const [days, setDays] = useState([]);
  const [dayData, setDayData] = useState({}); // { iso: { name: { hours, note } } }
  const [openDay, setOpenDay] = useState(null);
  const [myHours, setMyHours] = useState(blankHours());
  const [myNote, setMyNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [paintMode, setPaintMode] = useState("busy");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingDay, setEditingDay] = useState(null); // iso of the day currently being edited, or null
  const [editingPerson, setEditingPerson] = useState(null); // whose entry editingDay refers to (admin can edit anyone's)
  const [viewPerson, setViewPerson] = useState(null); // { name, hours, iso, dateText }
  const [theme, setTheme] = useState("light");
  const [showSettings, setShowSettings] = useState(false);
  const [dayEvents, setDayEvents] = useState({}); // { iso: [{ id, title, description, duration, createdBy, attendees }] }
  const [editingEvent, setEditingEvent] = useState(null); // { iso, id } of the open event form, id null means "new event"; or null
  const [eventTitleDraft, setEventTitleDraft] = useState("");
  const [eventDescDraft, setEventDescDraft] = useState("");
  const [showEventDescInput, setShowEventDescInput] = useState(false);
  const [eventKeywordDraft, setEventKeywordDraft] = useState("");
  const [eventStartDraft, setEventStartDraft] = useState("");
  const [eventEndDraft, setEventEndDraft] = useState("");

  const gridRef = useRef(null);
  const dragActionRef = useRef("set");
  const hasAutoOpenedRef = useRef(false);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    const start = todayIso();
    setDays(Array.from({ length: 14 }, (_, i) => addDays(start, i)));
  }, []);

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.textContent = THEME_CSS;
    document.head.appendChild(styleEl);
    return () => styleEl.remove();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("theme", false);
        if (res && (res.value === "light" || res.value === "dark")) {
          setTheme(res.value);
        }
      } catch (e) {
        console.info("No saved theme yet:", e?.message || e);
      }
    })();
  }, []);

  async function chooseTheme(next) {
    setTheme(next);
    try {
      await window.storage.set("theme", next, false);
    } catch (e) {
      console.error("theme save error:", e);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("my-name", false);
        if (res && res.value) {
          setName(res.value);
          // Names saved before surnames were required: keep the identity so
          // existing entries can be migrated, but ask for the surname first.
          if (!hasSurname(res.value)) {
            setFirstDraft(splitName(res.value).first);
            setNeedsSurname(true);
          }
        }
      } catch (e) {
        console.info("No saved name yet:", e?.message || e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadAllData = useCallback(async () => {
    if (days.length === 0) return;
    setRefreshing(true);
    try {
      // One bounded query for the whole visible window. The upper bound is the
      // day after the last shown day, so it stops before that day's entries
      // ("avail:2026-09-03" sorts above "avail:2026-09-02:Ime").
      const fromKey = `avail:${days[0]}`;
      const toKey = `avail:${addDays(days[days.length - 1], 1)}`;
      const res = await window.storage.range(fromKey, toKey, true);
      const result = {};
      const events = {};
      for (const iso of days) {
        result[iso] = {};
        events[iso] = [];
      }
      for (const row of (res && res.rows) || []) {
        const iso = isoFromKey(row.key);
        const person = personFromKey(row.key);
        if (!person || !(iso in result)) continue;
        if (person.startsWith(EVENT_MARKER)) {
          const id = person.slice(EVENT_MARKER.length);
          const ev = decodeEvent(row.value, id);
          if (ev) events[iso].push(ev);
          continue;
        }
        result[iso][person] = decodeEntry(row.value);
      }
      for (const iso of days) {
        events[iso].sort((a, b) => Number(a.id) - Number(b.id));
      }
      setDayData(result);
      setDayEvents(events);
      setError(null);
    } catch (e) {
      setError("Podatkov ni bilo mogoče naložiti. Poskusi znova.");
    } finally {
      setRefreshing(false);
    }
  }, [days]);

  useEffect(() => {
    if (name && days.length) loadAllData();
  }, [name, days, loadAllData]);

  useEffect(() => {
    if (days.length && !hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true;
      setOpenDay(days[0]);
    }
  }, [days]);

  async function fetchExistingNames() {
    const res = await window.storage.list("avail:", true);
    const names = new Set();
    for (const k of (res && res.keys) || []) {
      const person = personFromKey(k);
      if (person) names.add(person);
    }
    return names;
  }

  // The name *is* the identity, so a rename has to carry existing entries
  // across or they'd be stranded under the old name, visible to everyone but
  // editable by no one. Keys are re-read from storage rather than taken from
  // dayData, so this stays correct even if the initial load hasn't landed yet.
  async function migrateEntries(from, to) {
    try {
      const res = await window.storage.list("avail:", true);
      const keys = ((res && res.keys) || []).filter(
        (k) => personFromKey(k) === from
      );
      for (const key of keys) {
        const got = await window.storage.get(key, true);
        if (!got || !got.value) continue;
        await window.storage.set(`avail:${isoFromKey(key)}:${to}`, got.value, true);
        await window.storage.delete(key, true);
      }
      if (keys.length) await loadAllData();
    } catch (e) {
      setError("Vnosov ni bilo mogoče prenesti na novo ime. Poskusi znova.");
    }
  }

  async function commitName(full) {
    const previous = name;
    setName(full);
    setDuplicateName(null);
    setNeedsSurname(false);
    setEditingName(false);
    setError(null);
    try {
      await window.storage.set("my-name", full, false);
    } catch (e) {
      console.error("saveName storage error:", e);
      setError("Ime se ni shranilo za naslednjič (a lahko nadaljuješ zdaj).");
    }
    if (previous && previous !== full) await migrateEntries(previous, full);
  }

  function toggleEditingName() {
    if (editingName) {
      // Second click on the same icon closes the form, same as "Prekliči".
      setDuplicateName(null);
      setEditingName(false);
      return;
    }
    const parts = splitName(name);
    setFirstDraft(parts.first);
    setLastDraft(parts.last);
    setDuplicateName(null);
    setEditingName(true);
  }

  // "my-name" lives in local (per-device) storage, not the shared table, so
  // logging out only forgets identity on this browser -- the person's
  // existing entries and events stay in the shared calendar under their name
  // for when they (or someone else) log back in as them.
  async function logout() {
    setName(null);
    setEditingName(false);
    setDuplicateName(null);
    setNeedsSurname(false);
    setFirstDraft("");
    setLastDraft("");
    try {
      await window.storage.delete("my-name", false);
    } catch (e) {
      console.error("logout storage error:", e);
    }
  }

  async function submitName(first, last) {
    const full = normalizeName(first, last);
    if (!hasSurname(full)) return;
    setCheckingName(true);
    try {
      const existing = await fetchExistingNames();
      const clash = [...existing].find(
        (n) => n.toLowerCase() === full.toLowerCase() && n !== name
      );
      if (clash) {
        setDuplicateName(clash);
        return;
      }
    } catch (e) {
      // If the lookup fails, let them in rather than blocking on a check that
      // is only a safety net -- surnames already make clashes unlikely.
      console.info("Name check failed, continuing:", e?.message || e);
    } finally {
      setCheckingName(false);
    }
    await commitName(full);
  }

  function verifyPassword() {
    if (pinDraft === AUTH_CODE) {
      setAuthenticated(true);
      setAuthError(false);
    } else {
      setAuthError(true);
      setPinDraft("");
    }
  }

  async function persistEntry(iso, entry, personName = name) {
    if (!personName) return;
    const key = `avail:${iso}:${personName}`;
    const note = (entry.note || "").trim();
    const isBlank = entry.hours.every((h) => h === null) && note === "";
    setDayData((prev) => {
      const dayEntries = { ...(prev[iso] || {}) };
      if (isBlank) {
        delete dayEntries[personName];
      } else {
        dayEntries[personName] = { hours: entry.hours, note };
      }
      return { ...prev, [iso]: dayEntries };
    });
    try {
      if (isBlank) {
        await window.storage.delete(key, true);
      } else {
        await window.storage.set(key, encodeEntry({ hours: entry.hours, note }), true);
      }
    } catch (e) {
      setError("Spremembe ni bilo mogoče shraniti. Poskusi znova.");
      loadAllData();
    }
  }

  function openDayCard(iso) {
    const opening = openDay !== iso;
    setOpenDay(opening ? iso : null);
    setEditingDay(null);
    setEditingPerson(null);
    setSaved(false);
  }

  function selectDay(iso) {
    setOpenDay(iso);
    setEditingDay(null);
    setEditingPerson(null);
    setSaved(false);
  }

  // Admin can edit anyone's entry, so the person being edited (editingPerson)
  // is tracked separately from the logged-in name -- defaults to your own.
  function startEditing(iso, personName = name) {
    const existing = dayData[iso]?.[personName];
    setMyHours(existing ? [...existing.hours] : blankHours());
    setMyNote(existing?.note || "");
    setShowNoteInput(!!existing?.note);
    setEditingDay(iso);
    setEditingPerson(personName);
    setSaved(false);
  }

  function paintCell(idx, action) {
    setMyHours((prev) => {
      const copy = [...prev];
      copy[idx] = action === "clear" ? null : paintMode;
      return copy;
    });
  }

  function handlePointerDown(e, idx) {
    e.preventDefault();
    const current = myHours[idx];
    const action = current === paintMode ? "clear" : "set";
    dragActionRef.current = action;
    setDragging(true);
    paintCell(idx, action);
    try {
      gridRef.current?.setPointerCapture(e.pointerId);
    } catch (err) {
      // pointer capture not supported — drag-select just won't work, taps still will
    }
  }

  function handlePointerMove(e) {
    if (!dragging) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const hourAttr = el?.closest("[data-hour]")?.getAttribute("data-hour");
    if (hourAttr == null) return;
    paintCell(parseInt(hourAttr, 10), dragActionRef.current);
  }

  function handlePointerUp() {
    if (!dragging) return;
    setDragging(false);
  }

  async function saveMySchedule(iso) {
    await persistEntry(iso, { hours: myHours, note: myNote }, editingPerson || name);
    setEditingDay(null);
    setEditingPerson(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function clearDraft() {
    setMyHours(blankHours());
  }

  function fillWholeDay(status) {
    setMyHours(Array(24).fill(status));
  }

  async function deleteMySchedule(iso) {
    await persistEntry(iso, { hours: blankHours(), note: "" }, editingPerson || name);
    setMyHours(blankHours());
    setMyNote("");
    setShowNoteInput(false);
    setEditingDay(null);
    setEditingPerson(null);
    setSaved(false);
  }

  // id === null means "new event" -- the form starts blank instead of
  // loading an existing one. Checked with != null rather than truthiness:
  // events created before per-day ids existed have id === "" (a legacy
  // empty-suffix storage key), which is a valid id, not "no id".
  function startEditingEvent(iso, id = null) {
    const existing = id != null ? dayEvents[iso]?.find((e) => e.id === id) : null;
    setEventTitleDraft(existing?.title || "");
    setEventDescDraft(existing?.description || "");
    setShowEventDescInput(!!existing?.description);
    setEventKeywordDraft(existing?.keyword || "");
    const { start, end } = splitDuration(existing?.duration || "");
    setEventStartDraft(start);
    setEventEndDraft(end);
    setEditingEvent({ iso, id });
  }

  function cancelEditingEvent() {
    setEditingEvent(null);
    setEventTitleDraft("");
    setEventDescDraft("");
    setShowEventDescInput(false);
    setEventKeywordDraft("");
    setEventStartDraft("");
    setEventEndDraft("");
  }

  async function saveEvent(iso, id) {
    const title = eventTitleDraft.trim();
    if (!title || !name) return;
    const existing = id != null ? dayEvents[iso]?.find((e) => e.id === id) : null;
    const eventId = id != null ? id : String(Date.now());
    const duration =
      eventStartDraft && eventEndDraft
        ? `${eventStartDraft}–${eventEndDraft}`
        : eventStartDraft || eventEndDraft || "";
    const event = {
      id: eventId,
      title,
      description: eventDescDraft.trim(),
      keyword: eventKeywordDraft.trim(),
      duration,
      createdBy: existing?.createdBy || name,
      attendees: existing?.attendees || [],
    };
    setDayEvents((prev) => {
      const list = prev[iso] || [];
      const next = existing
        ? list.map((e) => (e.id === eventId ? event : e))
        : [...list, event];
      return { ...prev, [iso]: next };
    });
    setEditingEvent(null);
    try {
      await window.storage.set(eventKey(iso, eventId), encodeEvent(event), true);
    } catch (e) {
      setError("Dogodka ni bilo mogoče shraniti. Poskusi znova.");
      loadAllData();
    }
  }

  async function deleteEvent(iso, id) {
    setDayEvents((prev) => ({
      ...prev,
      [iso]: (prev[iso] || []).filter((e) => e.id !== id),
    }));
    setEditingEvent(null);
    try {
      await window.storage.delete(eventKey(iso, id), true);
    } catch (e) {
      setError("Dogodka ni bilo mogoče izbrisati. Poskusi znova.");
      loadAllData();
    }
  }

  async function toggleAttendance(iso, id) {
    const existing = dayEvents[iso]?.find((e) => e.id === id);
    if (!existing || !name) return;
    const attending = existing.attendees.includes(name);
    const nextEvent = {
      ...existing,
      attendees: attending
        ? existing.attendees.filter((n) => n !== name)
        : [...existing.attendees, name],
    };
    setDayEvents((prev) => ({
      ...prev,
      [iso]: (prev[iso] || []).map((e) => (e.id === id ? nextEvent : e)),
    }));
    try {
      await window.storage.set(eventKey(iso, id), encodeEvent(nextEvent), true);
    } catch (e) {
      setError("Ni bilo mogoče shraniti udeležbe. Poskusi znova.");
      loadAllData();
    }
  }

  if (loading) {
    return (
      <div style={styles.centerScreen}>
        <div style={styles.loadingDot} />
      </div>
    );
  }

  if (!name || needsSurname) {
    const draftReady = firstDraft.trim() && lastDraft.trim();
    return (
      <div style={styles.centerScreen}>
        <div style={styles.introCard}>
          <div style={styles.introEyebrow}>Garaža Klub Koledar</div>
          <h1 style={styles.introTitle}>
            {needsSurname ? "Še priimek" : "Kdaj imaš čas?"}
          </h1>
          <p style={styles.introText}>
            {needsSurname
              ? "Dodaj še svoj priimek, da te ne zamenjamo z nekom z istim imenom."
              : "Vpiši ime in priimek, da lahko prijatelji vidijo, kdaj si prost za druženje."}
          </p>
          {error && <div style={styles.errorBannerIntro}>{error}</div>}

          {duplicateName ? (
            <>
              <div style={styles.errorBannerIntro}>
                «{duplicateName}» je že v koledarju.
              </div>
              <button
                style={styles.primaryButton}
                onClick={() => commitName(duplicateName)}
              >
                To sem jaz
                <ChevronRight size={18} />
              </button>
              <button
                style={styles.introSecondaryButton}
                onClick={() => setDuplicateName(null)}
              >
                Nekdo drug sem
              </button>
            </>
          ) : (
            <>
              <input
                autoFocus={!needsSurname}
                style={styles.input}
                placeholder="Ime"
                value={firstDraft}
                onChange={(e) => setFirstDraft(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && submitName(firstDraft, lastDraft)
                }
              />
              <input
                autoFocus={needsSurname}
                style={styles.input}
                placeholder="Priimek"
                value={lastDraft}
                onChange={(e) => setLastDraft(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && submitName(firstDraft, lastDraft)
                }
              />
              <button
                style={{
                  ...styles.primaryButton,
                  opacity: draftReady && !checkingName ? 1 : 0.5,
                }}
                disabled={!draftReady || checkingName}
                onClick={() => submitName(firstDraft, lastDraft)}
              >
                {checkingName ? "Preverjam …" : "Vstopi"}
                {!checkingName && <ChevronRight size={18} />}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // TEMP: auth gate disabled for testing -- uncomment this whole block to
  // restore the PIN prompt.
  /*
  if (!authenticated) {
    return (
      <div style={styles.centerScreen}>
        <div style={styles.introCard}>
          <div style={styles.introEyebrow}>Garaža Klub Koledar</div>
          <h1 style={styles.introTitle}>Avtentikacija</h1>
          <p style={styles.introText}>Če si pravi bitnčan vnesi geslo.</p>
          {authError && (
            <div style={styles.errorBannerIntro}>
              Napačno geslo. Poskusi znova.
            </div>
          )}
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            style={styles.input}
            placeholder="Geslo"
            value={pinDraft}
            onChange={(e) =>
              setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            onKeyDown={(e) => e.key === "Enter" && verifyPassword()}
          />
          <button
            style={{
              ...styles.primaryButton,
              opacity: pinDraft.length === 6 ? 1 : 0.5,
            }}
            disabled={pinDraft.length !== 6}
            onClick={verifyPassword}
          >
            Potrdi
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  }
  */

  const today = days[0];
  const isAdmin = name?.trim().toLowerCase() === ADMIN_NAME;

  // Most-recently-created event first (leftmost), across all visible days.
  const recentEvents = Object.entries(dayEvents)
    .flatMap(([iso, events]) => events.map((ev) => ({ ...ev, _iso: iso })))
    .sort((a, b) => Number(b.id) - Number(a.id));

  const recentEventsRow = <RecentEventsCarousel events={recentEvents} />;

  const avatarButton = (
    <button
      style={styles.avatarButton}
      onClick={toggleEditingName}
      aria-label="Uredi ime"
    >
      {initials(name)}
      <Pencil size={11} style={styles.pencilBadge} />
    </button>
  );

  const nameEditRow = editingName && (
    <div style={styles.editNameRow}>
      <div style={styles.editNameInputs}>
        <input
          autoFocus
          style={styles.inputSmall}
          placeholder="Ime"
          value={firstDraft}
          onChange={(e) => setFirstDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitName(firstDraft, lastDraft)}
        />
        <input
          style={styles.inputSmall}
          placeholder="Priimek"
          value={lastDraft}
          onChange={(e) => setLastDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitName(firstDraft, lastDraft)}
        />
      </div>
      <div style={styles.editNameActions}>
        <div style={styles.editNameActionsLeft}>
          <button
            style={styles.smallButton}
            disabled={!firstDraft.trim() || !lastDraft.trim() || checkingName}
            onClick={() => submitName(firstDraft, lastDraft)}
          >
            Shrani
          </button>
          <button
            style={styles.smallButtonGhost}
            onClick={() => {
              setDuplicateName(null);
              setEditingName(false);
            }}
          >
            Prekliči
          </button>
        </div>
        <button style={styles.smallButtonDanger} onClick={logout}>
          Odjava
        </button>
      </div>
    </div>
  );

  // Renaming into a name someone else already uses would silently take over
  // their entries, so the same confirm step as the intro screen applies here.
  const nameClashRow = duplicateName && !needsSurname && (
    <div style={styles.clashRow}>
      <span style={styles.clashText}>«{duplicateName}» je že v koledarju.</span>
      <button
        style={styles.smallButton}
        onClick={() => commitName(duplicateName)}
      >
        To sem jaz
      </button>
      <button
        style={styles.smallButtonGhost}
        onClick={() => setDuplicateName(null)}
      >
        Nekdo drug sem
      </button>
    </div>
  );

  const viewPersonModal = viewPerson && (
    <div style={styles.modalOverlay} onClick={() => setViewPerson(null)}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalEyebrow}>{viewPerson.dateText}</div>
            <div style={styles.modalTitle}>{viewPerson.name}</div>
            {viewPerson.note && (
              <div style={styles.modalNote}>{viewPerson.note}</div>
            )}
          </div>
          <button style={styles.modalClose} onClick={() => setViewPerson(null)}>
            Zapri
          </button>
        </div>

        <div style={styles.modalTable}>
          {groupSegments(viewPerson.hours).length === 0 ? (
            <div style={styles.emptyNote}>Ni vnesenih ur.</div>
          ) : (
            groupSegments(viewPerson.hours).map((seg, i) => (
              <div key={i} style={styles.modalRow}>
                <span style={styles.modalTime}>
                  {fmtHour(seg.from)}–{fmtHour(seg.to)}
                </span>
                <span
                  style={{
                    ...styles.modalBadge,
                    color: seg.status === "free" ? GREEN : RED,
                    background: seg.status === "free" ? GREEN_BG : RED_BG,
                  }}
                >
                  {seg.status === "free" ? "Prost" : "Zaseden"}
                </span>
              </div>
            ))
          )}
        </div>

        <div style={styles.modalStrip}>
          {HOURS.map((hr) => {
            const state = viewPerson.hours[hr];
            const bg =
              state === "free" ? GREEN : state === "busy" ? RED : NEUTRAL_BG;
            return (
              <span key={hr} style={{ ...styles.modalStripCell, background: bg }} />
            );
          })}
        </div>
        <div style={styles.modalStripLabels}>
          <span>0h</span>
          <span>12h</span>
          <span>23h</span>
        </div>
      </div>
    </div>
  );

  const settingsButton = (
    <button style={styles.settingsButton} onClick={() => setShowSettings(true)}>
      <Settings size={14} /> Nastavitve
    </button>
  );

  const appFooterNote = (
    <p style={styles.appFooterNote}>
      Aplikacija je še v razvoju in testiranju. Hvala za razumevanje
    </p>
  );

  const settingsModal = showSettings && (
    <div style={styles.modalOverlay} onClick={() => setShowSettings(false)}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalEyebrow}>Nastavitve</div>
            <div style={styles.modalTitle}>Tema</div>
          </div>
          <button style={styles.modalClose} onClick={() => setShowSettings(false)}>
            Zapri
          </button>
        </div>
        <p style={styles.introText}>
          Izberi videz aplikacije. Izbira se shrani za naslednjič.
        </p>
        <div style={styles.modeRow}>
          <button
            style={styles.themeOptionButton(theme === "light")}
            onClick={() => chooseTheme("light")}
          >
            <Sun size={16} /> Svetla
          </button>
          <button
            style={styles.themeOptionButton(theme === "dark")}
            onClick={() => chooseTheme("dark")}
          >
            <Moon size={16} /> Temna
          </button>
        </div>
      </div>
    </div>
  );

  // Shared between the mobile and desktop day-detail views: the day's group
  // events (a day can have several, oldest first) plus whichever one is
  // being created or edited. Only an event's creator can edit or delete it;
  // anyone can add another event or toggle their own attendance.
  function renderEventSection(iso) {
    const events = dayEvents[iso] || [];
    const isEditingHere = editingEvent && editingEvent.iso === iso;

    function eventForm(id) {
      const existing = id != null ? events.find((e) => e.id === id) : null;
      return (
        <div style={styles.eventCard} key={id || "new"}>
          <div style={styles.eventEyebrow}>Dogodek</div>
          <input
            autoFocus
            style={styles.input}
            placeholder="Ime dogodka"
            value={eventTitleDraft}
            onChange={(e) => setEventTitleDraft(e.target.value)}
          />
          <div style={styles.eventTimeRow}>
            <input
              type="time"
              style={styles.inputSmall}
              aria-label="Začetek dogodka"
              value={eventStartDraft}
              onChange={(e) => setEventStartDraft(e.target.value)}
            />
            <span style={styles.eventTimeSep}>–</span>
            <input
              type="time"
              style={styles.inputSmall}
              aria-label="Konec dogodka"
              value={eventEndDraft}
              onChange={(e) => setEventEndDraft(e.target.value)}
            />
          </div>
          {showEventDescInput ? (
            <div style={styles.noteBlock}>
              <textarea
                style={styles.noteTextarea}
                rows={2}
                placeholder="Opis dogodka"
                value={eventDescDraft}
                onChange={(e) => setEventDescDraft(e.target.value)}
              />
              <button
                style={styles.noteRemoveButton}
                onClick={() => {
                  setEventDescDraft("");
                  setShowEventDescInput(false);
                }}
              >
                Odstrani opis
              </button>
            </div>
          ) : (
            <button
              style={styles.addNoteButton}
              onClick={() => setShowEventDescInput(true)}
            >
              <MessageSquare size={12} /> Dodaj opis
            </button>
          )}
          <input
            style={styles.input}
            placeholder="Ključna beseda"
            value={eventKeywordDraft}
            onChange={(e) => setEventKeywordDraft(e.target.value)}
          />
          <div style={styles.editActionsRow}>
            <button style={styles.cancelButton} onClick={cancelEditingEvent}>
              Prekliči
            </button>
            <button
              style={{
                ...styles.saveButton(false),
                opacity: eventTitleDraft.trim() ? 1 : 0.5,
              }}
              disabled={!eventTitleDraft.trim()}
              onClick={() => saveEvent(iso, id)}
            >
              Dodaj
            </button>
          </div>
          {existing && existing.createdBy === name && (
            <button
              style={styles.deleteButton}
              onClick={() => deleteEvent(iso, id)}
            >
              <Trash2 size={12} /> Izbriši dogodek
            </button>
          )}
        </div>
      );
    }

    const creatingNew = isEditingHere && editingEvent.id === null;

    return (
      <>
        {events.map((event) => {
          if (isEditingHere && editingEvent.id === event.id) {
            return eventForm(event.id);
          }
          const attending = !!name && event.attendees.includes(name);
          const canEdit = event.createdBy === name;
          return (
            <div style={styles.eventCard} key={event.id}>
              <div style={styles.eventHeaderRow}>
                <div>
                  <div style={styles.eventEyebrow}>
                    Dogodek{" "}
                    <span style={styles.eventEyebrowMeta}>
                      - od {event.createdBy}
                    </span>
                  </div>
                  <div style={styles.eventTitle}>{event.title}</div>
                  {event.duration && (
                    <div style={styles.eventDuration}>{event.duration}</div>
                  )}
                </div>
                <div style={styles.eventHeaderActions}>
                  {canEdit && (
                    <button
                      style={styles.editEntryButton}
                      onClick={() => startEditingEvent(iso, event.id)}
                      aria-label="Uredi dogodek"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  <button
                    style={styles.editEntryButton}
                    onClick={() => startEditingEvent(iso, null)}
                    aria-label="Dodaj nov dogodek"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>
              {event.description && (
                <p style={styles.eventDescription}>{event.description}</p>
              )}
              <button
                style={styles.attendButton(attending)}
                onClick={() => toggleAttendance(iso, event.id)}
              >
                {attending ? "Prideš ✓" : "Da"}
              </button>
              {event.attendees.length > 0 && (
                <div style={styles.eventAttendees}>
                  {event.attendees.map((n) => (
                    <span key={n} style={styles.avatarChip(GREEN)}>
                      {initials(n)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {creatingNew && eventForm(null)}
        {events.length === 0 && !creatingNew && (
          <button
            style={styles.addEventButton}
            onClick={() => startEditingEvent(iso, null)}
          >
            + Dodaj dogodek
          </button>
        )}
      </>
    );
  }

  if (isDesktop) {
    const iso = openDay || today || null;
    const selectedIso = days.includes(iso) ? iso : today;
    const entries = (iso && dayData[iso]) || {};
    const allEntries = Object.entries(entries).sort(([a], [b]) =>
      a === name ? -1 : b === name ? 1 : a.localeCompare(b)
    );
    const isEditing = editingDay === iso;

    return (
      <div style={styles.pageDesktop}>
        <div style={styles.desktopContainer}>
          <header style={styles.header}>
            <div>
              <div style={styles.eyebrow}>Garaža Klub Koledar</div>
              <h1 style={styles.headerTitle}>
                Živjo{" "}
                <span style={styles.headerAccent}>{capitalize(name.split(" ")[0])}</span>,
                kdaj maš cajt?
              </h1>
            </div>
            {avatarButton}
          </header>

          {recentEventsRow}

          {nameEditRow}
          {nameClashRow}

          {error && <div style={styles.errorBanner}>{error}</div>}

          {refreshing && (
            <div style={styles.legend}>
              <span style={styles.syncLabel}>sinhroniziram …</span>
            </div>
          )}

          <div style={styles.desktopLayout}>
            <div style={styles.dayGrid}>
              {days.map((d) => {
                const dIso = d;
                const dEntries = dayData[dIso] || {};
                const people = Object.entries(dEntries).filter(([n]) => n !== name);
                const freePeople = people.filter(([, e]) => dominantStatus(e.hours) === "free");
                const busyPeople = people.filter(([, e]) => dominantStatus(e.hours) === "busy");
                const isSelected = dIso === iso;
                const isToday = dIso === today;
                return (
                  <button
                    key={dIso}
                    style={styles.daySquare(isSelected, isToday)}
                    onClick={() => selectDay(dIso)}
                  >
                    <div style={styles.daySquareNum}>{dayNumber(d)}</div>
                    <div style={styles.daySquareLabel}>{dayLabel(d, today)}</div>
                    <div style={styles.daySquareDots}>
                      {freePeople.length > 0 && (
                        <span style={styles.miniDot(GREEN)} />
                      )}
                      {busyPeople.length > 0 && (
                        <span style={styles.miniDot(RED)} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={styles.detailPanel}>
              {selectedIso && (
                <div style={styles.detailHeaderRow}>
                  <div>
                    <div style={styles.detailDateNum}>{dayNumber(selectedIso)}</div>
                    <div style={styles.detailDateLabel}>
                      {dayLabel(selectedIso, today)}
                    </div>
                  </div>
                  {!isEditing && (
                    <button
                      style={styles.editEntryButtonLg}
                      onClick={() => startEditing(iso)}
                    >
                      <Pencil size={13} />
                      {entries[name] ? "Uredi vnos" : "Dodaj vnos"}
                    </button>
                  )}
                </div>
              )}

              {isEditing ? (
                <>
                  <div style={styles.gridHeaderRow}>
                    <div style={styles.sectionLabel}>
                      {editingPerson && editingPerson !== name
                        ? `Urnik – ${editingPerson}`
                        : "Tvoj urnik"}
                    </div>
                    <div style={styles.headerButtonGroup}>
                      <button style={styles.clearButton} onClick={clearDraft}>
                        <Eraser size={12} /> Počisti
                      </button>
                      {entries[editingPerson || name] && (
                        <button
                          style={styles.deleteButton}
                          onClick={() => deleteMySchedule(iso)}
                        >
                          <Trash2 size={12} /> Izbriši vnos
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={styles.modeRow}>
                    <button
                      style={styles.pillButton(false, GREEN, GREEN_BG)}
                      onClick={() => fillWholeDay("free")}
                    >
                      Prost cel dan
                    </button>
                    <button
                      style={styles.pillButton(false, RED, RED_BG)}
                      onClick={() => fillWholeDay("busy")}
                    >
                      Zaseden cel dan
                    </button>
                  </div>
                  <div style={styles.modeRow}>
                    <button
                      style={styles.pillButton(paintMode === "free", GREEN, GREEN_BG)}
                      onClick={() => setPaintMode("free")}
                    >
                      Označi kot prost
                    </button>
                    <button
                      style={styles.pillButton(paintMode === "busy", RED, RED_BG)}
                      onClick={() => setPaintMode("busy")}
                    >
                      Označi kot zaseden
                    </button>
                  </div>
                  <p style={styles.hint}>
                    Klikni ali povleci čez ure. Enak klik na že označeno uro jo
                    počisti.
                  </p>

                  {showNoteInput ? (
                    <div style={styles.noteBlock}>
                      <textarea
                        autoFocus
                        style={styles.noteTextarea}
                        rows={2}
                        maxLength={140}
                        placeholder='npr. "sem za druženje", "na jošta", "bi šel kdo na pivo ob 18ih"'
                        value={myNote}
                        onChange={(e) => setMyNote(e.target.value)}
                      />
                      <button
                        style={styles.noteRemoveButton}
                        onClick={() => {
                          setMyNote("");
                          setShowNoteInput(false);
                        }}
                      >
                        Odstrani opombo
                      </button>
                    </div>
                  ) : (
                    <button
                      style={styles.addNoteButton}
                      onClick={() => setShowNoteInput(true)}
                    >
                      <MessageSquare size={12} /> Dodaj opombo
                    </button>
                  )}

                  <div
                    ref={gridRef}
                    style={styles.hourGridDesktop}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                  >
                    {HOURS.map((h) => {
                      const state = myHours[h];
                      const bg =
                        state === "free" ? GREEN : state === "busy" ? RED : NEUTRAL_BG;
                      const text = state ? "#fff" : NEUTRAL_TEXT;
                      return (
                        <div
                          key={h}
                          data-hour={h}
                          onPointerDown={(e) => handlePointerDown(e, h)}
                          style={{
                            ...styles.hourCellDesktop,
                            background: bg,
                            color: text,
                          }}
                        >
                          {h}
                        </div>
                      );
                    })}
                  </div>

                  <div style={styles.editActionsRow}>
                    <button
                      style={styles.cancelButton}
                      onClick={() => {
                        setEditingDay(null);
                        setEditingPerson(null);
                      }}
                    >
                      Prekliči
                    </button>
                    <button
                      style={styles.saveButton(false)}
                      onClick={() => saveMySchedule(iso)}
                    >
                      Shrani
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {saved && <div style={styles.savedFlash}>Shranjeno ✓</div>}

                  {renderEventSection(iso)}

                  {allEntries.length === 0 ? (
                    <div style={styles.emptyState}>
                      <p style={styles.emptyStateText}>
                        Še nihče ni vnesel, kdaj ima čas.
                      </p>
                    </div>
                  ) : (
                    <div style={styles.peopleSection}>
                      <div style={styles.sectionLabel}>Vneseni vnosi</div>
                      {allEntries.map(([n, e]) => {
                        const quickStatus = selectedIso
                          ? quickStatusText(e.hours, dayLabel(selectedIso, today))
                          : null;
                        return (
                        <div key={n} style={styles.entryRowWrap}>
                          <button
                            style={styles.entryRow}
                            onClick={() =>
                              setViewPerson({
                                name: n,
                                hours: e.hours,
                                note: e.note,
                                dateText: selectedIso
                                  ? `${dayNumber(selectedIso)}. ${dayLabel(selectedIso, today)}`
                                  : "",
                              })
                            }
                          >
                            <span
                              style={{
                                ...styles.entryDot,
                                background: tierColor(freeBusyTier(e.hours)),
                              }}
                            />
                            <span style={styles.entryTextCol}>
                              <span style={styles.entryName}>
                                {n}
                                {n === name && (
                                  <span style={styles.entryYou}> (ti)</span>
                                )}
                                {quickStatus && (
                                  <span style={styles.entryQuickStatus}>
                                    {" "}
                                    - {quickStatus}
                                  </span>
                                )}
                              </span>
                              {e.note && (
                                <span style={styles.entryNoteText}>{e.note}</span>
                              )}
                            </span>
                            <ChevronRight size={15} color="var(--text-fainter)" />
                          </button>
                          {(n === name || isAdmin) && (
                            <button
                              style={styles.editEntryButton}
                              onClick={() => startEditing(iso, n)}
                              aria-label={`Uredi vnos – ${n}`}
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div style={styles.footer}>
            <Users size={13} color="var(--text-faint)" />
            <span>Koledar si delijo vsi, ki odprejo to povezavo</span>
          </div>
          {settingsButton}
          {appFooterNote}
        </div>

        {viewPersonModal}
        {settingsModal}
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Garaža Klub Koledar</div>
          <h1 style={styles.headerTitle}>
            Živjo <span style={styles.headerAccent}>{capitalize(name.split(" ")[0])}</span>,
            kdaj maš cajt?
          </h1>
        </div>
        {avatarButton}
      </header>

      {recentEventsRow}

      {nameEditRow}
      {nameClashRow}

      {error && <div style={styles.errorBanner}>{error}</div>}

      {refreshing && (
        <div style={styles.legend}>
          <span style={styles.syncLabel}>sinhroniziram …</span>
        </div>
      )}

      <div style={styles.list}>
        {days.map((d) => {
          const iso = d;
          const entries = dayData[iso] || {};
          const myEntry = entries[name];
          const others = Object.entries(entries).filter(([n]) => n !== name);
          const allEntries = Object.entries(entries).sort(([a], [b]) =>
            a === name ? -1 : b === name ? 1 : a.localeCompare(b)
          );
          const freeOthers = others.filter(([, e]) => freeBusyTier(e.hours) === "free");
          const partialOthers = others.filter(([, e]) => freeBusyTier(e.hours) === "partial");
          const busyOthers = others.filter(([, e]) => freeBusyTier(e.hours) === "busy");
          const isOpen = openDay === iso;
          const isToday = iso === today;

          return (
            <div key={iso} style={styles.dayCard(isToday, isOpen)}>
              <button style={styles.dayHeader} onClick={() => openDayCard(iso)}>
                <div style={styles.dayDateBlock}>
                  <div style={styles.dayNum}>{dayNumber(d)}</div>
                  <div style={styles.dayName}>{dayLabel(d, today)}</div>
                </div>
                <div style={styles.dayPeople}>
                  {allEntries.length === 0 && !(dayEvents[iso]?.length > 0) ? (
                    <span style={styles.noOne}>
                      {entryCountLabel(allEntries.length)}
                    </span>
                  ) : (
                    <>
                      {myEntry && (
                        <span
                          style={styles.avatarChip(
                            tierColor(freeBusyTier(myEntry.hours))
                          )}
                        >
                          {initials(name)}
                        </span>
                      )}
                      {freeOthers.slice(0, 5).map(([n]) => (
                        <span key={n} style={styles.avatarChip(GREEN)}>
                          {initials(n)}
                        </span>
                      ))}
                      {partialOthers.slice(0, 4).map(([n]) => (
                        <span key={n} style={styles.avatarChip(ORANGE)}>
                          {initials(n)}
                        </span>
                      ))}
                      {busyOthers.slice(0, 3).map(([n]) => (
                        <span key={n} style={styles.avatarChip(RED)}>
                          {initials(n)}
                        </span>
                      ))}
                      {dayEvents[iso]?.length > 0 && (
                        <span style={styles.eventBadge}>Dogodek</span>
                      )}
                    </>
                  )}
                </div>
                <ChevronRight
                  size={18}
                  color="var(--text-faint)"
                  style={{
                    transform: isOpen ? "rotate(90deg)" : "none",
                    transition: "transform 150ms ease",
                    flexShrink: 0,
                  }}
                />
              </button>

              {isOpen && (
                <div style={styles.dayDetail}>
                  {editingDay === iso ? (
                    <>
                      <div style={styles.gridHeaderRow}>
                        <div style={styles.sectionLabel}>
                          {editingPerson && editingPerson !== name
                            ? `Urnik – ${editingPerson}`
                            : "Tvoj urnik"}
                        </div>
                        <div style={styles.headerButtonGroup}>
                          <button style={styles.clearButton} onClick={clearDraft}>
                            <Eraser size={12} /> Počisti
                          </button>
                          {entries[editingPerson || name] && (
                            <button
                              style={styles.deleteButton}
                              onClick={() => deleteMySchedule(iso)}
                            >
                              <Trash2 size={12} /> Izbriši vnos
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={styles.modeRow}>
                        <button
                          style={styles.pillButton(false, GREEN, GREEN_BG)}
                          onClick={() => fillWholeDay("free")}
                        >
                          Prost cel dan
                        </button>
                        <button
                          style={styles.pillButton(false, RED, RED_BG)}
                          onClick={() => fillWholeDay("busy")}
                        >
                          Zaseden cel dan
                        </button>
                      </div>
                      <div style={styles.modeRow}>
                        <button
                          style={styles.pillButton(paintMode === "free", GREEN, GREEN_BG)}
                          onClick={() => setPaintMode("free")}
                        >
                          Označi kot prost
                        </button>
                        <button
                          style={styles.pillButton(paintMode === "busy", RED, RED_BG)}
                          onClick={() => setPaintMode("busy")}
                        >
                          Označi kot zaseden
                        </button>
                      </div>
                      <p style={styles.hint}>
                        Klikni ali povleci čez ure. Enak klik na že označeno uro
                        jo počisti.
                      </p>

                      {showNoteInput ? (
                        <div style={styles.noteBlock}>
                          <textarea
                            autoFocus
                            style={styles.noteTextarea}
                            rows={2}
                            maxLength={140}
                            placeholder='npr. "sem za druženje", "na jošta", "bi šel kdo na pivo ob 18ih"'
                            value={myNote}
                            onChange={(e) => setMyNote(e.target.value)}
                          />
                          <button
                            style={styles.noteRemoveButton}
                            onClick={() => {
                              setMyNote("");
                              setShowNoteInput(false);
                            }}
                          >
                            Odstrani opombo
                          </button>
                        </div>
                      ) : (
                        <button
                          style={styles.addNoteButton}
                          onClick={() => setShowNoteInput(true)}
                        >
                          <MessageSquare size={12} /> Dodaj opombo
                        </button>
                      )}

                      <div
                        ref={gridRef}
                        style={styles.hourGrid}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                      >
                        {HOURS.map((h) => {
                          const state = myHours[h];
                          const bg =
                            state === "free" ? GREEN : state === "busy" ? RED : NEUTRAL_BG;
                          const text = state ? "#fff" : NEUTRAL_TEXT;
                          return (
                            <div
                              key={h}
                              data-hour={h}
                              onPointerDown={(e) => handlePointerDown(e, h)}
                              style={{
                                ...styles.hourCell,
                                background: bg,
                                color: text,
                              }}
                            >
                              {h}
                            </div>
                          );
                        })}
                      </div>

                      <div style={styles.editActionsRow}>
                        <button
                          style={styles.cancelButton}
                          onClick={() => {
                        setEditingDay(null);
                        setEditingPerson(null);
                      }}
                        >
                          Prekliči
                        </button>
                        <button
                          style={styles.saveButton(false)}
                          onClick={() => saveMySchedule(iso)}
                        >
                          Shrani
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {saved && (
                        <div style={styles.savedFlash}>Shranjeno ✓</div>
                      )}

                      {renderEventSection(iso)}

                      {allEntries.length === 0 ? (
                        <div style={styles.emptyState}>
                          <p style={styles.emptyStateText}>
                            Še nihče ni vnesel, kdaj ima čas.
                          </p>
                          <button
                            style={styles.addButton}
                            onClick={() => startEditing(iso)}
                          >
                            Dodaj vnos
                          </button>
                        </div>
                      ) : (
                        <div style={styles.peopleSection}>
                          <div style={styles.sectionLabel}>Vneseni vnosi</div>
                          {allEntries.map(([n, e]) => {
                            const quickStatus = quickStatusText(
                              e.hours,
                              dayLabel(d, today)
                            );
                            return (
                            <div key={n} style={styles.entryRowWrap}>
                              <button
                                style={styles.entryRow}
                                onClick={() =>
                                  setViewPerson({
                                    name: n,
                                    hours: e.hours,
                                    note: e.note,
                                    dateText: `${dayNumber(d)}. ${dayLabel(d, today)}`,
                                  })
                                }
                              >
                                <span
                                  style={{
                                    ...styles.entryDot,
                                    background: tierColor(freeBusyTier(e.hours)),
                                  }}
                                />
                                <span style={styles.entryTextCol}>
                                  <span style={styles.entryName}>
                                    {n}
                                    {n === name && (
                                      <span style={styles.entryYou}> (ti)</span>
                                    )}
                                    {quickStatus && (
                                      <span style={styles.entryQuickStatus}>
                                        {" "}
                                        - {quickStatus}
                                      </span>
                                    )}
                                  </span>
                                  {e.note && (
                                    <span style={styles.entryNoteText}>{e.note}</span>
                                  )}
                                </span>
                                <ChevronRight size={15} color="var(--text-fainter)" />
                              </button>
                              {(n === name || isAdmin) && (
                                <button
                                  style={styles.editEntryButton}
                                  onClick={() => startEditing(iso, n)}
                                  aria-label={`Uredi vnos – ${n}`}
                                >
                                  <Pencil size={13} />
                                </button>
                              )}
                            </div>
                            );
                          })}
                          {!entries[name] && (
                            <button
                              style={styles.addButtonSecondary}
                              onClick={() => startEditing(iso)}
                            >
                              + Dodaj svoj vnos
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={styles.footer}>
        <Users size={13} color="var(--text-faint)" />
        <span>Koledar si delijo vsi, ki odprejo to povezavo</span>
      </div>
      {settingsButton}
      {appFooterNote}

      {viewPersonModal}
      {settingsModal}
    </div>
  );
}
