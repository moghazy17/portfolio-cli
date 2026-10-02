# Feature Specification: Living Portfolio (GUI mode, terminal motion, presence and guestbook)

**Feature Branch**: `005-living-portfolio`  
**Created**: 2026-10-02  
**Status**: Draft  
**Input**: User description: "The portfolio feels alive, works for non-technical visitors, and shows it's a live place. US1 (P1) GUI mode: non-technical visitors (recruiters, HR) can switch to a clean conventional page with the same content (hero, about, experience timeline, project cards, skills, contact, CV download) by typing gui or startx, via a visible button for first-time visitors, or by direct URL. They can return to the terminal anytime. Polished on mobile and desktop, light and dark. US2 (P2) Terminal motion: first-time visitors see a short, skippable boot sequence that never shows again; output types out progressively; the name banner reveals with a brief glitch; a 'crt' theme adds scanlines, curvature and glow; after a minute idle a matrix-rain screensaver starts and stops on input; skills show as animated ASCII bars. Everything respects reduced-motion settings. SSH gets a lighter version of the boot and typing effects. US3 (P3) Presence and guestbook: visitors see how many people are exploring right now across web and SSH (who), read a guestbook, and sign it with a short message and name. Messages are length-limited, filtered, rate-limited, and I can delete any entry."

## Clarifications

### Session 2026-10-02

- Q (from planning): How often can a visitor sign, and how many entries are kept? → A: 1 signature per visitor per day; the guestbook keeps the newest 200 entries.
- Q: Where should the plain site address take a visitor who last used the regular page? → A: Remember the last view per browser; the plain address opens the regular page for them. Deep links always open the terminal.
- Q: Which output should type out progressively? → A: Only outputs of up to 40 lines (still capped at 1.5 seconds); longer outputs appear instantly.
- Q: Should signing the guestbook need a bot check beyond limits and filtering? → A: Yes — a free, usually invisible human check when signing on the web; a failed or missing check refuses the signature.
- Q: What visual direction should the regular page take? → A: A clean, conventional, professional layout with small terminal accents (monospace touches, the site's accent colour); it follows the device's light/dark preference, not the visitor's terminal theme.
- Q: What should the animated skill bars in `skills` measure? → A: GitHub evidence — bar length comes from the nightly GitHub technology inventory (how many public repositories use each skill), so no self-rated levels are added to the content.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - GUI mode for non-technical visitors (Priority: P1)

A recruiter opens the portfolio from a CV link and sees a terminal. They are not comfortable typing commands. A clearly visible button ("View as a regular page" or similar) is on screen from the first moment; clicking it switches to a clean, conventional web page with the same content: a hero with name, title and a short pitch; an about section; an experience timeline; project cards; skills; contact details; and a CV download. Technical visitors can reach the same page by typing `gui` or `startx`, and anyone can open it directly from its own address, so a recruiter can be sent straight there. A clearly visible control on the page takes the visitor back to the terminal at any time. The page reads well on a phone and on a desktop, and in both light and dark appearance.

**Why this priority**: The people who decide on hiring are often non-technical. If they bounce off the terminal, the portfolio fails at its main job. This story makes every piece of content reachable without typing a single command.

**Independent Test**: As a first-time visitor on a phone and on a desktop, find and use the button to reach the page, check each content section against the terminal's output, download the CV, return to the terminal; then type `gui` and `startx`, and open the page's own address directly, in light and dark appearance.

**Acceptance Scenarios**:

1. **Given** a first-time visitor on the terminal, **When** the page has loaded, **Then** a clearly labelled button to switch to the regular page is visible without scrolling, typing or opening a menu, on both phone and desktop sizes.
2. **Given** a visitor on the terminal, **When** they type `gui` or `startx` (or click the button), **Then** they see the regular page with hero, about, experience timeline, project cards, skills, contact and CV download.
3. **Given** anyone with the regular page's own address, **When** they open it, **Then** the regular page loads directly, with no terminal shown first.
4. **Given** a visitor on the regular page, **When** they use the "back to terminal" control, **Then** the terminal is shown, ready for input, without a full reload of content they already had.
5. **Given** the portfolio content has been updated, **When** a visitor views the terminal and the regular page, **Then** both show the same, current content (same roles, dates, projects, skills, contact details and CV file).
6. **Given** a visitor whose device prefers dark appearance (or light), **When** they open the regular page, **Then** it follows that preference, with readable contrast in both.
7. **Given** a visitor on the regular page, **When** they click the CV download, **Then** the same CV file the terminal's `resume` command offers is downloaded.
8. **Given** a visitor on a phone-sized screen, **When** they view the regular page, **Then** all sections fit the width without sideways scrolling, and tap targets are comfortably sized.
9. **Given** a returning visitor who last used the regular page, **When** they open the plain site address, **Then** the regular page opens; **When** they open a deep link, **Then** the terminal opens and runs it.

---

### User Story 2 - Terminal motion (Priority: P2)

The terminal should feel like a living machine rather than a static page. A first-time visitor sees a short boot sequence (a few seconds of startup lines) that they can skip with any key or tap, and that never shows again on that browser. Command output types out progressively instead of appearing all at once. The name banner in the welcome reveals with a brief glitch. A new `crt` theme adds scanlines, a slight screen curvature and phosphor glow. After a minute without input, a matrix-rain screensaver fills the terminal and disappears as soon as the visitor presses a key, moves the pointer, scrolls or taps, with the terminal exactly as they left it. The `skills` command shows skills as ASCII bars that fill in. All of this is turned off or reduced to instant, still output for visitors whose device asks for reduced motion. When the SSH terminal ships, it gets a lighter version of the boot and typing effects.

**Why this priority**: This is what makes the portfolio memorable and shows craft, but every piece of content is already reachable without it, so it ranks below GUI mode.

**Independent Test**: In a fresh browser, watch and skip the boot sequence, reload and confirm it does not return; run commands and watch output type out and skip it; switch to `crt`; leave the terminal idle for a minute and dismiss the screensaver; run `skills`; then repeat with reduced motion turned on and confirm everything is instant and still.

**Acceptance Scenarios**:

1. **Given** a visitor who has never seen the boot sequence on this browser, **When** they open the terminal at the plain site address, **Then** a boot sequence lasting no more than about 3 seconds plays before the welcome, with a visible hint that any key or tap skips it.
2. **Given** the boot sequence is playing, **When** the visitor presses any key or taps, **Then** it ends immediately and the welcome is shown.
3. **Given** a visitor has seen (or skipped) the boot sequence, **When** they return to the site later on the same browser, **Then** the boot sequence does not play.
4. **Given** a visitor runs a command, **When** the output appears, **Then** an output of up to 40 lines types out progressively, finishing within about 1.5 seconds, and pressing a key or running the next command completes it instantly; an output longer than 40 lines appears instantly.
5. **Given** the welcome is shown, **When** the name banner appears, **Then** it reveals with a brief glitch (under 1 second) and settles into the normal banner; a key press or tap during the glitch settles it at once.
6. **Given** a visitor runs `theme crt`, **When** the theme applies, **Then** the terminal shows scanlines, a subtle curvature and glow, text stays legible, and the theme is remembered like any other theme.
7. **Given** the terminal is idle for 60 seconds with no answer streaming and no sequence playing, **When** the minute passes, **Then** a matrix-rain screensaver starts; **When** the visitor presses a key, moves the pointer, scrolls or taps, **Then** it stops at once, the input that dismissed it is not lost or misapplied, and the terminal is unchanged.
8. **Given** a visitor runs `skills`, **When** the output appears, **Then** each skill shows as an ASCII bar that fills to a length based on how many of Ahmed's public repositories use it, with the repository count shown next to the bar.
9. **Given** a visitor whose device requests reduced motion, **When** they use the terminal, **Then** there is no boot sequence, no typing effect, no glitch, no screensaver and no bar animation (bars show at their final state), and the `crt` theme keeps its look without flicker or movement.

---

### User Story 3 - Presence and guestbook (Priority: P3)

The portfolio shows it is a live place. A visitor types `who` and sees how many people are exploring right now (and, once SSH ships, how many of them are on web and how many on SSH). They type `guestbook` to read recent entries left by other visitors, each with a name, a short message and when it was left. They can sign it with a short message and a name. Messages are kept short, are filtered for abuse, and each visitor can sign only a few times. Ahmed can delete any entry.

**Why this priority**: Delightful and social, but it adds stored, visitor-written content that needs protection, and it is the least important for the portfolio's core job, so it comes last.

**Independent Test**: Open the terminal in two browsers and check `who` counts both; read the guestbook; sign it; try an overlong message, a message with blocked words and repeated signing; then delete an entry as the owner and confirm it disappears.

**Acceptance Scenarios**:

1. **Given** two visitors have the site open, **When** either runs `who`, **Then** the count shown is at least 2, and visitors who left more than about 2 minutes ago are no longer counted.
2. **Given** the guestbook has entries, **When** a visitor runs `guestbook`, **Then** they see the newest entries first, each with name, message and a relative time ("3 days ago"), and are told how to sign it.
3. **Given** a visitor signs the guestbook with a name and a message within the limits, **When** they submit, **Then** the entry appears in the guestbook for everyone immediately and they see a thank-you.
4. **Given** a message longer than 140 characters or a name longer than 24 characters, **When** the visitor submits, **Then** it is rejected with a message stating the limit, and nothing is stored.
5. **Given** a message or name containing blocked words, links or contact details, **When** the visitor submits, **Then** it is rejected with a neutral message, and nothing is stored.
6. **Given** a visitor has already signed once in the last 24 hours, **When** they try to sign again, **Then** they are told to try again later and nothing is stored.
7. **Given** Ahmed (the owner) wants to remove an entry, **When** the owner deletes it using the owner-only method, **Then** it no longer appears to anyone; nobody else can delete entries.
8. **Given** a visitor on the regular page (GUI mode), **When** they scroll to the guestbook section, **Then** they can read it and sign it there too.

---

### Edge Cases

- A visitor arriving by a deep link (spec 004) skips the boot sequence and sees the linked command's output straight away; the boot is not marked as seen, so it can still play on a later plain visit.
- The boot sequence, typing effect and screensaver never run over curl; curl output stays exactly as in spec 004.
- `gui` and `startx` over curl return a short message with the regular page's address. `who` and `guestbook` (read-only) work over curl; signing does not.
- `gui` and `startx` from a deep link show the regular page (switching the view is display only, not an action on the visitor's behalf).
- If the browser's stored "boot seen" flag cannot be read or written (private mode, blocked storage), the boot plays at most once per page load and never repeats within the session.
- A very long output (for example `cat` of a long file) appears instantly rather than typing; piped output and assistant answers (which already stream) are not re-typed.
- The screensaver never starts while an assistant answer is streaming, a sequence is playing, the tab is hidden, or the visitor is on the regular page.
- On the regular page, if the CV file is unavailable, the download control shows a clear message instead of a broken link.
- If presence counting is unavailable, `who` says the live count is unavailable instead of showing a wrong number; the rest of the site keeps working.
- If guestbook storage is unavailable, reading shows "guestbook unavailable right now" and signing is refused without losing the visitor's typed text.
- Guestbook entries are shown as plain text; any markup or control characters in a submission are neutralised, never rendered.
- Empty or whitespace-only name or message is rejected; an empty guestbook shows an invitation to be the first to sign.
- The same message submitted twice in a row by the same visitor is stored once.
- If the human check fails or its service is unreachable, signing is refused with a short explanation and the typed text is kept; reading the guestbook is unaffected.
- A deleted entry disappears for visitors whose page is already open the next time they read the guestbook.

## Requirements *(mandatory)*

### Functional Requirements

**GUI mode**

- **FR-001**: The system MUST offer a regular page (GUI mode) presenting the same portfolio content as the terminal: hero (name, title, short pitch), about, experience timeline, project cards, skills, contact and CV download.
- **FR-002**: The regular page's content MUST come from the same single source of portfolio content as the terminal, so an update appears on both without separate editing.
- **FR-003**: Visitors MUST be able to switch to the regular page by typing `gui` or `startx`, by a button visible on the terminal from first load without scrolling or typing, and by opening the regular page's own address directly.
- **FR-004**: The regular page MUST have a clearly visible control on every screen size to return to the terminal.
- **FR-004a**: The system MUST remember, per browser, which view (terminal or regular page) the visitor last used, and the plain site address MUST open that view; deep links (spec 004) MUST always open the terminal, and returning to the terminal MUST update the remembered view.
- **FR-005**: The regular page MUST be usable at widths from a small phone (320 px) to a large desktop, without sideways scrolling.
- **FR-006**: The regular page MUST follow the device's light or dark preference, with readable contrast in both (meeting common accessibility contrast guidance).
- **FR-006a**: The regular page MUST use a conventional, professional layout with only small terminal accents (monospace touches, the site's accent colour), and MUST NOT take its colours from the visitor's chosen terminal theme.
- **FR-007**: The regular page MUST be navigable by keyboard and screen reader, with headings and landmarks for each section.
- **FR-008**: The regular page MUST be discoverable by search engines and share-friendly (title, description and preview when its address is shared).
- **FR-009**: The CV download on the regular page MUST deliver the same file the terminal's `resume` command offers.
- **FR-010**: Project cards MUST link to the same project details and external links the terminal shows for each project.

**Terminal motion**

- **FR-011**: The terminal MUST play a boot sequence of at most about 3 seconds on a visitor's first plain visit, skippable by any key or tap, and MUST NOT play it again on that browser once seen or skipped.
- **FR-012**: Command output of up to 40 lines MUST type out progressively, finishing within about 1.5 seconds, and MUST complete instantly when the visitor presses a key or runs another command; output longer than 40 lines MUST appear instantly.
- **FR-013**: The welcome's name banner MUST reveal with a glitch effect lasting under 1 second, and the effect MUST end at once (banner shown settled) on any key press or tap.
- **FR-014**: The system MUST offer a `crt` theme with scanlines, curvature and glow, selectable and remembered like existing themes, keeping text legible.
- **FR-015**: After 60 seconds without input, the terminal MUST show a matrix-rain screensaver, and MUST remove it at the first key press, pointer movement, scroll or tap without losing or misapplying that input or changing terminal state.
- **FR-016**: The `skills` command MUST show skills as ASCII bars that animate to their level on the web and appear at their final state wherever motion is not available (curl, reduced motion, piped output).
- **FR-016a**: Skill bar lengths MUST come from the GitHub technology inventory (count of public repositories using each skill), scaled to the most-used skill, with the count shown; if the inventory is unavailable, `skills` MUST fall back to the plain list without bars.
- **FR-017**: When the device requests reduced motion, the system MUST disable the boot sequence, typing effect, glitch, screensaver and bar animation, showing final output instantly.
- **FR-018**: Motion effects MUST NOT slow down reaching content: deep links, curl and the regular page are never delayed by them.
- **FR-019**: When the SSH terminal ships, it MUST get a lighter boot sequence and typing effect, with the same skip and reduced-motion rules (deferred with SSH; see Assumptions).

**Presence and guestbook**

- **FR-020**: A `who` command MUST show how many people are exploring right now, counting a visitor as present while their terminal or regular page is open and has checked in within about the last minute (so a visitor who leaves stops being counted within 2 minutes); once SSH ships, it MUST include SSH visitors and show the split by surface.
- **FR-021**: Presence counting MUST be anonymous: no names, addresses or identifiers are shown or kept beyond what is needed to count.
- **FR-022**: A `guestbook` command (and a guestbook section on the regular page) MUST show the most recent entries, newest first, each with name, message and relative time, up to at least the 20 latest.
- **FR-023**: Visitors MUST be able to sign the guestbook from the web terminal and the regular page with a name (1–24 characters) and a message (1–140 characters); entries appear immediately once accepted.
- **FR-024**: Submissions MUST be filtered: blocked words, links, email addresses and phone numbers are rejected, and markup or control characters are never rendered.
- **FR-025**: Signing MUST be limited to 1 entry per visitor per day and to a site-wide daily cap, and MUST fail closed (refuse) when the limit cannot be checked.
- **FR-025a**: Signing MUST pass a free, usually invisible human-verification check; a failed, missing or unverifiable check MUST refuse the signature (keeping the visitor's typed text) and store nothing.
- **FR-026**: The owner MUST be able to delete any guestbook entry by an owner-only method; nobody else can delete or edit entries.
- **FR-027**: Signing MUST NOT be available over curl; reading the guestbook and `who` MUST be.
- **FR-028**: The existing private usage report MUST include daily totals for GUI-mode visits, guestbook signatures, rejected signatures and peak concurrent visitors, without visitor addresses.

### Key Entities

- **Regular page (GUI view)**: a conventional presentation of the portfolio content; has its own address; mirrors the terminal's content.
- **View preference**: per-browser memory of the last-used view (terminal or regular page) and whether the visitor has already seen the boot sequence; anonymous, stored only on the visitor's device.
- **Skill level**: the measure each skill bar fills to — the number of Ahmed's public repositories that use that skill, from the nightly GitHub technology inventory, scaled against the most-used skill. Skills with no matching repository get no bar but stay listed under their category, so nothing from the CV disappears; if no skill has evidence, the plain list is shown.
- **Presence**: an anonymous, short-lived marker that a visitor is currently active, tagged by surface (web, later SSH); expires about 1 minute after the visitor's page stops checking in (well within the 2-minute target of SC-007).
- **Guestbook entry**: name, message, time signed, and an identifier the owner uses to delete it; no visitor address is stored with it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time, non-technical visitor can reach the regular page from the terminal in one click or tap, within 5 seconds of the page loading.
- **SC-002**: 100% of the content sections the terminal shows (about, experience, projects, skills, contact, CV) are present on the regular page with matching content.
- **SC-003**: The regular page loads and becomes usable within 2 seconds on a typical mobile connection, and scores at least 90 on standard accessibility audits in both light and dark appearance.
- **SC-004**: A returning visitor never sees the boot sequence twice on the same browser; a first-time visitor reaches the welcome in at most 3 seconds, or immediately after skipping.
- **SC-005**: No output that types out takes longer than 1.5 seconds to finish appearing, and visitors with reduced motion see every command output instantly. (Timed sequences such as `sudo hire-me` and streamed assistant answers keep their own pacing.)
- **SC-006**: The screensaver is dismissed within 100 ms of input, with zero lost or misapplied keystrokes in testing.
- **SC-007**: `who` reflects a visitor joining or leaving within 2 minutes.
- **SC-008**: 100% of guestbook submissions that break length, content or rate rules are rejected in testing, and an owner deletion disappears for all visitors on their next read.
- **SC-009**: The feature adds no new paid service or recurring hosting cost (the human check uses a free tier).

## Assumptions

- **SSH is not shipped yet** (deferred in spec 004 for cost). The SSH parts of this feature — the lighter SSH boot/typing effects and the SSH count in `who` — are specified here but built only when SSH ships. Until then, `who` counts web visitors only.
- The regular page lives at its own address on the same site (for example `/gui`); its exact address is a planning detail.
- Typing `gui`/`startx` or using the button switches views in place; the regular page's address is then shown so it can be shared. The terminal is the default landing view for new visitors; returning visitors get their last-used view (FR-004a).
- The first-visit button stays visible on later visits too, but can be less prominent once the visitor has used either view.
- "First-time visitor" is per browser, remembered on the visitor's device; clearing site data counts as a new visitor.
- Guestbook entries publish immediately once they pass filtering and the human check (no approval queue); the owner removes anything unwanted afterwards. The owner-only deletion follows the same private-token pattern as the existing usage report.
- The guestbook keeps the newest 200 entries; when a new entry is added beyond that, the oldest is dropped. The owner can delete any kept entry.
- A visitor for rate-limiting purposes is identified the same way the assistant's per-visitor limit identifies them (spec 003), without storing addresses alongside entries.
- The site-wide daily guestbook cap defaults to 200 signatures.
- Presence, guestbook and counters use the existing data store already used for caching and limits; no new paid service (see SC-009).
- Existing themes, deep links (spec 004), curl output and assistant behaviour are unchanged except where this spec says otherwise.
