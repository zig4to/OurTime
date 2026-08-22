// Accent colors and every neutral/text/border/background color in the
// `styles` object below are CSS custom properties, not literal hex values,
// so the whole app re-themes just by swapping which :root[data-theme=...]
// block is active (see THEME_CSS / applyTheme in skupni-koledar.jsx) -- no
// per-render style recomputation needed.
export const GREEN = "var(--green)";
export const GREEN_BG = "var(--green-bg)";
export const ORANGE = "var(--orange)";
export const RED = "var(--red)";
export const RED_BG = "var(--red-bg)";
export const PINK = "var(--pink)";
export const NEUTRAL_BG = "var(--divider)";
export const NEUTRAL_TEXT = "var(--neutral-text)";

// Shared by the plain chip and its clickable variant so the two cannot drift
// apart -- they have to stay pixel-identical, since the only thing marking one
// as interactive is the cursor.
function avatarChipStyle(color) {
  return {
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
    // An element shrinking away under the cursor reads to the browser like
    // the start of a drag-select, which paints a highlight across the
    // initials. There is nothing here worth selecting anyway.
    userSelect: "none",
    WebkitUserSelect: "none",
  };
}

// Saying yes to an event, or taking it back, moves exactly one chip on a card
// that is otherwise unchanged -- easy to miss, and on a shared calendar the
// whole point is knowing it registered. So the chip pops in and shrinks away
// instead of blinking in and out.
//
// The @keyframes themselves are in THEME_CSS: inline styles cannot declare
// them. Only the choice of which one runs lives here, so the timings stay
// with the rest of the visual language rather than in the click handler --
// which also needs the exit duration, to wait out the animation before the
// chip is dropped from state.
export const CHIP_ENTER_MS = 260;
export const CHIP_EXIT_MS = 170;

export function chipAnimation(state) {
  if (state === "in") {
    // Overshoot on the way in: the chip settles slightly past full size
    // before landing, which reads as an arrival rather than a repaint.
    return { animation: `chipIn ${CHIP_ENTER_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)` };
  }
  if (state === "out") {
    // "forwards" holds the last frame, so the chip cannot flash back to full
    // size in the gap between the animation ending and React unmounting it.
    return { animation: `chipOut ${CHIP_EXIT_MS}ms ease-in forwards` };
  }
  return null;
}

const inputSmallStyle = {
  flex: 1,
  minWidth: 0,
  boxSizing: "border-box",
  padding: "9px 12px",
  fontSize: 14,
  borderRadius: 10,
  border: "1.5px solid var(--border-input)",
  outline: "none",
  background: "var(--input-bg)",
  color: "var(--text)",
};

// The two small labels inside an event card -- "Potrdi udeležbo" beside the
// confirm button and "Pridejo:" in front of the chips -- sit a few lines apart
// and have to read as the same kind of text, so they share one definition
// rather than two copies free to drift.
const eventCardLabel = {
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--text-secondary)",
};

export const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--bg)",
    fontFamily:
      "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    color: "var(--text)",
    paddingBottom: 40,
  },
  centerScreen: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg)",
    fontFamily:
      "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
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
    background: "var(--card-bg)",
    borderRadius: 20,
    padding: "32px 28px",
    boxShadow: "0 1px 3px rgba(35,48,41,0.08), 0 8px 24px rgba(35,48,41,0.06)",
    border: "1px solid var(--border)",
  },
  introEyebrow: {
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    fontWeight: 700,
    marginBottom: 8,
  },
  introTitle: {
    fontSize: 26,
    fontWeight: 800,
    margin: "0 0 8px 0",
    color: "var(--text-heading)",
  },
  introText: {
    fontSize: 14.5,
    lineHeight: 1.5,
    color: "var(--text-secondary)",
    margin: "0 0 22px 0",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 14px",
    fontSize: 16,
    borderRadius: 12,
    border: "1.5px solid var(--border-input)",
    outline: "none",
    marginBottom: 14,
    background: "var(--input-bg)",
    color: "var(--text)",
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
    color: "var(--text-secondary)",
    background: "transparent",
    border: "1.5px solid var(--border-input)",
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
    color: "var(--text-muted)",
    fontWeight: 700,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: 500,
    margin: 0,
    color: "var(--text-heading)",
  },
  headerAccent: {
    color: GREEN,
    fontWeight: 700,
  },
  // Positioned, because the dropdown hangs off it rather than off the page.
  headerActions: {
    position: "relative",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  // Same circle as the avatar so the pair reads as one control cluster, but
  // in the neutral card colours -- the green one is you, this one is not.
  menuButton: {
    flexShrink: 0,
    width: 42,
    height: 42,
    borderRadius: "50%",
    background: "var(--card-bg)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  menuPanel: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    // Under the modal overlay's 50: opening settings from here has to cover
    // the menu, not appear behind it.
    zIndex: 40,
    minWidth: 180,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: 6,
    borderRadius: 12,
    background: "var(--card-bg)",
    border: "1px solid var(--border)",
    boxShadow: "0 14px 30px -14px rgba(20, 30, 25, 0.4)",
  },
  menuProfile: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "8px 10px",
    textAlign: "left",
    background: "transparent",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  menuProfileName: {
    minWidth: 0,
    flex: 1,
    fontSize: 13.5,
    fontWeight: 700,
    color: "var(--text-heading)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  menuProfilePencil: {
    flexShrink: 0,
    color: "var(--text-faint)",
  },
  menuDivider: {
    height: 1,
    margin: "4px 6px",
    background: "var(--divider)",
  },
  menuItem: (disabled) => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "9px 10px",
    fontSize: 13.5,
    fontWeight: 600,
    textAlign: "left",
    color: disabled ? "var(--text-faint)" : "var(--text)",
    background: "transparent",
    border: "none",
    borderRadius: 8,
    cursor: disabled ? "default" : "pointer",
  }),
  menuItemNote: {
    marginLeft: "auto",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--text-faint)",
  },
  avatarButton: {
    position: "relative",
    width: 42,
    height: 42,
    borderRadius: "50%",
    background: GREEN_BG,
    color: GREEN,
    border: "1px solid var(--avatar-border)",
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
    background: "var(--bg)",
    borderRadius: "50%",
    padding: 2,
    color: "var(--text-secondary)",
  },
  // An outlined box rather than a bare stack, so the form reads as one thing
  // that opened rather than as loose controls that appeared. The spacing is
  // margin, not padding: the outline has to stop short of the page edges and
  // keep clear of the greeting above and the event strip below.
  editNameRow: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    margin: "2px 20px 18px 20px",
    padding: "10px 12px",
    border: `1.5px solid ${GREEN}`,
    borderRadius: 14,
    background: "var(--card-bg)",
  },
  clashRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    padding: "0 20px 8px 20px",
  },
  editNameInputs: {
    display: "flex",
    gap: 8,
  },
  editNameActions: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  editNameActionsLeft: {
    display: "flex",
    gap: 8,
  },
  inputSmall: inputSmallStyle,
  // The name fields specifically: a first name and a surname are short, and
  // stretching them the full width of the form made the box look emptier the
  // wider the screen got.
  inputName: {
    ...inputSmallStyle,
    flex: "1 1 0",
    maxWidth: 150,
    padding: "7px 10px",
    fontSize: 13.5,
  },
  // Trimmed to match the name form they all live in -- these three are used
  // nowhere else, so they can be sized for it.
  smallButton: {
    padding: "7px 12px",
    fontSize: 13,
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
    padding: "7px 12px",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-secondary)",
    background: "transparent",
    border: "1.5px solid var(--border-input)",
    borderRadius: 10,
    cursor: "pointer",
  },
  smallButtonDanger: {
    padding: "7px 12px",
    fontSize: 13,
    fontWeight: 700,
    color: "#fff",
    background: RED,
    border: "none",
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
  recentEventsHeading: {
    fontSize: 12,
    fontWeight: 800,
    color: GREEN,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    padding: "0 20px",
    marginBottom: 14,
  },
  recentEventsViewport: (canSlide, dragging) => ({
    overflow: "hidden",
    // The top few pixels are also what keeps the cards' shadows from being
    // clipped by this element's own overflow: hidden.
    padding: "4px 15px 26px 15px",
    // Claim horizontal gestures for the strip but leave vertical ones to the
    // page, so swiping a card never traps the page scroll on a phone.
    touchAction: canSlide ? "pan-y" : "auto",
    cursor: canSlide ? (dragging ? "grabbing" : "grab") : "default",
    // A mouse drag across text would otherwise select it mid-swipe.
    userSelect: dragging ? "none" : "auto",
  }),
  recentEventsTrack: (extendedCount, index, animate, dragPx) => ({
    display: "flex",
    width: `${(extendedCount / 3) * 100}%`,
    // The slot offset is a percentage of the (much wider) track, while the
    // drag arrives as raw viewport pixels; calc() is what lets the two mix.
    transform: `translateX(calc(-${index * (100 / extendedCount)}% + ${dragPx}px))`,
    transition: animate ? "transform 500ms ease" : "none",
  }),
  recentEventSlot: (percent) => ({
    flex: `0 0 ${percent}%`,
    minWidth: 0,
    boxSizing: "border-box",
    padding: "0 5px",
    position: "relative", // anchors recentEventsSeam to this card's gutter
  }),
  // Marks where the loop comes back around: a 1px rule in the 10px gutter
  // between the last card and the first, sitting on the boundary and inset
  // from the card's full height so it reads as drawn rather than as a table
  // border.
  recentEventsSeam: {
    position: "absolute",
    top: "16%",
    bottom: "16%",
    right: 0,
    width: 1,
    borderRadius: 1,
    background: GREEN,
  },
  // Rendered as a <button> (it opens the event's day), so it carries the
  // usual button resets: without them the card would pick up the UA's font
  // and centre its text.
  recentEventCard: (hue, dragging) => ({
    font: "inherit",
    color: "inherit",
    textAlign: "left",
    // While a drag is in flight the whole strip is being grabbed, so the
    // cursor should say that rather than advertise a click that won't happen.
    cursor: dragging ? "grabbing" : "pointer",
    aspectRatio: "1",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    borderRadius: 14,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    gap: 4,
    background: `rgba(${hue}, 0.16)`,
    border: `1px solid rgba(${hue}, 0.32)`,
    boxShadow: `0 8px 18px -9px rgba(${hue}, 0.28), 0 1px 4px rgba(20, 30, 25, 0.05)`,
    overflow: "hidden",
  }),
  // The card is a fixed square, so its vertical budget is fixed too. A card
  // that also shows a keyword has one more row to fit, and a title wrapping
  // to a second line is what pushes the keyword out; clamp it to one line
  // and ellipsize. Without a keyword there's room to spare, so a long name
  // is better wrapped over two lines than cut short.
  //
  // The two clamps use different mechanisms on purpose: -webkit-box is the
  // only way to ellipsize at a line *count*, but at one line it can't
  // ellipsize a single word longer than the card (it just clips), which
  // nowrap + text-overflow handles correctly.
  recentEventTitle: (singleLine) => ({
    fontSize: 14,
    fontWeight: 800,
    color: "var(--text-heading)",
    lineHeight: 1.2,
    marginBottom: 2,
    minWidth: 0,
    overflow: "hidden",
    ...(singleLine
      ? { textOverflow: "ellipsis", whiteSpace: "nowrap" }
      : {
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }),
  }),
  recentEventDate: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
  },
  recentEventTime: {
    fontSize: 16,
    fontWeight: 800,
    color: "var(--text-heading)",
  },
  recentEventKeyword: {
    fontSize: 11.5,
    fontWeight: 600,
    color: "var(--text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  syncLabel: {
    fontSize: 11.5,
    color: "var(--text-faint)",
    fontStyle: "italic",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "0 16px",
  },
  dayCard: (isToday, isOpen) => ({
    background: "var(--card-bg)",
    borderRadius: 16,
    border:
      isOpen || isToday ? `1.5px solid ${GREEN}` : "1px solid var(--border)",
    // No outer ring on today: the green border already says which day it is,
    // and the halo read as a stray glow around one card in an otherwise flat
    // list.
    boxShadow: "none",
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
    color: "var(--text-heading)",
    lineHeight: 1.1,
  },
  dayName: {
    fontSize: 12.5,
    color: "var(--text-muted)",
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
    color: "var(--text-fainter)",
    fontStyle: "italic",
  },
  emptyNote: {
    fontSize: 13,
    color: "var(--text-fainter)",
    fontStyle: "italic",
  },
  avatarChip: avatarChipStyle,
  // The overflow count in a day row. Same circle as a person's chip so the
  // group still reads as one run, but neutral: it stands for a number, and any
  // of the status colors would claim those people are free, partly free or
  // busy when the whole point is that they aren't shown.
  avatarChipMore: {
    ...avatarChipStyle(NEUTRAL_BG),
    color: NEUTRAL_TEXT,
  },
  // Your own chip on an event is how you withdraw again, so it is a real
  // button rather than a span. Same pixels as the others: the initials being
  // yours is what marks it, not a different look.
  avatarChipButton: (color) => ({
    ...avatarChipStyle(color),
    fontFamily: "inherit",
    border: "none",
    padding: 0,
    cursor: "pointer",
    // Native button painting, and the highlight some browsers flash on tap,
    // are both square -- wrong shape for a circle, and now visible for as
    // long as the withdrawal animation runs. The focus ring is not dropped
    // here but reshaped: see .chipButton in THEME_CSS, which restores a
    // round one for keyboard users.
    appearance: "none",
    WebkitAppearance: "none",
    WebkitTapHighlightColor: "transparent",
  }),
  eventBadge: {
    height: 26,
    flexShrink: 0,
    boxSizing: "border-box",
    padding: "0 9px",
    borderRadius: 13,
    background: PINK,
    color: "#fff",
    fontSize: 9.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.02em",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
  },
  dayDetail: {
    borderTop: "1px solid var(--divider)",
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
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  clearButton: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11.5,
    fontWeight: 600,
    color: "var(--text-muted)",
    background: "transparent",
    border: "1px solid var(--border-input)",
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
    color: "var(--text-faint)",
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
    border: "1.5px solid var(--border-input)",
    outline: "none",
    background: "var(--input-bg)",
    color: "var(--text)",
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
    background: saved ? GREEN : "var(--surface-strong)",
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
    color: "var(--text-secondary)",
    background: "transparent",
    border: "1.5px solid var(--border-input)",
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
    color: "var(--text-muted)",
    margin: "0 0 12px 0",
  },
  addButton: {
    padding: "11px 20px",
    fontSize: 13.5,
    fontWeight: 700,
    color: "#fff",
    background: "var(--surface-strong)",
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
    borderTop: "1px solid var(--divider)",
    paddingTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  addEventButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "7px 11px",
    marginTop: -12,
    marginBottom: 6,
    fontSize: 12.5,
    fontWeight: 700,
    color: GREEN,
    background: GREEN_BG,
    border: `1.5px dashed ${GREEN}`,
    borderRadius: 9,
    cursor: "pointer",
  },
  eventTimeRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  eventTimeSep: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--text-secondary)",
  },
  // Takes the same hue the event's card carries in the strip, so one event is
  // one color wherever it appears. Falls back to green when there is no hue --
  // an event still being created has no identity to have been assigned one.
  eventCard: (hue) => ({
    background: hue ? `rgba(${hue}, 0.16)` : GREEN_BG,
    border: hue ? `1px solid rgba(${hue}, 0.42)` : `1px solid ${GREEN}`,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  }),
  eventHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  // Side by side rather than stacked: edit on the left, add-another on the
  // right, so the pair reads as one control group instead of two unrelated
  // buttons down the card's edge.
  eventHeaderActions: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  // Reads as heading text, not as an accent: green made sense when every
  // event card was green, but the card now takes the event's own hue and the
  // green sat oddly on all the others. The token follows the theme, so this is
  // near-black on light and near-white on dark -- the same ink as the title
  // right below it.
  eventEyebrow: {
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--text-heading)",
  },
  eventEyebrowMeta: {
    fontSize: 11.5,
    textTransform: "none",
    letterSpacing: "normal",
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "var(--text-heading)",
    marginTop: 2,
  },
  eventDuration: {
    fontSize: 12,
    color: "var(--text-secondary)",
    marginTop: 2,
  },
  eventDescription: {
    fontSize: 13,
    color: "var(--text-strong)",
    lineHeight: 1.4,
    margin: 0,
  },
  // Prompt and button on one line. Only rendered while you are *not* on the
  // list, so there is no "already confirmed" state to style -- confirming
  // replaces the whole row with your chip in the attendee list.
  attendRow: {
    alignSelf: "flex-start",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  attendPrompt: eventCardLabel,
  attendeesLabel: eventCardLabel,
  attendButton: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    fontSize: 12.5,
    fontWeight: 700,
    color: GREEN,
    background: "var(--card-bg)",
    border: `1.5px solid ${GREEN}`,
    borderRadius: 8,
    cursor: "pointer",
  },
  commentsBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  photoBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  // A single scrolling row rather than a wrapping grid: an outing can carry a
  // dozen photos, and a grid would push the comments below it off the card
  // entirely. Sideways, the card keeps its height whatever the count.
  photoRow: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 4,
    WebkitOverflowScrolling: "touch",
  },
  photoThumb: {
    flexShrink: 0,
    width: 72,
    height: 72,
    padding: 0,
    border: "none",
    borderRadius: 10,
    overflow: "hidden",
    background: "var(--divider)",
    cursor: "pointer",
    appearance: "none",
    WebkitAppearance: "none",
  },
  // Cover, so a portrait and a landscape shot sit as the same square and the
  // row stays a straight line.
  photoThumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  // Holds the space an upload will occupy, so the row does not jump sideways
  // as each photo lands.
  photoPending: {
    flexShrink: 0,
    width: 72,
    height: 72,
    borderRadius: 10,
    background: "var(--divider)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  photoAdd: {
    flexShrink: 0,
    width: 72,
    height: 72,
    borderRadius: 10,
    border: "1.5px dashed var(--border-input)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-muted)",
    cursor: "pointer",
  },
  // Centred rather than bottom-anchored like the other modals: a photo is the
  // content here, not a sheet of controls that slid up over it.
  lightboxInner: {
    margin: "auto",
    maxWidth: "min(92vw, 900px)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  lightboxImg: {
    maxWidth: "100%",
    maxHeight: "78vh",
    objectFit: "contain",
    borderRadius: 12,
    display: "block",
  },
  lightboxBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  lightboxAuthor: {
    fontSize: 12.5,
    color: "#fff",
    opacity: 0.85,
  },
  // Its own row rather than an icon tucked in the header: it is the one
  // control on the card that reveals more of the card, and it should look
  // like it does something rather than like a label.
  commentsToggle: {
    alignSelf: "flex-start",
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 700,
    color: "var(--text-secondary)",
    background: "var(--card-bg)",
    border: "1px solid var(--border)",
    borderRadius: 9,
    cursor: "pointer",
  },
  // On the card background, not the event's hue: the thread reads as a panel
  // laid over the event rather than as more of the event.
  commentsPanel: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    background: "var(--card-bg)",
    border: "1px solid var(--border)",
  },
  // Capped and scrolling, so a long thread cannot push the rest of the day
  // off screen while the box for writing the next one stays in reach below.
  commentsList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxHeight: 220,
    overflowY: "auto",
  },
  commentsEmpty: {
    fontSize: 12.5,
    fontStyle: "italic",
    color: "var(--text-faint)",
  },
  commentRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
  },
  commentBody: {
    // Takes the slack in the row, which is what pushes the delete button to
    // the far right instead of leaving it against the text.
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },
  // Quiet until you go for it: a red button beside every one of your own
  // comments would make the thread look like a list of problems.
  commentDelete: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    padding: 0,
    color: "var(--text-faint)",
    background: "transparent",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  commentAuthor: {
    fontSize: 11.5,
    fontWeight: 700,
    color: "var(--text-heading)",
  },
  commentText: {
    fontSize: 13,
    color: "var(--text)",
    // Free text: a pasted link or one long word has to wrap rather than push
    // the panel wider than the card holding it.
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
  },
  commentForm: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  commentInput: {
    ...inputSmallStyle,
    padding: "7px 10px",
    fontSize: 13,
  },
  commentSubmit: {
    flexShrink: 0,
    padding: "7px 12px",
    fontSize: 12.5,
    fontWeight: 700,
    color: "#fff",
    background: GREEN,
    border: "none",
    borderRadius: 9,
    cursor: "pointer",
  },
  archiveIntro: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 6,
    padding: "0 20px 16px 20px",
  },
  // A way back that does not depend on finding the menu again. The menu
  // still offers it; this is the one you reach for without thinking.
  archiveBack: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
    padding: "5px 10px 5px 8px",
    fontSize: 12.5,
    fontWeight: 700,
    color: GREEN,
    background: GREEN_BG,
    border: "none",
    borderRadius: 9,
    cursor: "pointer",
  },
  archiveHeading: {
    fontSize: 22,
    fontWeight: 800,
    color: "var(--text-heading)",
  },
  archiveSubheading: {
    fontSize: 13,
    color: "var(--text-muted)",
  },
  archiveList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "0 16px",
  },
  archiveEmpty: {
    padding: "18px 4px",
    fontSize: 13,
    fontStyle: "italic",
    color: "var(--text-faint)",
  },
  // The event's own colour, but weaker than the card inside a day. These
  // stack by the dozen down a scrolling list, where the full-strength tint
  // stops reading as a highlight and starts reading as noise.
  archiveCard: (hue) => ({
    borderRadius: 14,
    overflow: "hidden",
    background: hue ? `rgba(${hue}, 0.12)` : "var(--card-bg)",
    border: hue ? `1px solid rgba(${hue}, 0.34)` : "1px solid var(--border)",
  }),
  archiveCardHead: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: 14,
    textAlign: "left",
    font: "inherit",
    color: "inherit",
    background: "transparent",
    border: "none",
    cursor: "pointer",
  },
  archiveCardMain: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  archiveCardDate: {
    fontSize: 11.5,
    fontWeight: 600,
    color: "var(--text-muted)",
  },
  // One line: this is a list you scan, and a wrapped title would break the
  // rhythm of the dates running down the left.
  archiveCardTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "var(--text-heading)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  archiveCardBody: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "0 14px 14px 14px",
  },
  // Bare spans inside, spaced rather than separated: inline styles do not
  // reach children for backgrounds, but font size and colour inherit, which
  // is all these need.
  archiveSummary: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px 14px",
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--text-secondary)",
  },
  archiveMoreRow: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    padding: "18px 16px 8px 16px",
  },
  archiveMore: {
    padding: "9px 16px",
    fontSize: 13,
    fontWeight: 700,
    color: "var(--text-secondary)",
    background: "var(--card-bg)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    cursor: "pointer",
  },
  archiveRange: {
    fontSize: 11.5,
    fontStyle: "italic",
    color: "var(--text-faint)",
  },
  eventAttendees: {
    display: "flex",
    flexWrap: "wrap",
    // The label is a flex item alongside the circles, so it has to be centred
    // against them rather than sitting on their top edge.
    alignItems: "center",
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
    borderBottom: "1px solid var(--divider-soft)",
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
    color: "var(--text-strong)",
  },
  entryNoteText: {
    fontSize: 12,
    color: "var(--text-note)",
    fontStyle: "italic",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  entryYou: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text-faint)",
  },
  entryQuickStatus: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text-note)",
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
    background: "var(--card-bg)",
    borderRadius: "18px 18px 0 0",
    borderTop: `3px solid ${GREEN}`,
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
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 2,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: 800,
    color: "var(--text-heading)",
  },
  modalNote: {
    fontSize: 13,
    color: "var(--text-secondary)",
    fontStyle: "italic",
    marginTop: 4,
  },
  modalClose: {
    fontSize: 12.5,
    fontWeight: 700,
    color: "var(--text-secondary)",
    background: "var(--divider)",
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
    background: "var(--bg)",
    borderRadius: 9,
  },
  modalTime: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--text)",
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
    color: "var(--text-fainter)",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 24,
    fontSize: 12,
    color: "var(--text-faint)",
  },
  settingsButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    margin: "16px auto 0 auto",
    padding: "9px 16px",
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--text-secondary)",
    background: "var(--card-bg)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    cursor: "pointer",
  },
  appFooterNote: {
    margin: "20px auto 0 auto",
    maxWidth: 320,
    padding: "0 20px",
    fontSize: 11,
    lineHeight: 1.5,
    color: "var(--text-fainter)",
    textAlign: "center",
  },
  themeOptionButton: (active) => ({
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "11px 6px",
    fontSize: 13.5,
    fontWeight: 700,
    color: active ? "#fff" : GREEN,
    background: active ? GREEN : GREEN_BG,
    border: `1.5px solid ${GREEN}`,
    borderRadius: 9,
    cursor: "pointer",
  }),
  pageDesktop: {
    minHeight: "100vh",
    background: "var(--bg)",
    fontFamily:
      "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    color: "var(--text)",
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
    border: selected || isToday ? `1.5px solid ${GREEN}` : "1px solid var(--border)",
    boxShadow: !selected && isToday ? `0 0 0 3px ${GREEN_BG}` : "none",
    background: selected ? GREEN_BG : "var(--card-bg)",
    cursor: "pointer",
    padding: 2,
  }),
  daySquareNum: {
    fontSize: 14.5,
    fontWeight: 800,
    color: "var(--text-heading)",
    lineHeight: 1.1,
  },
  daySquareLabel: {
    fontSize: 11,
    color: "var(--text-muted)",
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
    background: "var(--card-bg)",
    borderRadius: 16,
    border: "1px solid var(--border)",
    padding: 20,
    minHeight: 380,
  },
  detailHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 14,
    borderBottom: "1px solid var(--divider)",
  },
  detailDateNum: {
    fontSize: 24,
    fontWeight: 800,
    color: "var(--text-heading)",
    lineHeight: 1.1,
  },
  detailDateLabel: {
    fontSize: 12.5,
    color: "var(--text-muted)",
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
