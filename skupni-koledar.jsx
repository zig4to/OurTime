import { useState, useEffect, useCallback, useRef } from "react";
import { Users, ChevronRight, Pencil, Eraser, Trash2, MessageSquare } from "lucide-react";

const GREEN = "#2F6F5E";
const GREEN_BG = "#E4F1EC";
const ORANGE = "#C6862F";
const RED = "#B4482F";
const RED_BG = "#F7E9E4";
const NEUTRAL_BG = "#F1F0EA";
const NEUTRAL_TEXT = "#AEB4AC";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const AUTH_CODE = "122333";
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

function todayIso() {
  const parts = ljubljanaParts.formatToParts(new Date());
  const part = (type) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// Date maths is done at UTC midnight so Ljubljana's DST switch (where a local
// day is 23 or 25 hours long) can never add or drop a day.
function utcFromIso(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(iso, n) {
  const dt = utcFromIso(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function dayNumber(iso) {
  return Number(iso.slice(8, 10));
}

function dayLabel(iso, today) {
  const names = ["ned", "pon", "tor", "sre", "čet", "pet", "sob"];
  if (iso === today) return "Danes";
  if (iso === addDays(today, 1)) return "Jutri";
  return names[utcFromIso(iso).getUTCDay()];
}

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// The full "Ime Priimek" string is the identity, so it gets normalised on the
// way in: without this, "tina brdnik" and "Tina Brdnik" would become two
// different people with two separate sets of entries.
function normalizeName(first, last) {
  const clean = (s) => (s || "").trim().replace(/\s+/g, " ");
  return `${capitalize(clean(first))} ${capitalize(clean(last))}`.trim();
}

function splitName(full) {
  const parts = (full || "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") };
}

function hasSurname(full) {
  return (full || "").trim().split(/\s+/).filter(Boolean).length >= 2;
}

// Keys look like "avail:2026-08-20:Ime Priimek"; everything past the second
// colon is the person, so names containing a colon survive the round trip.
function personFromKey(key) {
  const parts = key.split(":");
  return parts.length >= 3 ? parts.slice(2).join(":") : null;
}

function isoFromKey(key) {
  return key.split(":")[1] || null;
}

function blankHours() {
  return Array(24).fill(null);
}

// Encode hours array -> compact 24-char string: 'f' free, 'b' busy, '.' unset
function encodeHours(hours) {
  return hours.map((h) => (h === "free" ? "f" : h === "busy" ? "b" : ".")).join("");
}

// Decode storage value -> 24-length hours array. Handles the current
// 24-char format plus a couple of older formats for backward compatibility.
function decodeHours(raw) {
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
function encodeEntry(entry) {
  const hoursPart = encodeHours(entry.hours);
  const note = (entry.note || "").trim();
  return note ? `${hoursPart}|${encodeURIComponent(note)}` : hoursPart;
}

function decodeEntry(raw) {
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

// Short inline summary shown next to a person's name, e.g. "danes prost".
function quickStatusText(hours, dayLabelText) {
  const anySet = hours.some((h) => h !== null);
  if (!anySet) return null;
  const allFree = hours.every((h) => h === "free");
  const allBusy = hours.every((h) => h === "busy");
  const prefix = dayLabelText.toLowerCase();
  if (allFree) return `${prefix} prost`;
  if (allBusy) return `${prefix} zaseden`;
  return `${prefix} delno zaseden`;
}

// Three-tier day status for a person's avatar circle: green if free the
// whole day, orange if only part of it, red if busy all day or nothing
// was marked free at all (including a note-only entry with no hours set).
function freeBusyTier(hours) {
  const hasFree = hours.some((h) => h === "free");
  if (!hasFree) return "busy";
  return hours.every((h) => h === "free") ? "free" : "partial";
}

function dominantStatus(hours) {
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
function groupSegments(hours) {
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

function fmtHour(h) {
  return `${String(h % 24).padStart(2, "0")}:00`;
}

function entryCountLabel(n) {
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
  const [viewPerson, setViewPerson] = useState(null); // { name, hours, iso, dateText }

  const gridRef = useRef(null);
  const dragActionRef = useRef("set");
  const hasAutoOpenedRef = useRef(false);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    const start = todayIso();
    setDays(Array.from({ length: 14 }, (_, i) => addDays(start, i)));
  }, []);

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
      for (const iso of days) result[iso] = {};
      for (const row of (res && res.rows) || []) {
        const iso = isoFromKey(row.key);
        const person = personFromKey(row.key);
        if (!person || !(iso in result)) continue;
        result[iso][person] = decodeEntry(row.value);
      }
      setDayData(result);
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

  function startEditingName() {
    const parts = splitName(name);
    setFirstDraft(parts.first);
    setLastDraft(parts.last);
    setDuplicateName(null);
    setEditingName(true);
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

  async function persistEntry(iso, entry) {
    if (!name) return;
    const key = `avail:${iso}:${name}`;
    const note = (entry.note || "").trim();
    const isBlank = entry.hours.every((h) => h === null) && note === "";
    setDayData((prev) => {
      const dayEntries = { ...(prev[iso] || {}) };
      if (isBlank) {
        delete dayEntries[name];
      } else {
        dayEntries[name] = { hours: entry.hours, note };
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
    setSaved(false);
  }

  function selectDay(iso) {
    setOpenDay(iso);
    setEditingDay(null);
    setSaved(false);
  }

  function startEditing(iso) {
    const existing = dayData[iso]?.[name];
    setMyHours(existing ? [...existing.hours] : blankHours());
    setMyNote(existing?.note || "");
    setShowNoteInput(!!existing?.note);
    setEditingDay(iso);
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
    await persistEntry(iso, { hours: myHours, note: myNote });
    setEditingDay(null);
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
    await persistEntry(iso, { hours: blankHours(), note: "" });
    setMyHours(blankHours());
    setMyNote("");
    setShowNoteInput(false);
    setEditingDay(null);
    setSaved(false);
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

  const today = days[0];

  const avatarButton = (
    <button
      style={styles.avatarButton}
      onClick={startEditingName}
      aria-label="Uredi ime"
    >
      {initials(name)}
      <Pencil size={11} style={styles.pencilBadge} />
    </button>
  );

  const nameEditRow = editingName && (
    <div style={styles.editNameRow}>
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
  );

  // Renaming into a name someone else already uses would silently take over
  // their entries, so the same confirm step as the intro screen applies here.
  const nameClashRow = duplicateName && !needsSurname && (
    <div style={styles.editNameRow}>
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
                    <div style={styles.sectionLabel}>Tvoj urnik</div>
                    <div style={styles.headerButtonGroup}>
                      <button style={styles.clearButton} onClick={clearDraft}>
                        <Eraser size={12} /> Počisti
                      </button>
                      {entries[name] && (
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
                      onClick={() => setEditingDay(null)}
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
                        <button
                          key={n}
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
                              background:
                                dominantStatus(e.hours) === "free"
                                  ? GREEN
                                  : dominantStatus(e.hours) === "busy"
                                  ? RED
                                  : NEUTRAL_BG,
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
                          <ChevronRight size={15} color="#B3BBB5" />
                        </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div style={styles.footer}>
            <Users size={13} color="#9AA5A0" />
            <span>Koledar si delijo vsi, ki odprejo to povezavo</span>
          </div>
        </div>

        {viewPersonModal}
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
          const people = Object.entries(entries).filter(([n]) => n !== name);
          const allEntries = Object.entries(entries).sort(([a], [b]) =>
            a === name ? -1 : b === name ? 1 : a.localeCompare(b)
          );
          const freePeople = people.filter(([, e]) => freeBusyTier(e.hours) === "free");
          const partialPeople = people.filter(([, e]) => freeBusyTier(e.hours) === "partial");
          const busyPeople = people.filter(([, e]) => freeBusyTier(e.hours) === "busy");
          const isOpen = openDay === iso;
          const isToday = iso === today;

          return (
            <div key={iso} style={styles.dayCard(isToday)}>
              <button style={styles.dayHeader} onClick={() => openDayCard(iso)}>
                <div style={styles.dayDateBlock}>
                  <div style={styles.dayNum}>{dayNumber(d)}</div>
                  <div style={styles.dayName}>{dayLabel(d, today)}</div>
                </div>
                <div style={styles.dayPeople}>
                  {people.length === 0 ? (
                    <span style={styles.noOne}>
                      {entryCountLabel(allEntries.length)}
                    </span>
                  ) : (
                    <>
                      {freePeople.slice(0, 5).map(([n]) => (
                        <span key={n} style={styles.avatarChip(GREEN)}>
                          {initials(n)}
                        </span>
                      ))}
                      {partialPeople.slice(0, 4).map(([n]) => (
                        <span key={n} style={styles.avatarChip(ORANGE)}>
                          {initials(n)}
                        </span>
                      ))}
                      {busyPeople.slice(0, 3).map(([n]) => (
                        <span
                          key={n}
                          style={{ ...styles.avatarChip(RED), opacity: 0.55 }}
                        >
                          {initials(n)}
                        </span>
                      ))}
                    </>
                  )}
                </div>
                <ChevronRight
                  size={18}
                  color="#9AA5A0"
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
                        <div style={styles.sectionLabel}>Tvoj urnik</div>
                        <div style={styles.headerButtonGroup}>
                          <button style={styles.clearButton} onClick={clearDraft}>
                            <Eraser size={12} /> Počisti
                          </button>
                          {entries[name] && (
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
                          onClick={() => setEditingDay(null)}
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
                                    background:
                                      dominantStatus(e.hours) === "free"
                                        ? GREEN
                                        : dominantStatus(e.hours) === "busy"
                                        ? RED
                                        : NEUTRAL_BG,
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
                                <ChevronRight size={15} color="#B3BBB5" />
                              </button>
                              {n === name && (
                                <button
                                  style={styles.editEntryButton}
                                  onClick={() => startEditing(iso)}
                                  aria-label="Uredi vnos"
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
        <Users size={13} color="#9AA5A0" />
        <span>Koledar si delijo vsi, ki odprejo to povezavo</span>
      </div>

      {viewPersonModal}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#FAF9F6",
    fontFamily:
      "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
    color: "#233029",
    paddingBottom: 40,
  },
  centerScreen: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#FAF9F6",
    fontFamily:
      "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
    padding: 20,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: GREEN,
  },
  introCard: {
    width: "100%",
    maxWidth: 360,
    background: "#FFFFFF",
    borderRadius: 20,
    padding: "32px 28px",
    boxShadow: "0 1px 3px rgba(35,48,41,0.08), 0 8px 24px rgba(35,48,41,0.06)",
    border: "1px solid #EEEDE7",
  },
  introEyebrow: {
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#8A9A91",
    fontWeight: 700,
    marginBottom: 8,
  },
  introTitle: {
    fontSize: 26,
    fontWeight: 800,
    margin: "0 0 8px 0",
    color: "#1B2E24",
  },
  introText: {
    fontSize: 14.5,
    lineHeight: 1.5,
    color: "#5B6862",
    margin: "0 0 22px 0",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 14px",
    fontSize: 16,
    borderRadius: 12,
    border: "1.5px solid #E3E1D9",
    outline: "none",
    marginBottom: 14,
    background: "#FDFCFA",
  },
  primaryButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "13px 14px",
    fontSize: 15.5,
    fontWeight: 700,
    color: "#fff",
    background: GREEN,
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
  },
  introSecondaryButton: {
    width: "100%",
    marginTop: 10,
    padding: "13px 14px",
    fontSize: 14.5,
    fontWeight: 600,
    color: "#5B6862",
    background: "transparent",
    border: "1.5px solid #E3E1D9",
    borderRadius: 12,
    cursor: "pointer",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "20px 20px 24px 20px",
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#8A9A91",
    fontWeight: 700,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: 500,
    margin: 0,
    color: "#1B2E24",
  },
  headerAccent: {
    color: GREEN,
    fontWeight: 700,
  },
  avatarButton: {
    position: "relative",
    width: 42,
    height: 42,
    borderRadius: "50%",
    background: GREEN_BG,
    color: GREEN,
    border: "1px solid #CFE4DA",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  pencilBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    background: "#FAF9F6",
    borderRadius: "50%",
    padding: 2,
    color: "#5B6862",
  },
  editNameRow: {
    display: "flex",
    gap: 8,
    padding: "0 20px 8px 20px",
  },
  inputSmall: {
    flex: 1,
    padding: "9px 12px",
    fontSize: 14,
    borderRadius: 10,
    border: "1.5px solid #E3E1D9",
    outline: "none",
  },
  smallButton: {
    padding: "9px 14px",
    fontSize: 13.5,
    fontWeight: 700,
    color: "#fff",
    background: GREEN,
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
  },
  clashText: {
    flex: 1,
    alignSelf: "center",
    fontSize: 13,
    color: RED,
  },
  smallButtonGhost: {
    padding: "9px 14px",
    fontSize: 13.5,
    fontWeight: 600,
    color: "#5B6862",
    background: "transparent",
    border: "1.5px solid #E3E1D9",
    borderRadius: 10,
    cursor: "pointer",
  },
  errorBanner: {
    margin: "0 20px 10px 20px",
    padding: "9px 12px",
    fontSize: 13,
    background: RED_BG,
    color: RED,
    borderRadius: 10,
  },
  errorBannerIntro: {
    padding: "9px 12px",
    fontSize: 12.5,
    background: RED_BG,
    color: RED,
    borderRadius: 10,
    marginBottom: 14,
  },
  legend: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "4px 20px 14px 20px",
  },
  syncLabel: {
    fontSize: 11.5,
    color: "#9AA5A0",
    fontStyle: "italic",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "0 16px",
  },
  dayCard: (isToday) => ({
    background: "#FFFFFF",
    borderRadius: 16,
    border: isToday ? `1.5px solid ${GREEN}` : "1px solid #EEEDE7",
    boxShadow: isToday ? `0 0 0 3px ${GREEN_BG}` : "none",
    overflow: "hidden",
  }),
  dayHeader: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "12px 14px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
  },
  dayDateBlock: {
    width: 48,
    flexShrink: 0,
    textAlign: "center",
  },
  dayNum: {
    fontSize: 20,
    fontWeight: 800,
    color: "#1B2E24",
    lineHeight: 1.1,
  },
  dayName: {
    fontSize: 12.5,
    color: "#8A9A91",
    textTransform: "capitalize",
    fontWeight: 600,
  },
  dayPeople: {
    flex: 1,
    display: "flex",
    flexWrap: "wrap",
    gap: 5,
    alignItems: "center",
  },
  noOne: {
    fontSize: 12.5,
    color: "#B3BBB5",
    fontStyle: "italic",
  },
  emptyNote: {
    fontSize: 13,
    color: "#B3BBB5",
    fontStyle: "italic",
  },
  avatarChip: (color) => ({
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: color,
    color: "#fff",
    fontSize: 10.5,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }),
  dayDetail: {
    borderTop: "1px solid #F1F0EA",
    padding: "14px",
  },
  gridHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: 700,
    color: "#8A9A91",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  clearButton: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11.5,
    fontWeight: 600,
    color: "#8A9A91",
    background: "transparent",
    border: "1px solid #E3E1D9",
    borderRadius: 7,
    padding: "4px 8px",
    cursor: "pointer",
  },
  headerButtonGroup: {
    display: "flex",
    gap: 6,
  },
  deleteButton: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11.5,
    fontWeight: 600,
    color: RED,
    background: RED_BG,
    border: `1px solid ${RED}`,
    borderRadius: 7,
    padding: "4px 8px",
    cursor: "pointer",
  },
  modeRow: {
    display: "flex",
    gap: 8,
    marginBottom: 8,
  },
  pillButton: (active, color, bg) => ({
    flex: 1,
    padding: "9px 6px",
    fontSize: 13,
    fontWeight: 700,
    color: active ? "#fff" : color,
    background: active ? color : bg,
    border: `1.5px solid ${color}`,
    borderRadius: 9,
    cursor: "pointer",
  }),
  hint: {
    fontSize: 11.5,
    color: "#9AA5A0",
    margin: "0 0 10px 0",
    lineHeight: 1.4,
  },
  addNoteButton: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12.5,
    fontWeight: 600,
    color: GREEN,
    background: GREEN_BG,
    border: "none",
    borderRadius: 8,
    padding: "7px 10px",
    marginBottom: 14,
    cursor: "pointer",
  },
  noteBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 14,
  },
  noteTextarea: {
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    padding: "9px 11px",
    fontSize: 13.5,
    fontFamily: "inherit",
    borderRadius: 10,
    border: "1.5px solid #E3E1D9",
    outline: "none",
    background: "#FDFCFA",
    color: "#233029",
  },
  noteRemoveButton: {
    alignSelf: "flex-start",
    fontSize: 11.5,
    fontWeight: 600,
    color: RED,
    background: "transparent",
    border: "none",
    padding: "2px 0",
    cursor: "pointer",
  },
  hourGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 6,
    marginBottom: 16,
    touchAction: "none",
    userSelect: "none",
  },
  hourCell: {
    aspectRatio: "1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  saveButton: (saved) => ({
    flex: 1,
    padding: "11px",
    fontSize: 13.5,
    fontWeight: 700,
    color: "#fff",
    background: saved ? GREEN : "#1B2E24",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    transition: "background 150ms ease",
  }),
  editActionsRow: {
    display: "flex",
    gap: 8,
    marginBottom: 4,
  },
  cancelButton: {
    flex: 1,
    padding: "11px",
    fontSize: 13.5,
    fontWeight: 700,
    color: "#5B6862",
    background: "transparent",
    border: "1.5px solid #E3E1D9",
    borderRadius: 10,
    cursor: "pointer",
  },
  savedFlash: {
    fontSize: 12.5,
    fontWeight: 700,
    color: GREEN,
    background: GREEN_BG,
    borderRadius: 8,
    padding: "7px 10px",
    marginBottom: 10,
    textAlign: "center",
  },
  emptyState: {
    textAlign: "center",
    padding: "14px 8px 6px 8px",
  },
  emptyStateText: {
    fontSize: 13.5,
    color: "#8A9A91",
    margin: "0 0 12px 0",
  },
  addButton: {
    padding: "11px 20px",
    fontSize: 13.5,
    fontWeight: 700,
    color: "#fff",
    background: "#1B2E24",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
  },
  addButtonSecondary: {
    width: "100%",
    padding: "10px",
    marginTop: 6,
    fontSize: 13,
    fontWeight: 700,
    color: GREEN,
    background: GREEN_BG,
    border: "none",
    borderRadius: 9,
    cursor: "pointer",
  },
  peopleSection: {
    borderTop: "1px solid #F1F0EA",
    paddingTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  entryRow: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "9px 4px",
    background: "transparent",
    border: "none",
    borderBottom: "1px solid #F5F4EF",
    cursor: "pointer",
    textAlign: "left",
  },
  entryRowWrap: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  editEntryButton: {
    flexShrink: 0,
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: GREEN,
    background: GREEN_BG,
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    marginBottom: 1,
  },
  entryDot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    flexShrink: 0,
  },
  entryTextCol: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  entryName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#374840",
  },
  entryNoteText: {
    fontSize: 12,
    color: "#7C8A83",
    fontStyle: "italic",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  entryYou: {
    fontSize: 12,
    fontWeight: 500,
    color: "#9AA5A0",
  },
  entryQuickStatus: {
    fontSize: 12,
    fontWeight: 500,
    color: "#7C8A83",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(27,46,36,0.45)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 50,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    background: "#fff",
    borderRadius: "18px 18px 0 0",
    padding: "18px 20px 26px 20px",
    maxHeight: "78vh",
    overflowY: "auto",
    boxSizing: "border-box",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  modalEyebrow: {
    fontSize: 11,
    fontWeight: 700,
    color: "#8A9A91",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 2,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: 800,
    color: "#1B2E24",
  },
  modalNote: {
    fontSize: 13,
    color: "#5B6862",
    fontStyle: "italic",
    marginTop: 4,
  },
  modalClose: {
    fontSize: 12.5,
    fontWeight: 700,
    color: "#5B6862",
    background: "#F1F0EA",
    border: "none",
    borderRadius: 8,
    padding: "7px 12px",
    cursor: "pointer",
  },
  modalTable: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 16,
  },
  modalRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 10px",
    background: "#FAF9F6",
    borderRadius: 9,
  },
  modalTime: {
    fontSize: 14,
    fontWeight: 700,
    color: "#233029",
  },
  modalBadge: {
    fontSize: 12,
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: 999,
  },
  modalStrip: {
    display: "flex",
    gap: 1,
    marginBottom: 4,
  },
  modalStripCell: {
    flex: 1,
    height: 16,
    borderRadius: 1.5,
  },
  modalStripLabels: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10.5,
    color: "#B3BBB5",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 24,
    fontSize: 12,
    color: "#9AA5A0",
  },
  pageDesktop: {
    minHeight: "100vh",
    background: "#FAF9F6",
    fontFamily:
      "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
    color: "#233029",
    paddingBottom: 40,
  },
  desktopContainer: {
    maxWidth: 980,
    margin: "0 auto",
    padding: "0 8px",
  },
  desktopLayout: {
    display: "flex",
    gap: 20,
    alignItems: "flex-start",
    padding: "0 16px",
  },
  dayGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 6,
    width: 322,
    flexShrink: 0,
  },
  daySquare: (selected, isToday) => ({
    aspectRatio: "1",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: 9,
    border: selected || isToday ? `1.5px solid ${GREEN}` : "1px solid #EEEDE7",
    boxShadow: !selected && isToday ? `0 0 0 3px ${GREEN_BG}` : "none",
    background: selected ? GREEN_BG : "#FFFFFF",
    cursor: "pointer",
    padding: 2,
  }),
  daySquareNum: {
    fontSize: 14.5,
    fontWeight: 800,
    color: "#1B2E24",
    lineHeight: 1.1,
  },
  daySquareLabel: {
    fontSize: 11,
    color: "#8A9A91",
    textTransform: "capitalize",
    fontWeight: 600,
  },
  daySquareDots: {
    display: "flex",
    gap: 3,
    marginTop: 2,
    height: 6,
  },
  miniDot: (color) => ({
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: color,
    display: "inline-block",
  }),
  detailPanel: {
    flex: 1,
    background: "#FFFFFF",
    borderRadius: 16,
    border: "1px solid #EEEDE7",
    padding: 20,
    minHeight: 380,
  },
  detailHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 14,
    borderBottom: "1px solid #F1F0EA",
  },
  detailDateNum: {
    fontSize: 24,
    fontWeight: 800,
    color: "#1B2E24",
    lineHeight: 1.1,
  },
  detailDateLabel: {
    fontSize: 12.5,
    color: "#8A9A91",
    textTransform: "capitalize",
    fontWeight: 600,
  },
  editEntryButtonLg: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    fontWeight: 700,
    color: GREEN,
    background: GREEN_BG,
    border: "none",
    borderRadius: 9,
    padding: "9px 14px",
    cursor: "pointer",
  },
  hourGridDesktop: {
    display: "grid",
    gridTemplateColumns: "repeat(12, 1fr)",
    gap: 5,
    marginBottom: 16,
    touchAction: "none",
    userSelect: "none",
  },
  hourCellDesktop: {
    aspectRatio: "1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    fontSize: 11.5,
    fontWeight: 700,
    cursor: "pointer",
  },
};
