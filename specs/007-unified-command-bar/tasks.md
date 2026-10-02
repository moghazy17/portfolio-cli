# Tasks: Unified command bar

**Input**: `specs/007-unified-command-bar/` — spec.md, plan.md
**Tests**: required (Constitution VIII).

## Phase 1: Foundational (shared)

- [X] T001 Change `WELCOME_HINT` and add `WELCOME_SHORTCUT_HINT` in `packages/shared/src/ascii.ts`; export it; update tests/snapshots containing the old hint.
- [X] T002 Add `getMenuGroups()` to `packages/shared/src/commands/engine.ts` (About me / Work / Explore; leftovers to Explore); export; Vitest that the flattened groups equal `getMenuItems()` exactly.
- [X] T003 Add `promptExamplesFor(visibleLines)` to `packages/shared/src/discover/suggestions.ts`; Vitest for filtering and the `try: neofetch` fallback.
- [X] T004 Add `command_sheet_opens` to `packages/shared/src/surface/stats.ts` and its test; allow it in `apps/web/app/api/events/route.ts`.

## Phase 2: User Story 1 — One bar (P1)

- [X] T005 [US1] Create `apps/web/components/CommandBar.tsx` (suggestion chips + "☰ all", roving keyboard nav, distinct assistant chip) and replace the menu bar in `Terminal.tsx` with it; remove the inline `SuggestionBar` and delete `SuggestionBar.tsx`; reserve height while busy.
- [X] T006 [US1] Styles in `apps/web/app/globals.css`: single scrollable line on phones, ≥ 44 px chips, one line on wide screens, contrast in matrix/dracula/nord/crt.

## Phase 3: User Story 2 — All commands sheet (P2)

- [X] T007 [US2] Create `apps/web/components/CommandSheet.tsx` (dialog, grouped items from `getMenuGroups()`, focus trap, Esc, focus back to prompt; bottom sheet on coarse pointer, popover on fine); items use `submitSuggestion`; record `command_sheet_opens`.

## Phase 4: User Story 3 — Hints (P3)

- [X] T008 [US3] `WelcomeScreen.tsx`: remove the unused arrow-key menu; append `WELCOME_SHORTCUT_HINT` on fine pointers after mount; remove the `.shortcut-hint` footer from `Terminal.tsx`.
- [X] T009 [US3] `CommandLine.tsx`: rotate `promptExamplesFor(visible chip lines)`.

## Phase 5: Tests and polish

- [X] T010 Write `apps/web/e2e/command-bar.spec.ts` and update existing e2e specs that used the menu bar or footer hint (without weakening their intent).
- [X] T011 Update `CLAUDE.md` and `README.md` for the bar and sheet.
- [X] T012 Run all gates and Lighthouse (mobile, first output < 1.5 s).
