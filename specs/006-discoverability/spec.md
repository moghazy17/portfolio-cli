# Feature Specification: Discoverability (suggestions, prompt examples, tour, desktop and mobile polish)

**Feature Branch**: `006-discoverability`  
**Created**: 2026-10-02  
**Status**: Draft  
**Input**: User description: "Hint visitors at every feature so they get impressed, on desktop and mobile: (1) tappable suggestion chips that change after each command, including an assistant question; (2) a rotating example in the empty prompt; (4) a `tour` command — a short skippable showcase; (6) desktop keyboard-shortcut cheat sheet on `?` and mobile polish (no keyboard popping up on load, chips reachable above the keyboard, big tap targets)."

## Clarifications

### Session 2026-10-02

Decisions taken from the request and the existing product (no open questions):

- The existing menu bar stays as fixed navigation; suggestions are a separate row that changes with context.
- Tapping an assistant-question suggestion sends that question, because the visitor chose it (unlike a link, which only prefills).
- The tour is never started automatically; it is offered as a suggestion on first visit and by the `tour` command.
- The tour's theme change is temporary: the visitor's own theme is restored on Finish or Exit.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Suggestions that change with context (Priority: P1)

A visitor who has never used a terminal sees a row of short, tappable suggestions right above the prompt: a few commands and one plain-language question for the assistant. Tapping one runs it exactly as if typed. After each command the row changes to sensible next steps (after `projects`: ask about these projects, `skills`, the regular page). On a phone the row is a single line that scrolls sideways, so nobody has to type to explore.

**Why this priority**: typing is the biggest barrier, especially on phones, and the assistant — the most impressive feature — is invisible until someone thinks to ask a question.

**Independent Test**: load the site on phone and desktop sizes, explore using only suggestions, and confirm each tap runs its command and the row changes after each one.

**Acceptance Scenarios**:

1. **Given** a first-time visitor, **When** the welcome is shown, **Then** a row of 4–6 suggestions appears above the prompt, including one assistant question and a "take the tour" suggestion.
2. **Given** a visitor taps a command suggestion, **When** it runs, **Then** the result is identical to typing it (same output, history entry and address bar).
3. **Given** a visitor taps the assistant-question suggestion, **When** it runs, **Then** the question is sent to the assistant and answered in place.
4. **Given** a command has finished, **When** its output appears, **Then** the suggestions change to next steps related to that command, never repeating the command just run.
5. **Given** a phone-sized screen, **When** suggestions are shown, **Then** they form one horizontally scrollable line, each at least 44 px tall.
6. **Given** chat mode, a running command, a playing tour or sequence, **When** the screen updates, **Then** suggestions are hidden until the terminal is ready for input again.

---

### User Story 2 - Rotating example in the empty prompt (Priority: P2)

When the prompt is empty, dim example text cycles every few seconds — `try: skills`, `ask: what's his stack?`, `try: theme crt`, `try: who`, `try: sudo hire-me` — showing that the prompt accepts both commands and plain questions. It disappears the moment the visitor types.

**Why this priority**: zero screen space, teaches the "you can just ask" idea and reveals hidden features to curious visitors.

**Independent Test**: watch the empty prompt cycle, type a character and see it vanish, clear the input and see it return.

**Acceptance Scenarios**:

1. **Given** an empty prompt, **When** about 4 seconds pass, **Then** the example text changes to the next example.
2. **Given** an example is showing, **When** the visitor types, **Then** the example disappears immediately and Tab completion still completes the visitor's own text, never the example.
3. **Given** reduced motion is requested, **When** the prompt is empty, **Then** one example is shown and does not rotate.
4. **Given** a screen reader, **When** the prompt is focused, **Then** the input's accessible name stays stable and rotating examples are not announced.

---

### User Story 3 - Guided tour (Priority: P3)

A visitor taps "take the tour" or types `tour` and gets a guided showcase. The first command runs immediately; a card explains each step and lets the visitor move with Back, Next, or Exit at their own pace. The steps show `about`, `skills` with its bars, an assistant question answered with sources, a temporary `crt` theme, and `who`. Finish restores the visitor's theme and shows "Your turn" with fresh suggestions. Clicking or scrolling the page leaves the tour active.

**Why this priority**: the "get impressed" moment for visitors who will never type, but it builds on suggestions and is only offered, never forced.

**Independent Test**: start the tour, move forward and back, finish it, then start again and exit mid-way; confirm the original theme returns both times.

**Acceptance Scenarios**:

1. **Given** a visitor runs `tour` (or taps its suggestion), **When** it starts, **Then** `about` runs immediately and a card shows Step 1/5, its caption, and Back, Next, and Exit controls.
2. **Given** a step has finished, **When** the visitor chooses Next or presses Enter or ArrowRight with an empty prompt, **Then** the next command runs once; Back or ArrowLeft revisits earlier output without rerunning it.
3. **Given** a command or assistant answer is still running, **When** its step is shown, **Then** Next is disabled until that work finishes.
4. **Given** the tour is active, **When** the visitor clicks or scrolls the page, **Then** the tour remains active; Exit, Esc, or entering their own command ends it quietly and restores the theme.
5. **Given** the visitor chooses Finish on the last step, **Then** the visitor's own theme is restored and a "Your turn" line with fresh suggestions appears.
6. **Given** the assistant is unavailable or the visitor has reached their question limit, **When** the visitor reaches its question step, **Then** the step shows the normal notice and Next becomes available.
7. **Given** reduced motion, **When** the tour starts, **Then** commands appear without typing animation, the theme step is skipped, and the card shows four steps.
8. **Given** curl, **When** `tour` is requested, **Then** a short message says the tour is available in the web terminal.

---

### User Story 4 - Desktop shortcuts and mobile polish (Priority: P4)

On desktop, pressing `?` on an empty prompt opens a small cheat sheet of keyboard shortcuts (Tab completion, ↑/↓ history, Ctrl+L clear, Ctrl+C cancel, Esc leave chat, `?` this sheet); Esc or `?` closes it. A dim footer hint mentions it. On phones, the page does not open the on-screen keyboard by itself on load, suggestions stay reachable above the keyboard when it is open, and all tap targets are comfortably sized.

**Why this priority**: polish that makes the experience feel deliberate on each device; smaller impact than the first three.

**Independent Test**: on desktop press `?` with an empty prompt and with text typed; on a phone-sized touch device load the page and confirm the keyboard does not open, then focus the input and confirm suggestions are visible above it.

**Acceptance Scenarios**:

1. **Given** desktop and an empty prompt, **When** the visitor presses `?`, **Then** the cheat sheet opens; **When** they press Esc or `?`, **Then** it closes and focus returns to the prompt.
2. **Given** text in the prompt (for example a question), **When** the visitor types `?`, **Then** it is typed as a character and no cheat sheet opens.
3. **Given** a touch device, **When** the page loads, **Then** the input is not focused automatically and the on-screen keyboard does not appear; tapping the prompt focuses it.
4. **Given** a touch device with the keyboard open, **When** the visitor looks at the screen, **Then** the suggestions row is visible directly above the keyboard.
5. **Given** a phone-sized screen, **When** the menu bar is shown, **Then** it is one horizontally scrollable line instead of several wrapped rows, with tap targets at least 44 px tall.
6. **Given** the cheat sheet is open, **When** a screen reader is used, **Then** it is announced as a dialog with a heading and closes with Esc.

### Edge Cases

- Deep links: suggestions appear after the linked command's output like after any command; the tour is never started by a link (`/tour` shows the tour suggestion only, like other actions links cannot take on the visitor's behalf).
- A visitor typing while a suggestion is being run: the typed text is kept.
- Suggestions never include commands unavailable on the current surface, hidden easter eggs are only hinted in the rotating prompt examples, never in suggestions.
- If a suggested command was removed from the registry, it is skipped rather than shown.
- The tour never signs the guestbook, opens other sites, downloads files or switches to the regular page.
- The tour's assistant question counts toward the visitor's normal question limit like any question.
- Narrow screens (320 px): suggestions and menu rows never cause horizontal page scrolling; they scroll within themselves.

## Requirements *(mandatory)*

### Functional Requirements

**Suggestions**

- **FR-001**: The terminal MUST show a suggestions row of 4–6 items above the prompt whenever it is ready for input in command mode.
- **FR-002**: Suggestions MUST come from one shared definition so web (and later SSH) offer the same ones; each suggestion is either a command line or an assistant question.
- **FR-003**: The first-visit set MUST include at least one assistant question and "take the tour"; after a command, the set MUST be next steps related to that command and MUST NOT repeat the command just run.
- **FR-004**: Activating a command suggestion MUST behave exactly like typing and submitting it; activating a question suggestion MUST send it to the assistant.
- **FR-005**: Suggestions MUST be keyboard reachable buttons with accessible names, and hidden while a command runs, an answer streams, a sequence or tour plays, or in chat mode.

**Prompt examples**

- **FR-006**: An empty prompt MUST show a dim example that changes about every 4 seconds from a shared list mixing commands, a question and hidden features; it MUST vanish while text is present and MUST NOT be used by completion or submission.
- **FR-007**: Under reduced motion the example MUST NOT rotate; the input's accessible name MUST NOT change with the example.

**Tour**

- **FR-008**: A `tour` command MUST start a visitor-paced guided showcase whose shared steps have a title and caption: `about`, `skills`, one assistant question, a temporary `crt` theme, and `who`. A card MUST show the current step and Back, Next, and Exit controls.
- **FR-009**: The first step MUST run immediately. Each new step MUST type its command into the prompt (instant under reduced motion) and run through the normal command path. Back and revisited steps MUST show existing output without rerunning commands. Next MUST remain unavailable until the current command or answer finishes.
- **FR-010**: With an empty prompt, Enter or ArrowRight MUST advance, ArrowLeft MUST go back, and Esc MUST exit. Typing or submitting a visitor command MUST exit quietly; pointer and scroll activity MUST leave the tour active. Finish alone MUST show "Your turn" and count as a completed tour.
- **FR-011**: The tour MUST restore the visitor's theme on Finish or Exit, MUST NOT persist the temporary theme, and MUST skip the theme step under reduced motion, showing the resulting four-step count.
- **FR-012**: The tour MUST NOT run from a deep link, MUST NOT perform sign, open, download or view-switch actions, and over curl MUST return a web-only message.

**Desktop and mobile**

- **FR-013**: On a non-touch device, `?` on an empty prompt MUST open a keyboard-shortcut cheat sheet (accessible dialog) closed by Esc or `?`, returning focus to the prompt; `?` with text present MUST be typed normally.
- **FR-014**: A dim footer hint MUST mention `?` on desktop only.
- **FR-015**: On touch devices the input MUST NOT be focused automatically on load.
- **FR-016**: On phone-sized screens the suggestions row and menu bar MUST each be a single horizontally scrollable line with tap targets of at least 44 px, and the suggestions MUST stay visible directly above the on-screen keyboard when it is open.
- **FR-017**: The usage report MUST count daily: suggestion taps, tours started, tours completed, and cheat-sheet opens (anonymous).

### Key Entities

- **Suggestion**: label shown to the visitor, the line it runs, and its kind (command or question).
- **Suggestion set**: the suggestions for a context — first visit, or after a given command.
- **Tour step**: the command line to run, how long to pause after it, and whether it is skipped under reduced motion.
- **Prompt example**: a short dim text shown in the empty prompt.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can reach projects, skills, an assistant answer, the guestbook and the regular page using only taps, with no typing, on a 320 px phone.
- **SC-002**: A visitor can move through the tour at their own pace, revisit prior steps without rerunning them, and exit with the original theme restored.
- **SC-003**: Loading the site on a touch device never opens the on-screen keyboard.
- **SC-004**: No horizontal page scrolling at 320 px with suggestions and the menu bar visible.
- **SC-005**: Accessibility checks report no serious or critical issues with suggestions, the prompt example and the cheat sheet present.
- **SC-006**: First terminal output still appears in under 1.5 s on a mid-range phone (Constitution VII).

## Assumptions

- Suggestion content and tour script live in shared code next to the command registry; they are UI copy, not portfolio content, so they are not in `/content` (Constitution I is about CV content).
- The assistant question used in suggestions and the tour is a fixed, safe example about the owner's work (for example "What RAG work has he done?").
- "Touch device" means the primary pointer is coarse; hybrid laptops with a mouse count as desktop.
- SSH is still deferred; shared definitions keep it possible to add suggestions there later.
