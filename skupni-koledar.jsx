import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users,
  ChevronRight,
  Pencil,
  Eraser,
  Trash2,
  MessageSquare,
  Settings,
  Menu,
  Archive,
  ArrowLeft,
  CalendarDays,
  Sun,
  Moon,
  Plus,
} from "lucide-react";
import {
  styles,
  chipAnimation,
  CHIP_ENTER_MS,
  CHIP_EXIT_MS,
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
    /* --text-heading, held back from opaque. The name bubble covers the
       chips beside the one it belongs to, and letting a little of them
       through says it is passing rather than part of the row. Spelled out
       as rgba rather than mixed from the token above, so nothing depends
       on how well a browser handles colour functions. */
    --tooltip-bg: rgba(27, 46, 36, 0.86);
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
    --tooltip-bg: rgba(244, 246, 242, 0.88);
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

  /* The chip is a circle, but the ring a browser draws around a clicked
     button follows its box, so it comes out square -- and Opera GX draws it
     in a cyan that belongs to no palette here. It was always there; it only
     became visible once withdrawing animated instead of vanishing on the
     spot. Suppressed on click, then given back as a round ring for anyone
     navigating by keyboard, who is the one it exists for. */
  .chipButton:focus {
    outline: none;
  }
  .chipButton:focus-visible {
    outline: 2px solid var(--green);
    outline-offset: 2px;
  }

  /* Attendee chips joining and leaving an event -- see chipAnimation() in
     styles.js, which picks between these and owns their durations. They live
     here because @keyframes cannot be expressed as an inline style. */
  @keyframes chipIn {
    0%   { transform: scale(0.4); opacity: 0; }
    100% { transform: scale(1);   opacity: 1; }
  }
  @keyframes chipOut {
    0%   { transform: scale(1);   opacity: 1; }
    100% { transform: scale(0.4); opacity: 0; }
  }
  /* Someone who asked for less motion still needs to see that the click
     registered, so the chip appears and disappears -- it just stops moving
     to get there. The exit keeps its duration either way, since the click
     handler waits that long before dropping the chip from state. */
  @media (prefers-reduced-motion: reduce) {
    @keyframes chipIn {
      0%   { opacity: 0; }
      100% { opacity: 1; }
    }
    @keyframes chipOut {
      0%   { opacity: 1; }
      100% { opacity: 0; }
    }
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

// Scroll target for a day, shared by the mobile accordion card and the
// desktop detail panel so one lookup works in either layout.
export function dayAnchorId(iso) {
  return `day-${iso}`;
}

// Breathing room left above a day scrolled to from the event strip. Landing
// flush against the top edge reads as clipped rather than as arrival. Matches
// the day list's horizontal padding, so the gap is the same on every side.
const SCROLL_ANCHOR_MARGIN = 16;

// Deliberately arithmetic rather than scrollIntoView + scroll-margin-top: the
// margin is simply ignored here (measured -- the day lands flush at any
// scroll-margin, including 100px), and scroll-margin is the newer property of
// the two on iOS Safari besides.
//
// alignTop is for the mobile accordion, where the day is a row part-way down
// a long list and pulling it to the top is the point. The desktop panel sits
// beside the day grid and is usually already on screen, so there it only gets
// nudged, and only as far as it takes to see it.
function scrollDayIntoView(iso, alignTop) {
  const el = document.getElementById(dayAnchorId(iso));
  if (!el) return;
  const rect = el.getBoundingClientRect();

  if (alignTop) {
    window.scrollTo({
      top: rect.top + window.scrollY - SCROLL_ANCHOR_MARGIN,
      behavior: "smooth",
    });
    return;
  }

  if (rect.top >= SCROLL_ANCHOR_MARGIN && rect.bottom <= window.innerHeight) return;
  const delta =
    rect.top < SCROLL_ANCHOR_MARGIN
      ? rect.top - SCROLL_ANCHOR_MARGIN
      : // Scroll down far enough to reveal the bottom, but never so far that
        // the panel's own top slides above the margin.
        Math.min(rect.bottom - window.innerHeight, rect.top - SCROLL_ANCHOR_MARGIN);
  window.scrollTo({ top: window.scrollY + delta, behavior: "smooth" });
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

// Identifies one person's chip on one event, so an in-flight join or leave
// animation is pinned to that chip alone -- the same person attending two
// events must be able to animate on one without twitching on the other.
export function attendeeChipId(iso, id, person) {
  return `${iso}:${id}:${person}`;
}

// One event's worth of chips, used to park names that have left the attendee
// list but are still playing their exit.
export function eventChipGroup(iso, id) {
  return `${iso}:${id}`;
}

// Copy without one key. The animation bookkeeping is all "set a flag, drop it
// when the animation lands", and doing that inline every time buried what the
// surrounding code was actually for.
export function omitKey(obj, key) {
  const next = { ...obj };
  delete next[key];
  return next;
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
// Comments live in their own rows rather than inside the event JSON. Posting
// one is then an insert of a fresh key instead of a read-modify-write of the
// event, so two people commenting in the same moment cannot overwrite each
// other -- and text someone typed is a worse thing to lose than a toggle.
const COMMENT_MARKER = "__comment__";

export function commentKey(iso, eventId, commentId) {
  return `avail:${iso}:${COMMENT_MARKER}${eventId}:${commentId}`;
}

// One event's thread, addressed the same way everywhere it is held.
export function commentGroup(iso, eventId) {
  return `${iso}:${eventId}`;
}

// Splits the person part of a comment key back into its two ids, on the last
// colon rather than the first. A comment id is always a timestamp and carries
// no colon, so everything before the final one is the event id -- including
// nothing at all, which is what events created before per-day ids existed
// have. Splitting on the first colon would leave those events unable to hold
// a comment at all.
export function parseMarkedPerson(person, marker) {
  if (!person.startsWith(marker)) return null;
  const rest = person.slice(marker.length);
  const at = rest.lastIndexOf(":");
  if (at < 0 || at === rest.length - 1) return null;
  return { ownerId: rest.slice(0, at), itemId: rest.slice(at + 1) };
}

export function parseCommentPerson(person) {
  const parsed = parseMarkedPerson(person, COMMENT_MARKER);
  return parsed && { eventId: parsed.ownerId, commentId: parsed.itemId };
}

export function encodeComment(comment) {
  return JSON.stringify({ author: comment.author, text: comment.text });
}

export function decodeComment(raw, id) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.text !== "string") return null;
    return { id, author: parsed.author || "", text: parsed.text };
  } catch (e) {
    return null;
  }
}

// Oldest first, so a thread reads downwards. Ids are timestamps; the string
// compare is the tie-break for two posted in the same millisecond.
export function sortComments(list) {
  return [...list].sort((a, b) => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id));
}

// Photos take the same shape as comments -- a row of their own per item, so
// adding one is an insert rather than a read-modify-write of the event -- but
// the row holds only a path. The file itself lives in Supabase Storage, for
// the reason spelled out beside window.photos in index.html.
const PHOTO_MARKER = "__photo__";

export function photoKey(iso, eventId, photoId) {
  return `avail:${iso}:${PHOTO_MARKER}${eventId}:${photoId}`;
}

export function photoGroup(iso, eventId) {
  return `${iso}:${eventId}`;
}

export function parsePhotoPerson(person) {
  const parsed = parseMarkedPerson(person, PHOTO_MARKER);
  return parsed && { eventId: parsed.ownerId, photoId: parsed.itemId };
}

// Dimensions travel with the path so a thumbnail can hold its shape before
// the image arrives, which stops the archive jumping as each one lands.
export function encodePhoto(photo) {
  return JSON.stringify({
    author: photo.author,
    path: photo.path,
    w: photo.w,
    h: photo.h,
  });
}

export function decodePhoto(raw, id) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.path !== "string" || !parsed.path) return null;
    return {
      id,
      author: parsed.author || "",
      path: parsed.path,
      w: Number(parsed.w) || 0,
      h: Number(parsed.h) || 0,
    };
  } catch (e) {
    return null;
  }
}

export function sortPhotos(list) {
  return [...list].sort((a, b) => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id));
}

// Straight off a phone a photo is 3-5 MB, and every archive view pulls all of
// them down again against a 5 GB/month egress budget -- about a dozen full
// browses before it is spent. Longest side capped at 1600px takes that to
// roughly 300 KB, still more detail than the archive ever displays, and the
// budget lasts hundreds of browses instead.
export const PHOTO_MAX_EDGE = 1600;
const PHOTO_QUALITY = 0.82;

export function scaledSize(w, h, maxEdge) {
  const longest = Math.max(w, h);
  if (!longest || longest <= maxEdge) return { w, h };
  const ratio = maxEdge / longest;
  return { w: Math.round(w * ratio), h: Math.round(h * ratio) };
}

// Re-encodes as JPEG whatever came in, which also gets HEIC off an iPhone
// into something every browser can display -- iOS hands over a decodable
// image even when the file on disk is HEIC, so the conversion happens here
// rather than being asked of the viewer.
async function downscaleImage(file) {
  const bitmap = await createImageBitmap(file);
  const { w, h } = scaledSize(bitmap.width, bitmap.height, PHOTO_MAX_EDGE);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", PHOTO_QUALITY)
  );
  if (!blob) throw new Error("toBlob returned nothing");
  return { blob, w, h };
}

export function splitDuration(duration) {
  if (!duration) return { start: "", end: "" };
  const [start, end] = duration.split(/\s*[–-]\s*/);
  return { start: (start || "").trim(), end: (end || "").trim() };
}

// Flattens the per-day event map into one list ordered nearest-date-first.
// The visible window only ever runs from today forward, so ascending ISO is
// the same thing as "closest to today first". Within a day the earlier start
// time wins, and creation order breaks any remaining tie so the order is
// total -- otherwise two same-day, same-time events could swap places between
// renders and take their card colors with them.
export function eventsNearestFirst(dayEvents) {
  return Object.entries(dayEvents)
    .flatMap(([iso, events]) => events.map((ev) => ({ ...ev, _iso: iso })))
    .sort(
      (a, b) =>
        a._iso.localeCompare(b._iso) ||
        splitDuration(a.duration).start.localeCompare(splitDuration(b.duration).start) ||
        Number(a.id || 0) - Number(b.id || 0)
    );
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
// Spread around the hue wheel rather than picked by eye: the card paints
// these at 16% alpha, where neighbouring hues collapse into the same pale
// wash, so the gaps between them have to be wide to survive it. Twelve is
// therefore both the palette and the ceiling on how many cards can be on
// screen at once without a repeated color.
//
// Listed interleaved (warm, cool, warm, cool...) rather than in wheel order
// on purpose: assignEventColors resolves a collision by stepping to the next
// entry, and in wheel order that step lands on the neighbouring hue -- which
// at this alpha is the one shade it is hardest to tell the original from.
// Interleaved, the same step crosses the wheel instead.
const RECENT_CARD_HUES = [
  "239, 68, 68", // rdeca
  "6, 182, 212", // cijan
  "249, 115, 22", // oranzna
  "59, 130, 246", // modra
  "234, 179, 8", // rumena
  "99, 102, 241", // indigo
  "132, 204, 22", // limeta
  "168, 85, 247", // vijolicna
  "34, 197, 94", // zelena
  "217, 70, 239", // fuksija
  "20, 184, 166", // turkizna
  "236, 72, 153", // roza
];

// Deterministic (not re-randomized every render) so a given event keeps the
// same color across re-renders/refreshes.
export function hashString(s) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  // The rolling sum alone is affine in its input: two strings differing only
  // by a same-length prefix come out shifted by the same amount, so their
  // relative order survives. shuffleBySeed compares exactly such strings --
  // one seed, many names -- and without this avalanche step every day of the
  // week shuffled to the same pair of people.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
}

export function hueIndexForEvent(ev) {
  return hashString(ev.title || ev.id || "") % RECENT_CARD_HUES.length;
}

// Shuffle that is random in effect but not in behaviour: each name is ranked
// by a hash of the seed and the name, then sorted by that rank. The same seed
// always yields the same order, which is what keeps a row from reshuffling on
// every render, while a new seed reorders everything. Equal hashes fall back
// to the name so the result never depends on input order.
export function shuffleBySeed(names, seed) {
  return names
    .map((n) => ({ n, rank: hashString(`${seed}|${n}`) }))
    .sort((a, b) => a.rank - b.rank || a.n.localeCompare(b.n))
    .map((x) => x.n);
}

// Identity colors for the initials in a day row -- who someone is, not whether
// they are free that day. Fixed hexes rather than theme variables on purpose:
// a person's color should be the same thing in both themes. Kept in the app's
// muted register so they sit with everything else, and dark enough to carry
// white initials.
const PERSON_COLORS = [
  "#D97AA0", // roza
  "#B5651D", // temna oranzna
  "#3A6EA5", // modra
  "#C9A227", // rumena
  "#2F6F5E", // zelena
  "#B23434", // rdeca
  "#6B4E9E", // vijolicna
  "#2E8B8B", // turkizna
  "#7A8C3A", // olivna
  "#4A5568", // skrilavo siva
  "#9B4D96", // magenta
  "#6B4423", // rjava
];

// These four chose theirs. Everyone after them is dealt one of what is left.
// Keyed lowercase because that is the only thing about a stored name that is
// reliably stable.
const RESERVED_PERSON_COLORS = {
  "tina brdnik": "#D97AA0", // roza
  "jernej veber": "#B5651D", // temna oranzna
  "žiga tomše": "#3A6EA5", // modra
  "andrej kalan": "#C9A227", // rumena
};

// Same shape as assignEventColors: the hash picks a preference, and a taken
// color pushes the pick to the next free one, so no two people in the window
// share a color while there are still colors left. Sorted and de-duplicated
// first so the result depends only on *who* is present, never on the order
// they happened to be read in.
export function assignPersonColors(names) {
  const unique = [...new Set(names)].sort((a, b) => a.localeCompare(b));
  const taken = new Set();
  const colors = {};

  unique.forEach((n) => {
    const reserved = RESERVED_PERSON_COLORS[n.trim().toLowerCase()];
    if (!reserved) return;
    colors[n] = reserved;
    taken.add(reserved);
  });

  unique.forEach((n) => {
    if (colors[n]) return;
    const preferred = hashString(n) % PERSON_COLORS.length;
    let chosen = PERSON_COLORS[preferred];
    for (let step = 0; step < PERSON_COLORS.length; step++) {
      const candidate = PERSON_COLORS[(preferred + step) % PERSON_COLORS.length];
      if (!taken.has(candidate)) {
        chosen = candidate;
        break;
      }
    }
    taken.add(chosen);
    colors[n] = chosen;
  });

  return colors;
}

// The hash on its own collides: two unrelated titles can land on the same hue,
// and across a whole list that is likelier than it sounds -- six events over
// twelve hues repeat a color about four times in ten. So hand each event its
// hashed hue when that hue is still free and the next free one when it isn't,
// which keeps colors stable for an unchanged list while guaranteeing no
// repeats up to the size of the palette. Past that repeats are unavoidable and
// it falls back to the plain hash.
export function assignEventColors(events) {
  const taken = new Set();
  return events.map((ev) => {
    const preferred = hueIndexForEvent(ev);
    let chosen = preferred;
    for (let step = 0; step < RECENT_CARD_HUES.length; step++) {
      const candidate = (preferred + step) % RECENT_CARD_HUES.length;
      if (!taken.has(candidate)) {
        chosen = candidate;
        break;
      }
    }
    taken.add(chosen);
    return RECENT_CARD_HUES[chosen];
  });
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

// Slovenian counts in four forms, chosen by n mod 100: one, two, three-or-
// four, and everything else. 101 takes the singular and 111 does not, which
// is why the test is on the last two digits rather than the last one.
export function pluralSl(n, forms) {
  const rest = n % 100;
  if (rest === 1) return forms[0];
  if (rest === 2) return forms[1];
  if (rest === 3 || rest === 4) return forms[2];
  return forms[3];
}

// The archive reaches back past the turn of a year, so unlike the day list
// it has to say which one.
export function archiveDateLabel(iso) {
  return `${weekdayAbbrev(iso)}, ${dayNumber(iso)}. ${monthNumber(iso)}. ${iso.slice(0, 4)}`;
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
const CARDS_IN_VIEW = 3;

// How many people's initials a collapsed day row shows before collapsing the
// rest into a count. The row is a summary, not a roster -- the full list is
// one tap away inside the day.
const DAY_CHIPS_SHOWN = 2;

// How far back one press of "Naloži več" reaches. A bounded slab rather than
// the whole history: the archive only grows, and a query with no lower bound
// would eventually read every row the club has ever written.
const ARCHIVE_SLAB_DAYS = 30;

// Below this the gesture reads as a tap or a stray wobble, not a swipe, and
// the strip springs back to where it was.
const SWIPE_THRESHOLD_PX = 40;

// How long a card sits before the strip slides to the next one.
const AUTO_ADVANCE_MS = 6000;

// "Aktualni dogodki" strip: shows 3 cards, advances one card-width every 6s,
// and can also be dragged by mouse or finger. Both directions wrap seamlessly,
// which is what the padding on `extended` is for: a copy of the last 3 events
// sits before the real list and a copy of the first 3 after it, so sliding off
// either end lands on cards that look exactly like the ones being wrapped to.
// Once such a copy is fully in view, `index` snaps to the matching real card
// with the transition briefly disabled -- visually a no-op. Real event 0
// therefore lives at slot CARDS_IN_VIEW, not slot 0, which is why `base` shows
// up everywhere below instead of a plain 0.
// How long a tapped chip keeps its name up. Long enough to read, short
// enough that you do not have to dismiss it.
const NAME_POPUP_MS = 3000;

// A person's initials, which say who only if you already know the initials.
// Hovering (desktop) or tapping (phone) spells the name out.
//
// A span rather than a button on purpose: the day-row chips sit inside the
// button that opens the day, and a button inside a button is invalid markup
// that browsers quietly rearrange. stopPropagation is what keeps the tap
// from opening the day as well.
// One event's photos, full size, one at a time. Swipe or drag sideways to
// move between them; arrow keys do the same where there is a keyboard.
//
// Its own component so the drag lives beside the thing being dragged. App is
// long enough already, and this needs three pieces of state that nothing
// else in it would ever read.
function PhotoLightbox({ photos, index, urlFor, onClose, onSelect, canDelete, onDelete }) {
  const [dragPx, setDragPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef(null);

  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasPrev) onSelect(index - 1);
      else if (e.key === "ArrowRight" && hasNext) onSelect(index + 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, hasPrev, hasNext, onClose, onSelect]);

  // Tracked on the window rather than the image, and without pointer
  // capture: a drag that leaves the photo has to keep counting, and capture
  // would retarget the click that ends it -- the same trap the event strip
  // fell into.
  useEffect(() => {
    if (!dragging) return;

    function move(e) {
      if (startRef.current === null) return;
      setDragPx(e.clientX - startRef.current);
    }

    function end(e) {
      const startX = startRef.current;
      startRef.current = null;
      setDragPx(0);
      setDragging(false);
      if (startX === null || e.type === "pointercancel") return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
      // Dragging left pulls the next photo in from the right, the direction
      // the picture itself moves under the finger.
      if (dx < 0 && hasNext) onSelect(index + 1);
      else if (dx > 0 && hasPrev) onSelect(index - 1);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragging, index, hasPrev, hasNext, onSelect]);

  // At the ends the photo still follows the finger, but only halfway. It
  // gives way rather than refusing, which is how a list says it has run out.
  const resisted =
    (dragPx < 0 && !hasNext) || (dragPx > 0 && !hasPrev) ? dragPx / 3 : dragPx;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.lightboxInner} onClick={(e) => e.stopPropagation()}>
        <div style={styles.lightboxStage}>
          <img
            src={urlFor(photo.path)}
            alt=""
            draggable={false}
            style={styles.lightboxImg(dragging, resisted)}
            onPointerDown={(e) => {
              if (photos.length < 2) return;
              startRef.current = e.clientX;
              setDragging(true);
            }}
          />
          {hasPrev && (
            <button
              style={styles.lightboxNav("left")}
              onClick={() => onSelect(index - 1)}
              aria-label="Prejšnja slika"
            >
              <ChevronRight size={20} style={{ transform: "rotate(180deg)" }} />
            </button>
          )}
          {hasNext && (
            <button
              style={styles.lightboxNav("right")}
              onClick={() => onSelect(index + 1)}
              aria-label="Naslednja slika"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>
        <div style={styles.lightboxBar}>
          <span style={styles.lightboxAuthor}>
            {photo.author ? `Naložil: ${photo.author}` : ""}
          </span>
          {photos.length > 1 && (
            <span style={styles.lightboxCount}>
              {index + 1} / {photos.length}
            </span>
          )}
          {/* Only your own, the rule the comments already follow. */}
          {canDelete && (
            <button style={styles.deleteButton} onClick={onDelete}>
              <Trash2 size={12} /> Odstrani
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PersonChip({ name, color, style, self }) {
  const [at, setAt] = useState(null);
  const chipRef = useRef(null);
  const hideRef = useRef(null);

  const hide = useCallback(() => {
    clearTimeout(hideRef.current);
    setAt(null);
  }, []);

  useEffect(() => () => clearTimeout(hideRef.current), []);

  // A fixed bubble keeps its place on the screen, not in the page, so any
  // scroll leaves it pointing at nothing. Cheaper to dismiss it than to
  // chase the chip.
  useEffect(() => {
    if (!at) return;
    window.addEventListener("scroll", hide, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", hide, { capture: true });
  }, [at, hide]);

  // Always on a timer, hover included. A chip can slide under a resting
  // cursor when the row it is in re-lays out -- withdrawing from an event
  // shifts everyone left -- and a hover that only ends on mouseleave then
  // has nothing to end it.
  function reveal() {
    const box = chipRef.current && chipRef.current.getBoundingClientRect();
    if (!box) return;
    clearTimeout(hideRef.current);
    setAt({ x: box.left + box.width / 2, y: box.top });
    hideRef.current = setTimeout(() => setAt(null), NAME_POPUP_MS);
  }

  // Your own chip stays inert. On an event it is the control that withdraws
  // you, and one tap cannot mean both "who is this" and "I am not coming" --
  // and you are the one person whose initials you already recognise.
  if (self) {
    return <span style={{ ...styles.avatarChip(color), ...style }}>{initials(name)}</span>;
  }

  return (
    <>
      <span
        ref={chipRef}
        style={{ ...styles.avatarChip(color), ...style }}
        onClick={(e) => {
          // Or the tap would also reach the button that opens the day.
          e.stopPropagation();
          reveal();
        }}
        onMouseEnter={reveal}
        onMouseLeave={hide}
        aria-label={name}
      >
        {initials(name)}
      </span>
      {at && <span style={styles.personChipName(at.x, at.y)}>{name}</span>}
    </>
  );
}

function RecentEventsCarousel({ events, eventHues, onSelectDay }) {
  const count = events.length;
  const canSlide = count > CARDS_IN_VIEW;
  const base = canSlide ? CARDS_IN_VIEW : 0;

  const [index, setIndex] = useState(base);
  const [animate, setAnimate] = useState(true);
  const [dragPx, setDragPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);
  // A swipe ends in a click on whichever card the pointer happened to be
  // over, so cards have to be able to tell a tap from the tail of a drag. The
  // click lands within a frame or two of the drag ending, so a short window
  // after it separates the two -- and unlike a sticky flag, a stale timestamp
  // can't still be swallowing clicks minutes later.
  const dragEndedAtRef = useRef(0);
  const viewportRef = useRef(null);

  // Re-center whenever the list itself changes length, so an index left over
  // from a longer list can't park the strip on padding slots.
  useEffect(() => {
    setAnimate(false);
    setIndex(base);
  }, [count, base]);

  // Auto-advance. Restarting on `dragging` doubles as the pause: letting go
  // starts a fresh interval rather than firing whatever was left of the old one.
  useEffect(() => {
    if (!canSlide || dragging) return;
    const timer = setInterval(() => setIndex((i) => i + 1), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [canSlide, dragging]);

  // Sitting on a padding slot: let the slide finish, then jump to the real
  // card it was a copy of.
  useEffect(() => {
    if (!canSlide) return;
    if (index >= base && index < base + count) return;
    const target = index >= base + count ? base : base + count - 1;
    const t = setTimeout(() => {
      setAnimate(false);
      setIndex(target);
    }, 520); // just past the 500ms slide transition
    return () => clearTimeout(t);
  }, [index, base, count, canSlide]);

  // Any setAnimate(false) above is only meant to cover a single instant jump,
  // so re-arm the transition on the next frame.
  useEffect(() => {
    if (animate) return;
    const raf = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  function handlePointerDown(e) {
    if (!canSlide) return;
    dragRef.current = e.clientX;
    setDragging(true);
    setAnimate(false); // follow the finger 1:1 instead of easing behind it
  }

  // Tracked on the window, and deliberately without setPointerCapture: capture
  // retargets the follow-up click to the captured element, so a card's own
  // onClick would never fire and tapping a card could not open its day. The
  // window listeners give back the one thing capture was there for -- a drag
  // that carries on after the pointer wanders off the strip.
  useEffect(() => {
    if (!dragging) return;

    function move(e) {
      if (dragRef.current === null) return;
      setDragPx(e.clientX - dragRef.current);
    }

    function end(e) {
      const startX = dragRef.current;
      dragRef.current = null;
      setDragPx(0);
      setAnimate(true);
      setDragging(false);
      if (startX === null || e.type === "pointercancel") return;

      const dx = e.clientX - startX;
      // Well below SWIPE_THRESHOLD_PX: a drag too small to move the strip
      // should still not read as a tap on the card it ended over.
      if (Math.abs(dx) > 4) dragEndedAtRef.current = performance.now();
      // One gesture moves one card however far it travelled: the cards are
      // only a third of a phone screen wide, so a long flick meaning "jump
      // four ahead" is far less likely than one that just overshot.
      if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) setIndex((i) => i + (dx < 0 ? 1 : -1));
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragging]);

  if (count === 0) return null;

  // Colors come from App rather than being assigned here, because the same
  // event is also drawn inside its day and the two have to match. Carried
  // into the padding copies too, so a copy always matches the card it stands
  // in for.
  const cards = events.map((ev, i) => ({
    ev,
    hue: eventHues[eventKey(ev._iso, ev.id)],
    // The loop's seam: past this card the list starts over at the soonest
    // event again, and without a mark that restart is indistinguishable from
    // simply more events.
    seamAfter: canSlide && i === count - 1,
  }));
  const extended = canSlide
    ? [...cards.slice(-CARDS_IN_VIEW), ...cards, ...cards.slice(0, CARDS_IN_VIEW)]
    : cards;
  const slotPercent = 100 / extended.length;

  return (
    <>
      <div style={styles.recentEventsHeading}>Aktualni dogodki</div>
      <div
        ref={viewportRef}
        style={styles.recentEventsViewport(canSlide, dragging)}
        onPointerDown={handlePointerDown}
      >
        <div style={styles.recentEventsTrack(extended.length, index, animate, dragPx)}>
          {extended.map(({ ev, hue, seamAfter }, i) => (
            <div key={`${ev.id}-${i}`} style={styles.recentEventSlot(slotPercent)}>
              {seamAfter && <div style={styles.recentEventsSeam} />}
              <button
                type="button"
                style={styles.recentEventCard(hue, dragging)}
                onClick={() => {
                  if (performance.now() - dragEndedAtRef.current < 150) return;
                  onSelectDay?.(ev._iso);
                }}
              >
                <div style={styles.recentEventTitle(Boolean(ev.keyword))}>{ev.title}</div>
                <div style={styles.recentEventDate}>{shortDateLabel(ev._iso)}</div>
                {ev.duration && (
                  <div style={styles.recentEventTime}>{splitDuration(ev.duration).start}</div>
                )}
                {ev.keyword && <div style={styles.recentEventKeyword}>{ev.keyword}</div>}
              </button>
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
  const [scrollToDay, setScrollToDay] = useState(null);
  // Re-rolled once per load, so the two people a collapsed day shows change
  // from visit to visit rather than the same name always leading. A ref and
  // not state: these rows re-render constantly -- the event strip alone
  // advances every 6s -- and reshuffling on each render would make the chips
  // jitter in place.
  const chipSeedRef = useRef(Math.random().toString(36).slice(2));
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
  const [menuOpen, setMenuOpen] = useState(false);
  // "calendar" | "archive". Two pages, so a string rather than a router.
  const [view, setView] = useState("calendar");
  // Oldest date the archive has reached. The next slab runs from
  // ARCHIVE_SLAB_DAYS before it up to it; null means nothing loaded yet.
  const [archiveFrom, setArchiveFrom] = useState(null);
  // Past days holding at least one event, newest first. Their events and
  // threads live in dayEvents/dayComments alongside the visible window, so
  // every piece of event UI already written works on them unchanged.
  const [archiveIsos, setArchiveIsos] = useState([]);
  // Which archived event is expanded, as "iso:eventId"; one at a time.
  const [openArchiveEvent, setOpenArchiveEvent] = useState(null);
  // The oldest event that exists, so the archive knows where history ends
  // rather than offering to walk backwards forever. undefined until asked,
  // null when the club has never held one; a failed probe leaves it
  // undefined, which falls back to one slab per press.
  const [oldestEventIso, setOldestEventIso] = useState(undefined);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState(null);
  const menuRef = useRef(null);
  const [dayEvents, setDayEvents] = useState({}); // { iso: [{ id, title, description, duration, createdBy, attendees }] }
  const [editingEvent, setEditingEvent] = useState(null); // { iso, id } of the open event form, id null means "new event"; or null
  const [eventTitleDraft, setEventTitleDraft] = useState("");
  const [eventDescDraft, setEventDescDraft] = useState("");
  const [showEventDescInput, setShowEventDescInput] = useState(false);
  const [eventKeywordDraft, setEventKeywordDraft] = useState("");
  const [eventStartDraft, setEventStartDraft] = useState("");
  const [eventEndDraft, setEventEndDraft] = useState("");
  // Attendee chips currently playing an animation: chip id -> "in" | "out".
  // Only ever holds the one or two chips mid-flight; entries are cleared as
  // each animation lands.
  // { "iso:eventId": [{ id, author, text }] } -- flat rather than nested per
  // day, because a thread is only ever read and written as a whole.
  const [dayComments, setDayComments] = useState({});
  // Photos per event, keyed like the comment threads: "iso:eventId" -> [photo]
  const [dayPhotos, setDayPhotos] = useState({});
  // How many uploads are still in flight per event, so the strip can show
  // placeholders. A count and not a boolean: several files can be picked at
  // once and each finishes on its own.
  const [photoUploads, setPhotoUploads] = useState({});
  // The photo shown full-size, as { iso, eventId, id }, or null.
  const [lightbox, setLightbox] = useState(null);
  // Only one thread is open at a time; a card is small and two expanded
  // threads in one day would push the rest of it off screen.
  const [openComments, setOpenComments] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [chipAnim, setChipAnim] = useState({});
  // Names already gone from an event's attendees but still on screen playing
  // their exit: "iso:eventId" -> [person]. Same lifetime as the "out" flag
  // above, and cleared by the same timer.
  const [ghostChips, setGhostChips] = useState({});

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

  // Closing on any pointer down outside the menu, rather than on the menu
  // losing focus: the panel's own buttons take focus as you move through it,
  // and a blur handler would shut it before the click it was blurring for
  // ever landed. Escape is here too because a dropdown that traps you until
  // you find its edge is worse than no dropdown.
  //
  // Up here with the other hooks, not down beside the markup it belongs to:
  // App returns early while loading and while signed out, and a hook declared
  // past those returns runs on some renders and not others.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // The archive is a page, so the phone's back button has to leave the
  // archive rather than leave the app. Every switch pushes an entry and
  // popstate reads the view back out of it -- an entry with no state at all
  // is the first load, which is the calendar.
  useEffect(() => {
    function onPopState(e) {
      setView(e.state && e.state.view === "archive" ? "archive" : "calendar");
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!scrollToDay) return;
    scrollDayIntoView(scrollToDay, !isDesktop);
    setScrollToDay(null);
  }, [scrollToDay, isDesktop]);

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
      const comments = {};
      const photos = {};
      for (const iso of days) {
        result[iso] = {};
        events[iso] = [];
      }
      for (const row of (res && res.rows) || []) {
        const iso = isoFromKey(row.key);
        const person = personFromKey(row.key);
        if (!person || !(iso in result)) continue;
        if (person.startsWith(COMMENT_MARKER)) {
          const parsed = parseCommentPerson(person);
          const comment = parsed && decodeComment(row.value, parsed.commentId);
          if (comment) {
            const group = commentGroup(iso, parsed.eventId);
            (comments[group] = comments[group] || []).push(comment);
          }
          continue;
        }
        if (person.startsWith(PHOTO_MARKER)) {
          const parsed = parsePhotoPerson(person);
          const photo = parsed && decodePhoto(row.value, parsed.photoId);
          if (photo) {
            const group = photoGroup(iso, parsed.eventId);
            (photos[group] = photos[group] || []).push(photo);
          }
          continue;
        }
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
      for (const group of Object.keys(comments)) {
        comments[group] = sortComments(comments[group]);
      }
      for (const group of Object.keys(photos)) {
        photos[group] = sortPhotos(photos[group]);
      }
      setDayData(result);
      // Merged, not replaced. The archive keeps its events and threads in
      // these same maps, and refreshing the visible window must not throw
      // away days the archive is holding. `events` carries a key for every
      // visible day, so those are still overwritten wholesale.
      setDayEvents((prev) => ({ ...prev, ...events }));
      setDayComments((prev) => {
        const kept = {};
        for (const [group, list] of Object.entries(prev)) {
          const iso = group.slice(0, group.indexOf(":"));
          if (!(iso in result)) kept[group] = list;
        }
        return { ...kept, ...comments };
      });
      // Same merge rule as the threads above: drop only the groups this
      // window just re-read, so the archive's photos survive a refresh.
      setDayPhotos((prev) => {
        const kept = {};
        for (const [group, list] of Object.entries(prev)) {
          const iso = group.slice(0, group.indexOf(":"));
          if (!(iso in result)) kept[group] = list;
        }
        return { ...kept, ...photos };
      });
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

  // Reads one slab further back each time. Availability entries are skipped
  // on purpose -- who was free three weeks ago is not something anyone goes
  // looking for; what happened is.
  const loadArchiveSlab = useCallback(async () => {
    if (!days.length || archiveLoading) return;
    setArchiveLoading(true);
    setArchiveError(null);
    try {
      const events = {};
      const comments = {};
      const photos = {};
      let upper = archiveFrom || days[0]; // exclusive: today is not archive
      // Only a past event is a floor. The oldest event overall can be one
      // that has not happened yet, and stepping back towards it would be
      // stepping towards something the archive will never show.
      const floor =
        oldestEventIso && oldestEventIso < days[0] ? oldestEventIso : null;

      // Steps back a slab at a time until this press has something to show,
      // or until it has reached past the oldest event there is. A quiet
      // stretch of months would otherwise cost one press each, every one of
      // them adding nothing to the list.
      for (;;) {
        const lower = addDays(upper, -ARCHIVE_SLAB_DAYS);
        const res = await window.storage.range(`avail:${lower}`, `avail:${upper}`, true);
        for (const row of (res && res.rows) || []) {
          const iso = isoFromKey(row.key);
          const person = personFromKey(row.key);
          if (!iso || !person) continue;
          if (person.startsWith(COMMENT_MARKER)) {
            const parsed = parseCommentPerson(person);
            const comment = parsed && decodeComment(row.value, parsed.commentId);
            if (comment) {
              const group = commentGroup(iso, parsed.eventId);
              (comments[group] = comments[group] || []).push(comment);
            }
          } else if (person.startsWith(PHOTO_MARKER)) {
            const parsed = parsePhotoPerson(person);
            const photo = parsed && decodePhoto(row.value, parsed.photoId);
            if (photo) {
              const group = photoGroup(iso, parsed.eventId);
              (photos[group] = photos[group] || []).push(photo);
            }
          } else if (person.startsWith(EVENT_MARKER)) {
            const ev = decodeEvent(row.value, person.slice(EVENT_MARKER.length));
            if (ev) (events[iso] = events[iso] || []).push(ev);
          }
        }
        upper = lower;
        if (Object.keys(events).length > 0) break;
        // Nothing found yet: keep going only while something older is known
        // to exist. An unknown floor means one slab is all this can assume.
        if (!floor || lower <= floor) break;
      }

      for (const iso of Object.keys(events)) {
        events[iso].sort((a, b) => Number(a.id) - Number(b.id));
      }
      for (const group of Object.keys(comments)) {
        comments[group] = sortComments(comments[group]);
      }
      for (const group of Object.keys(photos)) {
        photos[group] = sortPhotos(photos[group]);
      }
      setDayEvents((prev) => ({ ...prev, ...events }));
      setDayComments((prev) => ({ ...prev, ...comments }));
      setDayPhotos((prev) => ({ ...prev, ...photos }));
      setArchiveIsos((prev) =>
        [...new Set([...prev, ...Object.keys(events)])].sort().reverse()
      );
      setArchiveFrom(upper);
    } catch (e) {
      setArchiveError("Arhiva ni bilo mogoče naložiti. Poskusi znova.");
    } finally {
      setArchiveLoading(false);
    }
  }, [days, archiveFrom, archiveLoading, oldestEventIso]);

  // Asked once, before the first slab, so the very first press already
  // knows whether there is anything older to reach for.
  useEffect(() => {
    if (view !== "archive" || !name || oldestEventIso !== undefined) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await window.storage.firstKey(`avail:%${EVENT_MARKER}%`, true);
        if (!cancelled) setOldestEventIso(res && res.key ? isoFromKey(res.key) : null);
      } catch (e) {
        // Left undefined on purpose: the button then behaves as it did
        // before, one slab per press, rather than claiming history ended.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, name, oldestEventIso]);

  // First slab on first visit only; after that it is the button's job.
  useEffect(() => {
    if (view === "archive" && name && days.length && archiveFrom === null) {
      loadArchiveSlab();
    }
  }, [view, name, days, archiveFrom, loadArchiveSlab]);

  // Read inside the change handler rather than closed over, so neither the
  // window moving nor an event changing means tearing the subscription down
  // and building it again. dayEvents is needed there to see what an incoming
  // event changed, which is the only way to tell a new attendee from one who
  // was already on the list.
  const archiveIsosRef = useRef(archiveIsos);
  useEffect(() => {
    archiveIsosRef.current = archiveIsos;
  }, [archiveIsos]);

  const daysRef = useRef(days);
  useEffect(() => {
    daysRef.current = days;
  }, [days]);
  const dayEventsRef = useRef(dayEvents);
  useEffect(() => {
    dayEventsRef.current = dayEvents;
  }, [dayEvents]);

  // Live updates: someone else's save lands here without a reload. The feed
  // carries the changed row itself, so this applies the same one-row edit to
  // state that persistEntry/saveEvent already make locally -- no refetch per
  // change. Your own writes echo back and re-apply the value that is already
  // on screen, which is why both paths have to end in the same shape.
  //
  // An open editor is safe from this: startEditing copies into myHours once,
  // so the draft is its own state and a dayData update cannot move it.
  useEffect(() => {
    // The shim is guarded, not assumed: a browser holding an older cached
    // index.html would otherwise throw here and take the whole app down.
    if (!name || !window.storage.subscribe) return;
    let seenSubscribed = false;
    const unsubscribe = window.storage.subscribe(
      {
        onChange: ({ type, key, value }) => {
          const iso = isoFromKey(key);
          const person = personFromKey(key);
          // Past days count too, once the archive has loaded them: a comment
          // written under last week's outing has to reach whoever else is
          // reading it, exactly as one written under today does.
          if (
            !iso ||
            !person ||
            (!daysRef.current.includes(iso) && !archiveIsosRef.current.includes(iso))
          ) {
            return;
          }

          if (person.startsWith(COMMENT_MARKER)) {
            const parsed = parseCommentPerson(person);
            if (!parsed) return;
            const group = commentGroup(iso, parsed.eventId);
            setDayComments((prev) => {
              const list = prev[group] || [];
              if (type === "DELETE") {
                return { ...prev, [group]: list.filter((c) => c.id !== parsed.commentId) };
              }
              const comment = decodeComment(value, parsed.commentId);
              if (!comment) return prev;
              // Your own post arrives back as a message too. Matching on id
              // rather than appending is what makes that echo a no-op instead
              // of a second copy of what you just wrote.
              const next = list.some((c) => c.id === comment.id)
                ? list.map((c) => (c.id === comment.id ? comment : c))
                : [...list, comment];
              return { ...prev, [group]: sortComments(next) };
            });
            return;
          }

          if (person.startsWith(PHOTO_MARKER)) {
            const parsed = parsePhotoPerson(person);
            if (!parsed) return;
            const group = photoGroup(iso, parsed.eventId);
            setDayPhotos((prev) => {
              const list = prev[group] || [];
              if (type === "DELETE") {
                return { ...prev, [group]: list.filter((p) => p.id !== parsed.photoId) };
              }
              const photo = decodePhoto(value, parsed.photoId);
              if (!photo) return prev;
              // Matched on id for the same reason the thread above is: your
              // own upload comes back as a message, and it has to land on the
              // photo already showing rather than beside it.
              const next = list.some((p) => p.id === photo.id)
                ? list.map((p) => (p.id === photo.id ? photo : p))
                : [...list, photo];
              return { ...prev, [group]: sortPhotos(next) };
            });
            return;
          }

          if (person.startsWith(EVENT_MARKER)) {
            const id = person.slice(EVENT_MARKER.length);

            // Who joined or left, worked out before the state update rather
            // than inside it: a state updater has to stay a pure function of
            // its input, and starting animations from one would fire them
            // twice under React's double-invoked renders.
            if (type !== "DELETE") {
              const before = (dayEventsRef.current[iso] || []).find((e) => e.id === id);
              const incoming = decodeEvent(value, id);
              // With no prior copy every attendee is "new", which on first
              // sight of an event would pop the whole list at once. Silence
              // is the better default: this is a change feed, and an event
              // nobody here had is not a change anyone watched happen.
              if (before && incoming) {
                for (const n of incoming.attendees) {
                  if (!before.attendees.includes(n)) beginChipEnter(iso, id, n);
                }
                for (const n of before.attendees) {
                  if (!incoming.attendees.includes(n)) beginChipExit(iso, id, n);
                }
              }
            }

            setDayEvents((prev) => {
              const list = prev[iso] || [];
              if (type === "DELETE") {
                return { ...prev, [iso]: list.filter((e) => e.id !== id) };
              }
              const ev = decodeEvent(value, id);
              if (!ev) return prev;
              // An update to an event already held and an insert of one never
              // seen arrive as the same kind of message once a reconnect is in
              // play, so go by whether the id is present rather than by type.
              const next = list.some((e) => e.id === id)
                ? list.map((e) => (e.id === id ? ev : e))
                : [...list, ev];
              next.sort((a, b) => Number(a.id) - Number(b.id));
              return { ...prev, [iso]: next };
            });
            return;
          }

          setDayData((prev) => {
            const dayEntries = { ...(prev[iso] || {}) };
            if (type === "DELETE") delete dayEntries[person];
            else dayEntries[person] = decodeEntry(value);
            return { ...prev, [iso]: dayEntries };
          });
        },
        onStatus: (status) => {
          if (status !== "SUBSCRIBED") return;
          // Changes made while the socket was down are simply not replayed,
          // so re-read the window on every reconnect. Skipped the first time,
          // which the initial load above has already covered.
          if (!seenSubscribed) {
            seenSubscribed = true;
            return;
          }
          loadAllData();
        },
      },
      true
    );
    return unsubscribe;
  }, [name, loadAllData]);

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

  function goTo(next) {
    setMenuOpen(false);
    if (next === view) return;
    window.history.pushState({ view: next }, "");
    setView(next);
    // A new page starts at its own top, not at wherever the last one was left.
    window.scrollTo(0, 0);
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

  // Opening a day from the event strip. The scroll can't happen here: the
  // day has not expanded yet, so scrollIntoView would aim at where the
  // collapsed card used to be. Handing the iso to state lets the effect below
  // run it once React has laid the expanded day out.
  function openEventDay(iso) {
    selectDay(iso);
    setScrollToDay(iso);
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

  // Both halves of the animation are driven from here rather than from the
  // click handler, because a chip can now also arrive or leave because
  // someone else acted -- and a join you made and a join you were told about
  // should look the same. The realtime handler calls these on the difference
  // between the event it held and the one that arrived.

  function beginChipEnter(iso, eventId, person) {
    const chipId = attendeeChipId(iso, eventId, person);
    setChipAnim((prev) => ({ ...prev, [chipId]: "in" }));
    // Cleared only once the pop has finished. Removing the flag mid-flight
    // would strip the animation and snap the chip to full size; removing it
    // after costs nothing, since the last frame and the resting style match.
    setTimeout(() => setChipAnim((prev) => omitKey(prev, chipId)), CHIP_ENTER_MS);
  }

  // Dropping a name from attendees unmounts its chip on the same tick,
  // leaving nothing on screen to shrink. So the name is also parked here for
  // the length of the exit and rendered alongside the real ones -- state can
  // then be applied immediately, which matters for a remote change: holding
  // an incoming payload back to wait out an animation risks applying it after
  // a newer one.
  function beginChipExit(iso, eventId, person) {
    const chipId = attendeeChipId(iso, eventId, person);
    const groupKey = eventChipGroup(iso, eventId);
    setChipAnim((prev) => ({ ...prev, [chipId]: "out" }));
    setGhostChips((prev) => ({
      ...prev,
      [groupKey]: [...(prev[groupKey] || []).filter((n) => n !== person), person],
    }));
    setTimeout(() => {
      setGhostChips((prev) => {
        const rest = (prev[groupKey] || []).filter((n) => n !== person);
        return rest.length
          ? { ...prev, [groupKey]: rest }
          : omitKey(prev, groupKey);
      });
      setChipAnim((prev) => omitKey(prev, chipId));
    }, CHIP_EXIT_MS);
  }

  async function postComment(iso, eventId) {
    const group = commentGroup(iso, eventId);
    const text = (commentDrafts[group] || "").trim();
    if (!text || !name) return;
    const comment = { id: String(Date.now()), author: name, text };
    setDayComments((prev) => ({
      ...prev,
      [group]: sortComments([...(prev[group] || []), comment]),
    }));
    setCommentDrafts((prev) => ({ ...prev, [group]: "" }));
    try {
      await window.storage.set(
        commentKey(iso, eventId, comment.id),
        encodeComment(comment),
        true
      );
    } catch (e) {
      setError("Komentarja ni bilo mogoče objaviti. Poskusi znova.");
      loadAllData();
    }
  }

  // Only what you wrote. Same rule the events already follow, and the one
  // place a stray tap would destroy something nobody can get back.
  async function deleteComment(iso, eventId, commentId) {
    const group = commentGroup(iso, eventId);
    setDayComments((prev) => ({
      ...prev,
      [group]: (prev[group] || []).filter((c) => c.id !== commentId),
    }));
    try {
      await window.storage.delete(commentKey(iso, eventId, commentId), true);
    } catch (e) {
      setError("Komentarja ni bilo mogoče izbrisati. Poskusi znova.");
      loadAllData();
    }
  }

  // Files are handled one at a time rather than in parallel: a phone picking
  // ten photos would otherwise decode ten full-size bitmaps at once, which is
  // where a browser tab runs out of memory and dies. Each one appears as it
  // lands, so the wait is visible rather than silent.
  async function uploadPhotos(iso, eventId, fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length || !name || !window.photos) return;
    const group = photoGroup(iso, eventId);
    setPhotoUploads((prev) => ({ ...prev, [group]: (prev[group] || 0) + files.length }));

    for (let i = 0; i < files.length; i++) {
      try {
        const { blob, w, h } = await downscaleImage(files[i]);
        // Ids stay purely numeric so they sort as numbers; the offset keeps
        // several files picked in one go from colliding on the same
        // millisecond.
        const photoId = String(Date.now() + i);
        const path = `${iso}/${eventId || "brez-id"}/${photoId}.jpg`;
        await window.photos.upload(path, blob);
        const photo = { id: photoId, author: name, path, w, h };
        setDayPhotos((prev) => ({
          ...prev,
          [group]: sortPhotos([...(prev[group] || []), photo]),
        }));
        await window.storage.set(photoKey(iso, eventId, photoId), encodePhoto(photo), true);
      } catch (e) {
        console.error("photo upload failed:", e);
        setError("Slike ni bilo mogoče naložiti. Poskusi znova.");
      } finally {
        setPhotoUploads((prev) => ({
          ...prev,
          [group]: Math.max(0, (prev[group] || 1) - 1),
        }));
      }
    }
  }

  // Removes the row that puts the photo in the archive; the file itself stays
  // in the bucket. That is deliberate -- the bucket grants anon no delete,
  // because a public bucket anyone may delete from is one bad visitor away
  // from losing every photo, and unlike an availability entry there is no
  // second copy to retype it from. Clearing the orphaned files is a job for
  // the dashboard, not for whoever taps this.
  async function deletePhoto(iso, eventId, photoId) {
    const group = photoGroup(iso, eventId);
    setDayPhotos((prev) => ({
      ...prev,
      [group]: (prev[group] || []).filter((p) => p.id !== photoId),
    }));
    setLightbox(null);
    try {
      await window.storage.delete(photoKey(iso, eventId, photoId), true);
    } catch (e) {
      setError("Slike ni bilo mogoče odstraniti. Poskusi znova.");
      loadAllData();
    }
  }

  async function toggleAttendance(iso, id) {
    const existing = dayEvents[iso]?.find((e) => e.id === id);
    if (!existing || !name) return;
    const attending = existing.attendees.includes(name);

    if (attending) beginChipExit(iso, id, name);
    else beginChipEnter(iso, id, name);

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

  // Soonest event leftmost, running further into the future to the right.
  // Narrowed to the visible window first. dayEvents now also holds whatever
  // the archive has loaded, and handing the whole map to eventsNearestFirst
  // put last month's outings in "Aktualni dogodki" the moment anyone opened
  // the archive.
  const upcomingEvents = {};
  for (const iso of days) {
    if (dayEvents[iso]) upcomingEvents[iso] = dayEvents[iso];
  }
  const recentEvents = eventsNearestFirst(upcomingEvents);

  // Everything the archive has loaded, newest day first. archiveIsos is
  // already sorted that way; within a day the events keep their creation
  // order, which is the order they had on the day itself.
  const archiveEntries = archiveIsos.flatMap((iso) =>
    (dayEvents[iso] || []).map((event) => ({ iso, event }))
  );

  // One color per event, assigned across the whole list and then looked up by
  // storage key, so an event's card in the strip and its card inside the day
  // are the same color rather than two independent guesses. Archived events
  // join the same assignment, or an event would change colour on its way into
  // the archive -- and the upcoming ones are listed first so their colours do
  // not shift as older ones load in behind them.
  const colorableEvents = [
    ...recentEvents,
    ...archiveEntries.map(({ iso, event }) => ({ ...event, _iso: iso })),
  ];
  const eventHues = {};
  assignEventColors(colorableEvents).forEach((hue, i) => {
    eventHues[eventKey(colorableEvents[i]._iso, colorableEvents[i].id)] = hue;
  });

  // Assigned across everyone in the whole visible window, not per day, so a
  // set of initials keeps the same color from row to row.
  const personColors = assignPersonColors([
    // Yourself, whether or not you appear anywhere in the window: your chip
    // is in the menu on every screen, and it would otherwise fall back to
    // green on a week you happened not to fill in -- a different colour from
    // the one the day rows give you the moment you do.
    ...(name ? [name] : []),
    ...Object.values(dayData).flatMap((dayEntries) => Object.keys(dayEntries)),
    // Anyone still playing their exit counts as present for as long as their
    // chip is on screen. They are already out of the data below, so without
    // this the chip loses its color and flashes to the fallback green for the
    // last frames of the animation that is removing it.
    ...Object.values(ghostChips).flat(),
    // Event attendees too: someone can say "Da" to an event without ever
    // filing their availability, and they still need a color to be drawn in.
    ...Object.values(dayEvents).flatMap((evs) => evs.flatMap((ev) => ev.attendees)),
    // And whoever wrote a comment: their initials are drawn beside it, and
    // someone can have commented without ever attending or filing a day.
    ...Object.values(dayComments).flatMap((list) => list.map((c) => c.author)),
  ]);

  const recentEventsRow = (
    <RecentEventsCarousel
      events={recentEvents}
      eventHues={eventHues}
      onSelectDay={openEventDay}
    />
  );

  // One button in the header now; the ref still wraps it because the dropdown
  // hangs off this box and it is what "outside" is measured against.
  const headerActions = (
    <div ref={menuRef} style={styles.headerActions}>
      <button
        style={styles.menuButton}
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Meni"
        aria-expanded={menuOpen}
      >
        <Menu size={18} />
      </button>
      {menuOpen && (
        <div style={styles.menuPanel}>
          {/* Who you are and the way to change it, in one row: the initials
              were the only thing in the header saying which account this is,
              so moving the control into the menu had to bring them along. */}
          <button
            style={styles.menuProfile}
            onClick={() => {
              setMenuOpen(false);
              toggleEditingName();
            }}
            aria-label="Uredi ime"
          >
            <span style={styles.avatarChip(personColors[name] || GREEN)}>
              {initials(name)}
            </span>
            <span style={styles.menuProfileName}>{name}</span>
            <Pencil size={13} style={styles.menuProfilePencil} />
          </button>
          <div style={styles.menuDivider} />
          <button
            style={styles.menuItem(view === "calendar")}
            disabled={view === "calendar"}
            onClick={() => goTo("calendar")}
          >
            <CalendarDays size={14} /> Koledar
            {view === "calendar" && <span style={styles.menuItemNote}>tu si</span>}
          </button>
          <button
            style={styles.menuItem(view === "archive")}
            disabled={view === "archive"}
            onClick={() => goTo("archive")}
          >
            <Archive size={14} /> Arhiv
            {view === "archive" && <span style={styles.menuItemNote}>tu si</span>}
          </button>
          <button
            style={styles.menuItem(false)}
            onClick={() => {
              setMenuOpen(false);
              setShowSettings(true);
            }}
          >
            <Settings size={14} /> Nastavitve
          </button>
        </div>
      )}
    </div>
  );

  // The one bar every signed-in page wears. It was written out twice --
  // identically -- in the two layout branches, and a third page would have
  // made it three copies of the same greeting.
  const appHeader = (
    <header style={styles.header}>
      <div>
        <div style={styles.eyebrow}>Garaža Klub Koledar</div>
        <h1 style={styles.headerTitle}>
          Živjo <span style={styles.headerAccent}>{capitalize(name.split(" ")[0])}</span>,
          kdaj maš cajt?
        </h1>
      </div>
      {headerActions}
    </header>
  );

  const nameEditRow = editingName && (
    <div style={styles.editNameRow}>
      <div style={styles.editNameInputs}>
        <input
          autoFocus
          style={styles.inputName}
          placeholder="Ime"
          value={firstDraft}
          onChange={(e) => setFirstDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitName(firstDraft, lastDraft)}
        />
        <input
          style={styles.inputName}
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

  // The whole set the open photo belongs to, so the lightbox can move within
  // it. Deleting the current one drops it out of the list, findIndex returns
  // -1 and the lightbox closes on its own.
  const lightboxPhotos =
    lightbox && window.photos
      ? dayPhotos[photoGroup(lightbox.iso, lightbox.eventId)] || []
      : [];
  const lightboxIndex = lightbox
    ? lightboxPhotos.findIndex((p) => p.id === lightbox.id)
    : -1;

  const photoLightbox = lightboxIndex >= 0 && (
    <PhotoLightbox
      photos={lightboxPhotos}
      index={lightboxIndex}
      urlFor={(path) => window.photos.publicUrl(path)}
      onClose={() => setLightbox(null)}
      onSelect={(next) =>
        setLightbox({ ...lightbox, id: lightboxPhotos[next].id })
      }
      canDelete={lightboxPhotos[lightboxIndex].author === name}
      onDelete={() => deletePhoto(lightbox.iso, lightbox.eventId, lightbox.id)}
    />
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

  // The thread under an event, wherever that event is drawn. The archive
  // shows the same events the calendar does, so the comments had to stop
  // being markup buried inside the day view and become something both pages
  // can call.
  function renderPhotoStrip(iso, eventId) {
    // Guarded rather than assumed, the same way the realtime shim is: a
    // browser still holding an older cached index.html has no window.photos,
    // and the archive should quietly lack a photo row instead of failing to
    // render at all.
    if (!window.photos) return null;
    const key = photoGroup(iso, eventId);
    const photos = dayPhotos[key] || [];
    const pending = photoUploads[key] || 0;
    const inputId = `photo-input-${key}`;
    return (
      <div style={styles.photoBlock}>
        <div style={styles.photoRow}>
          {photos.map((p) => (
            <button
              key={p.id}
              style={styles.photoThumb}
              onClick={() => setLightbox({ iso, eventId, id: p.id })}
              aria-label={`Slika od ${p.author || "neznano"}`}
            >
              {/* loading="lazy" matters more here than anywhere else in the
                  app: the archive grows without bound, and every thumbnail is
                  a download against a metered egress budget. */}
              <img
                src={window.photos.publicUrl(p.path)}
                alt=""
                loading="lazy"
                style={styles.photoThumbImg}
              />
            </button>
          ))}
          {Array.from({ length: pending }, (_, i) => (
            <div key={`pending-${i}`} style={styles.photoPending}>
              <div style={styles.loadingDot} />
            </div>
          ))}
          {/* A label rather than a button, because the file input it opens
              has to stay in the DOM to be clickable but must not be seen. */}
          <label htmlFor={inputId} style={styles.photoAdd} title="Dodaj slike">
            <Plus size={16} />
            <input
              id={inputId}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                uploadPhotos(iso, eventId, e.target.files);
                // Cleared so picking the same file twice in a row still
                // fires a change event the second time.
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
    );
  }

  function renderCommentThread(iso, eventId) {
    const key = commentGroup(iso, eventId);
    const comments = dayComments[key] || [];
    const open = openComments === key;
    const draft = commentDrafts[key] || "";
    return (
      <div style={styles.commentsBlock}>
        <button
          style={styles.commentsToggle}
          onClick={() => setOpenComments(open ? null : key)}
          aria-expanded={open}
        >
          <MessageSquare size={12} />
          {comments.length > 0 ? `Komentarji (${comments.length})` : "Komentiraj"}
          <ChevronRight
            size={14}
            style={{
              transform: open ? "rotate(90deg)" : "none",
              transition: "transform 150ms ease",
            }}
          />
        </button>
        {open && (
          <div style={styles.commentsPanel}>
            {comments.length === 0 ? (
              <div style={styles.commentsEmpty}>Še ni komentarjev.</div>
            ) : (
              <div style={styles.commentsList}>
                {comments.map((c) => (
                  <div key={c.id} style={styles.commentRow}>
                    <PersonChip
                      name={c.author}
                      color={personColors[c.author] || GREEN}
                      self={c.author === name}
                    />
                    <div style={styles.commentBody}>
                      <div style={styles.commentAuthor}>{c.author}</div>
                      <div style={styles.commentText}>{c.text}</div>
                    </div>
                    {c.author === name && (
                      <button
                        style={styles.commentDelete}
                        onClick={() => deleteComment(iso, eventId, c.id)}
                        aria-label="Izbriši komentar"
                        title="Izbriši komentar"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div style={styles.commentForm}>
              <input
                style={styles.commentInput}
                placeholder="Napiši komentar"
                value={draft}
                onChange={(e) =>
                  setCommentDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && postComment(iso, eventId)}
              />
              <button
                style={{
                  ...styles.commentSubmit,
                  opacity: draft.trim() ? 1 : 0.5,
                }}
                disabled={!draft.trim()}
                onClick={() => postComment(iso, eventId)}
              >
                Objavi
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

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
        <div style={styles.eventCard(eventHues[eventKey(iso, id)])} key={id || "new"}>
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
          // Anyone mid-exit is drawn after the real attendees, so the chips
          // that are staying never shift sideways to fill the gap while the
          // leaver is still shrinking into it. The filter covers someone who
          // rejoined before their own exit finished -- they are a real
          // attendee again, and rendering both copies would collide on key.
          const ghosts = ghostChips[eventChipGroup(iso, event.id)] || [];
          const shownAttendees = ghosts.length
            ? [...event.attendees, ...ghosts.filter((n) => !event.attendees.includes(n))]
            : event.attendees;
          return (
            <div style={styles.eventCard(eventHues[eventKey(iso, event.id)])} key={event.id}>
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
              {/* Confirming removes this row rather than switching it to a
                  "you're going" state: once you're on the list your own chip
                  below says so, and it is also how you take it back. Two
                  controls for one fact would just leave them to disagree. */}
              {!attending && !ghosts.includes(name) && (
                <div style={styles.attendRow}>
                  <span style={styles.attendPrompt}>Potrdi udeležbo</span>
                  <button
                    style={styles.attendButton}
                    onClick={() => toggleAttendance(iso, event.id)}
                  >
                    Da
                  </button>
                </div>
              )}
              {shownAttendees.length > 0 && (
                <div style={styles.eventAttendees}>
                  <span style={styles.attendeesLabel}>Pridejo:</span>
                  {shownAttendees.map((n) => {
                    const anim = chipAnimation(chipAnim[attendeeChipId(iso, event.id, n)]);
                    return n === name ? (
                      <button
                        key={n}
                        className="chipButton"
                        style={{
                          ...styles.avatarChipButton(personColors[n] || GREEN),
                          ...anim,
                        }}
                        onClick={() => toggleAttendance(iso, event.id)}
                        aria-label="Odjavi udeležbo"
                        title="Odjavi udeležbo"
                      >
                        {initials(n)}
                      </button>
                    ) : (
                      <PersonChip
                        key={n}
                        name={n}
                        color={personColors[n] || GREEN}
                        style={anim}
                      />
                    );
                  })}
                </div>
              )}
              {renderCommentThread(iso, event.id)}
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

  // The oldest event that is actually in the past. An upcoming event is the
  // oldest one there is on a calendar that has only just started, and
  // reporting it as the bottom of the archive would be reporting a date the
  // archive can never reach.
  const archiveFloor =
    oldestEventIso && days.length && oldestEventIso < days[0] ? oldestEventIso : null;

  // Nothing older left to fetch: either no event has happened yet, or the
  // slabs have already reached past the oldest one that has. Stays false
  // while the floor is still unknown, so a failed probe leaves the button.
  const archiveExhausted =
    oldestEventIso !== undefined &&
    (archiveFloor === null || (!!archiveFrom && archiveFrom <= archiveFloor));

  const archivePage = (
    <>
      <div style={styles.archiveIntro}>
        <button style={styles.archiveBack} onClick={() => goTo("calendar")}>
          <ArrowLeft size={14} /> Koledar
        </button>
        <div style={styles.archiveHeading}>Arhiv</div>
        <div style={styles.archiveSubheading}>Kaj je že bilo.</div>
      </div>

      {archiveError && <div style={styles.errorBanner}>{archiveError}</div>}

      <div style={styles.archiveList}>
        {archiveEntries.length === 0 && !archiveLoading && (
          <div style={styles.archiveEmpty}>
            {archiveFrom ? "V tem obdobju ni bilo dogodkov." : "Nalagam …"}
          </div>
        )}
        {archiveEntries.map(({ iso, event }) => {
          const cardKey = `${iso}:${event.id}`;
          const open = openArchiveEvent === cardKey;
          const comments = dayComments[commentGroup(iso, event.id)] || [];
          const going = event.attendees.length;
          return (
            <div key={cardKey} style={styles.archiveCard(eventHues[eventKey(iso, event.id)])}>
              <button
                style={styles.archiveCardHead}
                onClick={() => setOpenArchiveEvent(open ? null : cardKey)}
                aria-expanded={open}
              >
                <div style={styles.archiveCardMain}>
                  <div style={styles.archiveCardDate}>{archiveDateLabel(iso)}</div>
                  <div style={styles.archiveCardTitle}>{event.title}</div>
                </div>
                <ChevronRight
                  size={18}
                  color="var(--text-faint)"
                  style={{
                    flexShrink: 0,
                    transform: open ? "rotate(90deg)" : "none",
                    transition: "transform 150ms ease",
                  }}
                />
              </button>

              {open && (
                <div style={styles.archiveCardBody}>
                  <div style={styles.archiveSummary}>
                    {event.duration && <span>{event.duration}</span>}
                    <span>
                      {going}{" "}
                      {pluralSl(going, [
                        "udeleženec",
                        "udeleženca",
                        "udeleženci",
                        "udeležencev",
                      ])}
                    </span>
                    <span>
                      {comments.length}{" "}
                      {pluralSl(comments.length, [
                        "komentar",
                        "komentarja",
                        "komentarji",
                        "komentarjev",
                      ])}
                    </span>
                    {event.keyword && <span>{event.keyword}</span>}
                  </div>

                  {event.description && (
                    <p style={styles.eventDescription}>{event.description}</p>
                  )}

                  {event.attendees.length > 0 && (
                    <div style={styles.eventAttendees}>
                      <span style={styles.attendeesLabel}>Prišli:</span>
                      {event.attendees.map((n) => (
                        <PersonChip
                          key={n}
                          name={n}
                          color={personColors[n] || GREEN}
                          self={n === name}
                        />
                      ))}
                    </div>
                  )}

                  {renderPhotoStrip(iso, event.id)}
                  {renderCommentThread(iso, event.id)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={styles.archiveMoreRow}>
        {archiveExhausted ? (
          <div style={styles.archiveRange}>
            {archiveFloor
              ? `To je vse — najstarejši dogodek je ${archiveDateLabel(archiveFloor)}.`
              : "Zaenkrat še ni preteklih dogodkov."}
          </div>
        ) : (
          <>
            <button
              style={{ ...styles.archiveMore, opacity: archiveLoading ? 0.5 : 1 }}
              disabled={archiveLoading}
              onClick={loadArchiveSlab}
            >
              {archiveLoading ? "Nalagam …" : "Naloži starejše"}
            </button>
            {archiveFrom && (
              <div style={styles.archiveRange}>
                naloženo do {archiveDateLabel(archiveFrom)}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  if (view === "archive") {
    // The same shell the calendar uses, so the navbar sits identically on
    // both pages and the desktop width limit does not stop at the boundary
    // between them.
    const shell = (
      <>
        {appHeader}
        {archivePage}
      </>
    );
    return (
      <div style={isDesktop ? styles.pageDesktop : styles.page}>
        {isDesktop ? <div style={styles.desktopContainer}>{shell}</div> : shell}
        {photoLightbox}
        {settingsModal}
      </div>
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
          {appHeader}

          {/* Above the event strip, not below it: the form belongs to the
              greeting the pencil sits in, and opening it under a strip that is
              itself sliding every 6s put it somewhere the eye had just left. */}
          {nameEditRow}
          {nameClashRow}

          {recentEventsRow}

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

            <div id={dayAnchorId(selectedIso)} style={styles.detailPanel}>
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
      {appHeader}

      {/* Above the event strip, not below it: the form belongs to the
          greeting the pencil sits in, and opening it under a strip that is
          itself sliding every 6s put it somewhere the eye had just left. */}
      {nameEditRow}
      {nameClashRow}

      {recentEventsRow}

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
          const allEntries = Object.entries(entries).sort(([a], [b]) =>
            a === name ? -1 : b === name ? 1 : a.localeCompare(b)
          );
          // Whose two initials the row shows is drawn from everyone who
          // entered, with no place kept for you -- otherwise the same handful
          // of names lead every row, every day. The chips carry each person's
          // own color here; free/busy stays the job of the entry rows inside
          // the open day, where there is room to read it.
          // The date is folded into the seed so different days pick different
          // people rather than all agreeing on one pair.
          const dayChips = shuffleBySeed(
            Object.keys(entries),
            chipSeedRef.current + iso
          ).map((n) => [n, personColors[n] || NEUTRAL_BG]);
          const hiddenChips = dayChips.length - DAY_CHIPS_SHOWN;
          const isOpen = openDay === iso;
          const isToday = iso === today;

          return (
            <div key={iso} id={dayAnchorId(iso)} style={styles.dayCard(isToday, isOpen)}>
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
                      {dayChips.slice(0, DAY_CHIPS_SHOWN).map(([n, color]) => (
                        <PersonChip key={n} name={n} color={color} self={n === name} />
                      ))}
                      {hiddenChips > 0 && (
                        <span
                          style={styles.avatarChipMore}
                          title={`Še ${hiddenChips} vnesenih`}
                        >
                          +{hiddenChips}
                        </span>
                      )}
                    </>
                  )}
                </div>
                {/* Outside dayPeople on purpose: in there it trailed whatever
                    avatars happened to be present and so landed in a different
                    spot on every row. As a sibling it is pushed to the right
                    by dayPeople's flex: 1 and lines up down the whole list. */}
                {dayEvents[iso]?.length > 0 && (
                  <span style={styles.eventBadge}>Dogodek</span>
                )}
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
