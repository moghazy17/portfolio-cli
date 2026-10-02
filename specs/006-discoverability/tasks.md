# Tasks: Discoverability

**Input**: `specs/006-discoverability/` — spec.md, plan.md
**Tests**: required (Constitution VIII).

## Phase 1: Foundational

- [X] T001 Add types to `packages/shared/src/types.ts`: `Suggestion { label: string; line: string; kind: 'command' | 'question' }`, `TourStep { line: string; pauseMs: number; motion?: true }`, `CommandResult.tour?: TourStep[]`; add `tour` to the shell's merged effect keys in `packages/shared/src/shell/shell.ts`.
- [X] T002 Extend `packages/shared/src/surface/stats.ts` with `suggestion_taps`, `tours_started`, `tours_completed`, `shortcut_sheet_opens` (read and write), and update `packages/shared/test/surface-stats.test.ts`.
- [X] T003 Create `apps/web/app/api/events/route.ts`: `POST { kind }` accepting only those four kinds (400 otherwise), rate-limited 30/min per IP (`rl:events`, fail open), records via `recordSurfaceEvent`, 204; and a tiny client helper `recordClientEvent(kind)` in `apps/web/lib/client-events.ts` (fire-and-forget `fetch` with `keepalive`, errors ignored).

## Phase 2: User Story 1 — Suggestions (P1)

- [X] T004 [P] [US1] Write `packages/shared/test/discover.test.ts` (suggestions part): first-visit set has 4–6 items incl. ≥1 `question` and the tour; for every visible command, the after-command set has 4–6 items, never includes that command, only references registered non-hidden commands available on `web`; unknown/removed commands are skipped; curl surface gets no question items.
- [X] T005 [US1] Implement `packages/shared/src/discover/suggestions.ts` (`suggestionsFor({ firstVisit, lastCommand, surface })`, a hand-written next-step map for the main commands with a sensible default; one fixed assistant question such as "What RAG work has he done?"); export from `packages/shared/src/index.ts`.
- [X] T006 [US1] Create `apps/web/components/SuggestionBar.tsx`: a `nav` with `aria-label="Suggestions"` of `<button>`s (question items prefixed "ask:"), single line with horizontal scroll under 640 px, ≥ 44 px tall on phones; styles in `apps/web/app/globals.css` using theme variables.
- [X] T007 [US1] Wire it in `apps/web/hooks/useTerminal.ts` and `apps/web/components/Terminal.tsx`: compute the set from first visit (`localStorage` `discover:visited`, try/catch) and the last command's name; show only when ready for input in command mode (hidden while running/streaming/sequence/tour/chat); a tap calls the same submit path as typed input (history, address bar, `ask` for questions) and records `suggestion_taps`.

## Phase 3: User Story 2 — Prompt examples (P2)

- [X] T008 [P] [US2] Extend `discover.test.ts`: `PROMPT_EXAMPLES` has ≥ 5 entries, mixes `try:` commands, an `ask:` question and at least one hidden easter egg.
- [X] T009 [US2] In `apps/web/components/CommandLine.tsx` render the current example as an `aria-hidden` dim overlay inside the input area when the input is empty; rotate every 4 s (stop under reduced motion via `useReducedMotion`); never feed it to completion or submit; keep the input's `aria-label` unchanged.

## Phase 4: User Story 3 — Tour (P3)

- [X] T010 [P] [US3] Extend `discover.test.ts`: `tourSteps()` covers welcome, `skills`, one question, `theme crt` (marked `motion`), `who`, and totals ≤ 70 s of pauses plus a typing budget; `tour` on web returns the `tour` effect, on curl returns the web-only message and no effect.
- [X] T011 [US3] Implement `packages/shared/src/discover/tour.ts` (`tourSteps()`) and `tourCommand` in `packages/shared/src/commands/utility.ts`; register `tour` (`surfaces: ['web','curl']`, `man` page) in `packages/shared/src/commands/registry.ts`; update registry/snapshot tests.
- [X] T012 [US3] Create `apps/web/hooks/useTour.ts` and apply the `tour` effect in `useTerminal.ts`: type each line into the prompt (≈ 35 ms/char; instant under reduced motion), run it through the normal path, await completion including assistant streaming, pause, continue; skip `motion` steps under reduced motion; theme steps apply without persisting; capture-phase keydown/pointerdown/touchstart (and Esc) abort immediately; `finally` restores the starting theme, clears the prompt and shows "Your turn" + suggestions; record `tours_started` / `tours_completed`. A `tour` result from a deep link only shows its text plus the tour suggestion.

## Phase 5: User Story 4 — Desktop and mobile (P4)

- [X] T013 [US4] Create `apps/web/components/ShortcutSheet.tsx` (accessible dialog with heading and the shortcut list; Esc or `?` closes; focus returns to the prompt) and open it from `CommandLine.tsx` when `?` is pressed on an empty prompt and `(pointer: fine)` matches; record `shortcut_sheet_opens`; add a dim desktop-only footer hint "Press ? for shortcuts" in `Terminal.tsx`.
- [X] T014 [US4] In `CommandLine.tsx` skip the initial auto-focus when `(pointer: coarse)` (keep focus on tap and after commands as today).
- [X] T015 [US4] Create `apps/web/hooks/useKeyboardInset.ts` (`visualViewport` resize/scroll → CSS variable `--keyboard-inset`) and use it in `Terminal.tsx` so the prompt and suggestions sit directly above the on-screen keyboard; make the menu bar a single horizontally scrollable line under 640 px with ≥ 44 px buttons (`globals.css`).

## Phase 6: Tests and polish

- [X] T016 Write `apps/web/e2e/discover.spec.ts`: (a) 320 px and 1280 px: suggestions visible, tapping `projects` gives the same output/address as typing it, row changes and excludes `projects`; (b) question suggestion posts to a mocked `/api/chat`; (c) no horizontal page scroll at 320 px; (d) example text rotates (use `page.clock`), disappears on typing, static in the reduced-motion project; (e) tour with mocked `/api/chat`: plays steps, a key press stops it within one step, theme equals the starting theme, prompt empty; a full run ends with "Your turn" (fast-forward clock); `/tour` link does not start it; (f) `?` on empty prompt opens the dialog, Esc closes it, `?` inside text types a character; (g) a `hasTouch`+`isMobile` context: input not focused on load; (h) axe: no serious/critical violations with the bar and dialog open; (i) `POST /api/events` with an unknown kind → 400.
- [X] T017 Update `CLAUDE.md` (new module, components, hooks, route, `tour` command) and `README.md` (tour, suggestions, `?` shortcuts).
- [X] T018 Run all gates: `npm run typecheck`, `npm test`, `npm run build:web`, `cd apps/web && CI=1 npx playwright test` (both projects).
