# Feature Specification: Unified command bar

**Feature Branch**: `007-unified-command-bar`  
**Created**: 2026-10-02  
**Status**: Draft  
**Input**: User description: "The terminal has two rows of controls (the spec 006 suggestion row and the original menu bar), which looks cluttered on a phone and splits attention. Merge them into one smart bar docked at the bottom: context-aware suggestions plus an always-last '☰ all' item that opens the full command list. Shorten the welcome hint and stop the rotating prompt example from repeating a visible chip."

## Clarifications

### Session 2026-10-02

Decisions taken from the request and the shipped spec 006 (no open questions):

- The bar is docked where the menu bar is today (bottom of the terminal window, thumb zone on phones) and keeps sitting above the on-screen keyboard.
- `suggestionsFor()` content rules are unchanged; only where and how suggestions are shown changes.
- The full command list moves into an "all commands" sheet; nothing that was in the menu bar becomes unreachable.
- The desktop-only "Press ? for shortcuts" text moves from the separate footer line into the welcome hint, so the footer line is removed.
- The arrow-key menu inside `WelcomeScreen` is never shown today (`showMenu={false}`); it is retired, and arrow-key navigation lives in the bar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One bar instead of two (Priority: P1)

A visitor on a phone sees the welcome, a short hint, the prompt, and a single row of chips at the bottom: a few next steps, one highlighted assistant question, and "☰ all" at the end. Tapping a chip runs it exactly as if typed. The row changes after each command.

**Why this priority**: the clutter is the reported problem; one bar frees about a third of a phone screen for content.

**Independent Test**: load the site at 320 px and 1280 px; confirm there is exactly one control row, chips run their commands, and the row changes after each command.

**Acceptance Scenarios**:

1. **Given** any visitor, **When** the terminal is ready for input, **Then** exactly one command bar is shown, below the prompt, and the old inline suggestion row and old menu bar no longer exist.
2. **Given** the bar, **When** it is shown, **Then** it holds the current `suggestionsFor()` items followed by "☰ all" as the last item.
3. **Given** a command runs, an answer streams, a sequence, boot or tour plays, or chat mode is active, **When** the screen updates, **Then** the bar's chips are hidden or inert, without the layout jumping.
4. **Given** the assistant chip, **When** it is shown, **Then** it is visually distinct (filled accent, ✦ mark) and its accessible name is "Ask the assistant: …"; command chips stay outlined.
5. **Given** a phone, **When** the bar is shown, **Then** it is one horizontally scrollable line, chips are at least 44 px tall, there is no horizontal page scroll at 320 px, and the bar sits directly above the on-screen keyboard when it is open.
6. **Given** a desktop, **When** the bar is focused, **Then** Left/Right move between chips, Home/End jump to the first/last, Enter/Space activate; on wide screens all items fit one line without scrolling.

---

### User Story 2 - All commands sheet (Priority: P2)

"☰ all" opens the full command list, grouped (About me / Work / Explore). On phones it is a bottom sheet, on desktop a popover above the bar. Choosing an item runs it and closes the sheet.

**Why this priority**: keeps every former menu command reachable once the menu bar is gone.

**Independent Test**: open the sheet with mouse, keyboard and touch; run every item; check Esc and focus behaviour.

**Acceptance Scenarios**:

1. **Given** the sheet is opened, **When** it appears, **Then** it is an accessible dialog with a heading listing every command the old menu bar offered, grouped.
2. **Given** the sheet is open, **When** the visitor presses Esc or activates the close control, **Then** it closes and focus returns to the prompt; Tab stays inside the sheet while it is open.
3. **Given** the sheet is open, **When** an item is chosen, **Then** it runs through the same submit path as typing (output, history, address bar) and the sheet closes.
4. **Given** the sheet is opened or an item is chosen, **When** counters are recorded, **Then** `command_sheet_opens` and `suggestion_taps` are counted.

---

### User Story 3 - Less repeated hint text (Priority: P3)

The welcome hint reads "Tap a suggestion, or just type a command or question." (desktop adds "Press ? for shortcuts."). The rotating prompt example never repeats something currently shown as a chip.

**Why this priority**: removes wording that points at a bar that no longer exists, and duplicate hints.

**Independent Test**: read the welcome on phone and desktop; let the prompt example rotate while chips are visible and confirm no example matches a chip.

**Acceptance Scenarios**:

1. **Given** the welcome on a touch device, **When** it is shown, **Then** the hint is "Tap a suggestion, or just type a command or question." with no mention of arrow keys or a menu below.
2. **Given** the welcome on a fine-pointer device, **When** it is shown, **Then** the hint also says "Press ? for shortcuts." and no separate footer line repeats it.
3. **Given** chips are visible, **When** the prompt example rotates, **Then** it never shows an example whose command or question equals a visible chip's line; if every example is visible, it shows `try: neofetch`.

### Edge Cases

- Chat mode: the bar is hidden; `exit`/Esc leaves chat as today.
- Deep links: the bar appears after the linked command's output like after any command.
- A visitor typing in the prompt while the sheet opens: the typed text is kept.
- `clear`: the bar stays (it is not part of the output log).
- The `?` shortcut sheet and the all-commands sheet are never open at the same time.
- curl output is unchanged apart from the welcome hint text, which curl does not print today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The terminal MUST render exactly one command bar, docked at the bottom of the terminal window below the prompt; the inline suggestion row and the menu bar MUST be removed.
- **FR-002**: The bar MUST show the items from `suggestionsFor()` (rules unchanged) followed by an "all commands" item as the last item.
- **FR-003**: Chips and sheet items MUST run through the single existing submit path used for typed input.
- **FR-004**: The bar MUST be hidden or inert while a command runs, an answer streams, a sequence/boot/tour plays, or in chat mode, without layout shift.
- **FR-005**: The assistant chip MUST be visually distinct with a ✦ mark and accessible name "Ask the assistant: <question>", with sufficient contrast in every theme.
- **FR-006**: The all-commands sheet MUST list every item `getMenuItems()` returns, grouped by a shared, render-agnostic grouping; it MUST be an accessible dialog (heading, focus trap, Esc closes, focus returns to the prompt), a bottom sheet on coarse pointers and a popover above the bar on fine pointers.
- **FR-007**: The bar MUST support Left/Right, Home/End and Enter/Space keyboard navigation (roving focus).
- **FR-008**: The shared welcome hint MUST be "Tap a suggestion, or just type a command or question."; the web host MAY append the shared desktop text "Press ? for shortcuts." on fine pointers. Shared code MUST NOT check the browser.
- **FR-009**: The rotating prompt example MUST skip examples whose line matches a visible chip, falling back to `try: neofetch`.
- **FR-010**: On phones the bar MUST be a single horizontally scrollable line with ≥ 44 px targets, no horizontal page scroll at 320 px, and directly above the on-screen keyboard.
- **FR-011**: The usage report MUST count `command_sheet_opens`, and `suggestion_taps` MUST include taps on sheet items.

### Key Entities

- **Menu group**: a heading and the command names under it, derived from the registry's menu commands.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: One control row on screen at 320 px and 1280 px.
- **SC-002**: Every former menu command is reachable via the sheet with mouse, keyboard and touch.
- **SC-003**: No horizontal page scrolling at 320 px.
- **SC-004**: Accessibility checks report no serious or critical issues in each terminal theme with the bar and the sheet open.
- **SC-005**: First terminal output still appears in under 1.5 s on a mid-range phone (Constitution VII).

## Assumptions

- Menu grouping is UI metadata in shared code, not portfolio content.
- The spec 006 suggestion rules, tour, `?` shortcut sheet, presence badge and "Regular view" button are unchanged.
