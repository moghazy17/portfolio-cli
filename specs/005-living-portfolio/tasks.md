# Tasks: Living Portfolio (GUI mode, terminal motion, presence and guestbook)

**Input**: Design documents from `specs/005-living-portfolio/`
**Prerequisites**: plan.md, spec.md, research.md (R1–R26), data-model.md, contracts/ (commands, http-api, ui), quickstart.md

**Tests**: Required by Constitution VIII. Engine logic gets Vitest tests (`packages/shared/test/`), web flows get Playwright tests (`apps/web/e2e/`). No SSH smoke test: SSH is deferred (plan.md "Deferred").

**Organization**: tasks are grouped by user story. US1 = GUI mode, US2 = terminal motion, US3 = presence and guestbook.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1, US2, US3

---

## Phase 1: Setup

**Purpose**: dependencies and configuration that later phases need.

- [ ] T001 Add `@axe-core/playwright` as a root devDependency in `package.json` and run `npm install`.
- [ ] T002 [P] Add the new variables to `apps/web/.env.example` with comments: `ADMIN_TOKEN`, `GUESTBOOK_SALT`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (note Cloudflare's always-pass test keys `1x00000000000000000000AA` / `1x0000000000000000000000000000000AA` for local work).
- [ ] T003 [P] Add a second Playwright project `chromium-reduced-motion` in `apps/web/playwright.config.ts` with `use: { ...devices['Desktop Chrome'], contextOptions: { reducedMotion: 'reduce' } }` and `testMatch: /motion\.spec\.ts|gui\.spec\.ts/`; keep the existing `chromium` project unchanged.

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: shared type extensions and shell plumbing every story uses (data-model §6).

**⚠️ No user-story work starts until this phase is done.**

- [ ] T004 Extend `packages/shared/src/types.ts` per data-model §6: `ProgressOutput.note?: string` and `reveal?: boolean`; `Theme.effects?: { crt?: boolean }`; `CommandResult.view?: 'gui'` and `sign?: { name: string; message: string }`; `CommandContext.live?: LiveServices` and `skillEvidence?: (signal: AbortSignal) => Promise<SkillEvidence>`; new exported types `LiveServices`, `PresenceCount`, `GuestbookEntry`, `SignResult`, `SignReason`, `SkillEvidence`. Keep everything client-safe (no `node:` imports).
- [ ] T005 Update `packages/shared/src/shell/shell.ts`: add `view` and `sign` to `effectKeys` so they merge into `ShellResult`; accept `live` and `skillEvidence` in `ShellOptions` (next to the existing `github` option) and pass them into every `CommandContext`. Update `packages/shared/src/surface/curl.ts` `TextRequest`/`runTextRequest` to accept and forward optional `live` and `skillEvidence` the same way as `github`.
- [ ] T006 [P] Update `packages/shared/src/shell/lines.ts` and `packages/shared/src/render/ansi.ts` so a `progress` node renders as `label  ████████░░░░  note` (12-cell bar, padded label) when `note` is set, keeping today's `label  NN%` output when it is not. Add cases to `packages/shared/test/lines.test.ts` and `packages/shared/test/ansi-render.test.ts` (with and without `note`, value 0 and 1).
- [ ] T007 [P] Update `apps/web/components/OutputRenderer.tsx` `progress` case: when `note` is set show it instead of the percentage and set `aria-valuetext={note}`; keep the current output otherwise. (Animation comes in US2.)
- [ ] T008 Run `npm run typecheck` and `npm test`; fix fallout from T004–T007 (existing snapshots must not change for nodes without `note`).

**Checkpoint**: types and plumbing in place; all existing tests green.

---

## Phase 3: User Story 1 — GUI mode (Priority: P1) 🎯 MVP

**Goal**: non-technical visitors reach a clean conventional page with all content, by button, `gui`/`startx`, or `/gui`, and can return to the terminal; returning visitors land on their last view.

**Independent Test**: quickstart.md "US1 — GUI mode" steps 1–7, plus `apps/web/e2e/gui.spec.ts` green in both Playwright projects.

### Tests for User Story 1

- [ ] T009 [P] [US1] Write `packages/shared/test/gui-command.test.ts`: `gui` and `startx` on web return `view: 'gui'` and the "Opening the regular page…" text; on curl return status ok, the `<origin>/gui` pointer and no `view`; `gui` appears in `help`, the menu metadata and `man gui` (mentions `startx`); `toAddress('gui')` is `/gui`.
- [ ] T010 [P] [US1] Write `apps/web/e2e/gui.spec.ts` covering contracts/ui.md "Regular page" and "View switching": (a) `[data-testid=open-gui]` visible without scrolling at 320×640 and 1280×800 on first load; (b) clicking it lands on `/gui` with sections `#hero #about #experience #projects #skills #contact`, each heading present and texts matching the terminal's content (company names, project names, email); (c) `[data-testid=gui-cv]` href equals the `resume` command's download URL; (d) `[data-testid=back-to-terminal]` returns to `/` with the earlier terminal output still visible and no welcome replay; (e) typing `gui` and `startx` navigates to `/gui`; (f) after visiting `/gui`, a fresh `page.goto('/')` ends on `/gui`, while `page.goto('/projects')` stays on the terminal and shows projects output; (g) no horizontal scroll at 320 px (`scrollWidth <= clientWidth`); (h) `emulateMedia({ colorScheme: 'light' | 'dark' })` changes `--gui-bg`; (i) `AxeBuilder` on `/gui` in light and dark has no `serious`/`critical` violations; (j) `curl`-style request (`request.get('/gui', { headers: { 'user-agent': 'curl/8.0' } })`) returns the text pointer.

### Implementation for User Story 1

- [ ] T011 [US1] Add `gui` (alias `startx`, `menu: true`, `surfaces: ['web','curl']`, `man` page per contracts/commands.md) to `packages/shared/src/commands/registry.ts`, implemented as `guiCommand(ctx)` in `packages/shared/src/commands/utility.ts`: web → text + `view: 'gui'`; curl → `Prefer a regular web page? Open ${ctx.origin}/gui`. Update `packages/shared/test/registry-coverage.test.ts` and `packages/shared/test/read-only.test.ts` if they enumerate commands. Make T009 pass.
- [ ] T012 [P] [US1] Create `apps/web/lib/view-cookie.ts` exporting `VIEW_COOKIE = 'view'`, `setViewCookie(view: 'gui' | 'terminal')` (client: `document.cookie`, `Max-Age=31536000; Path=/; SameSite=Lax`, wrapped in try/catch) and `readViewCookie(request: NextRequest)`.
- [ ] T013 [US1] Update `apps/web/middleware.ts` (research R5, R6, contracts/http-api.md `/gui` and `/`): in the browser branch, (1) if `pathname` is `/gui` or `/gui/` → `NextResponse.next()` before `parseAddress`; (2) if `pathname === '/'`, `search === ''` and `view` cookie is `gui` → `NextResponse.redirect(new URL('/gui', request.url), 307)` with `Cache-Control: private, no-store` and `Vary: Cookie`. Text clients keep today's rewrite (so `/gui` over curl runs the `gui` command). Do not count `/gui` as a deep link.
- [ ] T014 [P] [US1] Install `tailwindcss` and `@tailwindcss/postcss` as devDependencies and `motion` as a dependency in `apps/web/package.json`; create `apps/web/postcss.config.mjs` with the Tailwind plugin. Confirm `npm run build:web` still builds the terminal page unchanged.
- [ ] T015 [US1] Create `apps/web/app/gui/gui.css` (research R1, R2): `@import "tailwindcss/theme.css" layer(theme); @import "tailwindcss/utilities.css" layer(utilities);` (no Preflight); `@theme` mapping colours `bg`, `fg`, `muted`, `card`, `border`, `accent` to `var(--gui-*)`; `.gui-root` scoped reset (box-sizing, margins, `font-family` sans for body text, `var(--font-mono)` for accents) and `--gui-*` light values on `.gui-root`, dark values under `@media (prefers-color-scheme: dark)`; accent `#2c84db` (from `themes.matrix`). Check contrast ≥ 4.5:1 for body text in both sets.
- [ ] T016 [US1] Create `apps/web/app/gui/layout.tsx` importing `./gui.css`, wrapping children in a `.gui-root` element with `<LazyMotion features={domAnimation} strict>` and `<MotionConfig reducedMotion="user">` from `motion/react` (client wrapper component `apps/web/components/gui/MotionProvider.tsx`), and a skip link to `#main`. Set `document.body` background through the `.gui-root` min-height wrapper, not by changing `globals.css`.
- [ ] T017 [P] [US1] Create `apps/web/components/gui/cx.ts` (tiny class joiner) and `apps/web/components/gui/Reveal.tsx` (client; `m.div` with `initial={{ opacity: 0, y: 8 }}`, `whileInView={{ opacity: 1, y: 0 }}`, `viewport={{ once: true }}`, duration ≤ 0.4 s).
- [ ] T018 [US1] Use the 21st MCP to source designs (research R3): run `mcp__21st__search` for hero, vertical experience timeline, project card grid, contact section and skills chips; pick one per section (starting from the candidates in research R3), check its licence, call `mcp__21st__get_component` only for the picks, and note the chosen ids in a comment at the top of each GUI component. Do **not** run the `npx shadcn add` commands or commit any 21st API key.
- [ ] T019 [P] [US1] Create `apps/web/components/gui/GuiNav.tsx`: sticky top bar with name (link `#hero`), section links (collapsed into a `<details>` menu under 640 px), and a `[data-testid=back-to-terminal]` button labelled "Terminal" that calls `setViewCookie('terminal')` then `router.push('/')`. Tap targets ≥ 44 px.
- [ ] T020 [P] [US1] Create `apps/web/components/gui/GuiHero.tsx` (server component, `<header id="hero">` with `<h1>` name, `profile.label`, first sentence of `cvData.professionalSummary`, CV button `[data-testid=gui-cv]` using the same URL/filename as `packages/shared/src/commands/resume.ts`, contact links; the CV link comes from a small `CvLink` server component in `apps/web/components/gui/CvLink.tsx` that checks the file exists in `apps/web/public` at render time (`existsSync`) and otherwise renders "CV temporarily unavailable, email me" with the email link instead of a broken download) ported from the chosen 21st hero with `--gui-*` token classes.
- [ ] T021 [P] [US1] Create `apps/web/components/gui/GuiAbout.tsx` (`#about`: summary and education from `cvData`).
- [ ] T022 [P] [US1] Create `apps/web/components/gui/GuiTimeline.tsx` (`#experience`: vertical timeline from `cvData.experience` — company, role, dates formatted like the terminal's `experience`, bullets) ported from the chosen 21st timeline.
- [ ] T023 [P] [US1] Create `apps/web/components/gui/GuiProjects.tsx` (`#projects`: responsive card grid from `cvData.projects` — name, tech-stack badges, bullets, and the same links the terminal shows for each project, via `itemIds`/project content) ported from the chosen 21st card.
- [ ] T024 [P] [US1] Create `apps/web/components/gui/GuiSkills.tsx` (`#skills`: category headings with skill chips from `cvData.skills`; leave a prop `evidence?: SkillEvidence` unused for now — US2 adds bars).
- [ ] T025 [P] [US1] Create `apps/web/components/gui/GuiContact.tsx` (`#contact`: email, LinkedIn, GitHub, and the CV via `CvLink` from T020, from `cvData.contact`).
- [ ] T026 [US1] Create `apps/web/app/gui/page.tsx`: server component rendered statically with incremental revalidation (`export const revalidate = 3600`, not `force-static`, so US2's skill bars can refresh hourly) composing GuiNav, `<main id="main">` with the sections in the contracts/ui.md order (guestbook slot left for US3), each wrapped in `Reveal`; `metadata` with title `${profile.name} — Portfolio`, description from `site`, `alternates.canonical: '/gui'`, OG image `/og-image.png`. A small client effect calls `setViewCookie('gui')` on mount.
- [ ] T027 [P] [US1] Create `apps/web/lib/terminal-snapshot.ts` (research R7): module-level `let snapshot: { history: HistoryEntry[]; cwd: string; prompt: string } | null` with `saveSnapshot()` / `takeSnapshot()`.
- [ ] T028 [US1] Update `apps/web/hooks/useTerminal.ts`: (a) apply the `view` effect with `setViewCookie('gui')` and `router.push('/gui')` (allowed for deep-link runs, unlike `openUrl`/`download`); (b) on unmount call `saveSnapshot` with the visible log and shell cwd; on mount, if `takeSnapshot()` returns a value, restore log and cwd (`createShell({ initialCwd })`) and skip the welcome; (c) on a plain `/` load call `setViewCookie('terminal')`.
- [ ] T029 [US1] Update `apps/web/components/Terminal.tsx`: add the `[data-testid=open-gui]` "Regular view" button in the terminal chrome next to the menu bar, visible at 320 px without scrolling; accent-filled until `localStorage['gui:seen']` is set (set when either view has been used once), outline afterwards; click → same path as the `gui` effect. Add matching mobile styles in `apps/web/app/globals.css`.
- [ ] T030 [US1] Add `/gui` to `apps/web/app/sitemap.ts` if a sitemap exists (create one listing `/` and `/gui` if not), and confirm `apps/web/app/page.tsx` keeps its hidden semantic article unchanged.
- [ ] T031 [US1] Run `npm run build:web` and `cd apps/web && CI=1 npx playwright test e2e/gui.spec.ts`; then run Lighthouse per quickstart.md on `/gui` (mobile and desktop) and record performance/accessibility scores (target ≥ 90) in `specs/005-living-portfolio/implementation-progress.md`.

**Checkpoint**: US1 shippable on its own.

---

## Phase 4: User Story 2 — Terminal motion (Priority: P2)

**Goal**: boot once, typewriter for short outputs, glitch banner, `crt` theme, matrix-rain screensaver, animated skill bars from GitHub evidence; all off under reduced motion.

**Independent Test**: quickstart.md "US2 — Terminal motion" steps 1–7, plus `apps/web/e2e/motion.spec.ts` green in both Playwright projects.

### Tests for User Story 2

- [ ] T032 [P] [US2] Write `packages/shared/test/skill-evidence.test.ts` for `skillEvidence(snapshot, skills)` (data-model §7) with a fixture inventory: "Python (Advanced)" counts Python repos; "Retrieval-Augmented Generation (RAG)" uses the larger of the two candidates; alias matches (e.g. `langchain-*` → LangChain) count once per repo; unknown skill → 0.
- [ ] T033 [P] [US2] Write `packages/shared/test/motion.test.ts`: `bootSequence()` total `delayMs` ≤ 3000 and every step has output; `shouldType(output)` is true for ≤ 40 lines and false for 41+ (using `toLines` from `packages/shared/src/shell/lines.ts`).
- [ ] T034 [P] [US2] Add cases to `packages/shared/test/legacy-output.test.ts` (or a new `packages/shared/test/skills-bars.test.ts`): `skills` with an injected `skillEvidence` returns `progress` nodes with `reveal: true`, values scaled to the max, notes `N repos` / `1 repo` / `no public repos`, and the footer line; without it (or when it rejects or exceeds 2 s) returns today's list output exactly; `skills | grep -i python` yields a text bar line. Add `crt` to theme tests: `theme crt` returns `theme: 'crt'`, `themes.crt.effects.crt === true`.
- [ ] T035 [P] [US2] Write `apps/web/e2e/motion.spec.ts` (contracts/ui.md "Terminal additions"): (a) fresh context → `[data-testid=boot]` visible; `page.keyboard.type('about')` immediately → boot gone and the input contains `about` (no dropped input); (b) reload → no boot; (c) a deep link `/projects` in a fresh context → no boot; (d) running `about` shows `[data-reveal=typing]` that completes within 1.6 s, and a keypress completes it at once; a > 40-line output never shows `[data-reveal=typing]`; (e) `.ascii-banner.glitch-reveal` present on welcome, and a key press during it removes the class immediately; (f) `theme crt` sets `[data-effect=crt]` and survives reload; (g) with `page.clock` fast-forward 60 s → `[data-testid=screensaver]` appears; `keyboard.press('a')` removes it and the input ends with `a`; pressing Enter during the screensaver runs nothing; (h) `skills` renders `[role=progressbar][aria-valuetext]` (mock `/api/skills` with `page.route`); (i) in the `chromium-reduced-motion` project: no boot, no `[data-reveal=typing]`, no screensaver after 60 s, banner without the glitch class.

### Implementation for User Story 2

- [ ] T036 [P] [US2] Create `packages/shared/src/motion/boot.ts` exporting `bootSequence(): SequenceStep[]` — 6–8 short lines (`[ OK ] Mounting /content`, `[ OK ] Loading resume.yaml`, `[ OK ] Starting assistant`, …, `Welcome.`), total ≤ 2.6 s; export from `packages/shared/src/index.ts`.
- [ ] T037 [P] [US2] Create `packages/shared/src/motion/reveal.ts` exporting `TYPE_MAX_LINES = 40`, `TYPE_MAX_MS = 1500` and `shouldType(output: CommandOutput[]): boolean` (uses `toLines`); export from `packages/shared/src/index.ts`.
- [ ] T038 [P] [US2] Create `packages/shared/src/inventory/skills.ts` exporting pure `skillEvidence(snapshot, skills)` per data-model §7 using `lookupTech`; export it, together with `STALE_AFTER_MS` (needed by T041), from `packages/shared/src/assistant/server/index.ts` and keep `test/assistant-bundle-boundary.test.ts` green.
- [ ] T039 [US2] Update `skillsCommand` in `packages/shared/src/commands/cv.ts` and its registry entry in `packages/shared/src/commands/registry.ts` to receive `ctx`: race `ctx.skillEvidence?.(ctx.signal)` against a 2 s timeout; on success build per-category sections of `progress` nodes per contracts/commands.md (`reveal: true`, padded labels, footer); otherwise return the current list output unchanged. Make T034 pass.
- [ ] T040 [P] [US2] Add the `crt` theme to `packages/shared/src/theme.ts` (green phosphor palette, e.g. background `#0a0f0a`, foreground `#b6ffb0`, primary `#33ff66`, `effects: { crt: true }`) and to `theme` completion; update `apps/web/hooks/useThemeApplier.ts` to expose `theme.effects`.
- [ ] T041 [P] [US2] Create `apps/web/app/api/skills/route.ts` (contracts/http-api.md): read `getInventory()`; 404 `{ error: 'no_inventory' }` when missing or stale (`STALE_AFTER_MS`); otherwise `{ evidence: skillEvidence(snapshot, cvData.skills), generatedAt }` with `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`; rate-limit 30/min per IP with prefix `rl:skills`, fail open.
- [ ] T042 [P] [US2] Create `apps/web/lib/live-services.ts` with `fetchSkillEvidence(signal)` (GET `/api/skills`, throws on non-200) — US3 adds the `LiveServices` client here.
- [ ] T043 [US2] Wire skill evidence into both hosts: pass `skillEvidence: fetchSkillEvidence` to `createShell` in `apps/web/hooks/useTerminal.ts`, and pass a server implementation (from `getInventory()` + `skillEvidence`) to `runTextRequest` in `apps/web/app/api/term/route.ts`.
- [ ] T044 [P] [US2] Create `apps/web/hooks/useReducedMotion.ts` (subscribes to `matchMedia('(prefers-reduced-motion: reduce)')`, SSR-safe default `false`).
- [ ] T045 [P] [US2] Create `apps/web/hooks/useTypewriter.ts` (research R13): given total character count, returns the visible budget advanced per `requestAnimationFrame` so the whole output finishes in ≤ `TYPE_MAX_MS` (minimum 60 chars/s), plus `complete()`; listens to `keydown` (not prevented) to complete; stops when complete or unmounted.
- [ ] T046 [US2] Add reveal mode to `apps/web/components/OutputRenderer.tsx`: prop `reveal?: boolean`; when true, render the output with a character budget from `useTypewriter` (truncate text per block in document order) in a separate `aria-hidden="true"` layer with `data-reveal="typing"`. The full output is rendered once from the start in the normal tree (so the terminal's `aria-live` log announces it exactly once) with a visually-hidden class while typing; when typing ends, remove that class from the same node and drop the typed layer, never mounting a second announced copy. Add a T035 case: the log gains exactly one announced node per command. `progress` nodes with `reveal` animate their fill once from 0 to value (CSS `transition: width 600ms`), static under reduced motion.
- [ ] T047 [US2] Update `apps/web/hooks/useTerminal.ts` / `apps/web/components/Terminal.tsx` to set `reveal` on a new history entry only when: `shouldType(output)`, not piped, not an assistant answer, not a sequence frame, not a deep-link run, reduced motion off. Running another command completes the previous reveal.
- [ ] T048 [US2] Implement the boot in `apps/web/hooks/useTerminal.ts` and `apps/web/components/Terminal.tsx` (research R12): on mount at plain `/` with no snapshot, no `localStorage['boot:v1']`, and reduced motion off, set the flag (try/catch, in-memory fallback), play `bootSequence()` through `SequencePlayer` inside `[data-testid=boot]` with a "press any key to skip" hint, then the welcome. Any `keydown`/`pointerdown`/`touchstart` skips it without `preventDefault`; the command input is mounted and focused from the start.
- [ ] T049 [P] [US2] Add the glitch reveal to `apps/web/app/globals.css` and `apps/web/components/WelcomeScreen.tsx`: class `glitch-reveal` on `.ascii-banner` on first render of a welcome; `::before`/`::after` copies (via `data-text` or a duplicated aria-hidden layer) with `clip-path` slices and colour offsets, one-shot ~600 ms keyframes; a one-time `keydown`/`pointerdown`/`touchstart` listener (not prevented) removes the `glitch-reveal` class so the banner settles at once (Constitution VI: skippable); `@media (prefers-reduced-motion: reduce)` disables it.
- [ ] T050 [P] [US2] Create `apps/web/components/CrtFilter.tsx` (inline hidden SVG with `<filter id="crt-barrel">` using `feImage`/radial gradient + `feDisplacementMap`) and CRT CSS in `apps/web/app/globals.css`: `[data-effect=crt]::before` scanlines (`repeating-linear-gradient`), `::after` vignette, text-shadow glow, `filter: url(#crt-barrel)` only at `min-width: 768px`; overlays `pointer-events: none`. Check Safari/WebKit text sharpness (Playwright `webkit` run or manual); if blurred, drop the SVG filter on WebKit via `@supports (-webkit-hyphens: none)` and keep vignette + rounded corners.
- [ ] T051 [US2] Apply `data-effect="crt"` on `.terminal-container` in `apps/web/components/Terminal.tsx` when `theme.effects?.crt`, and mount `CrtFilter` only then.
- [ ] T052 [P] [US2] Create `apps/web/hooks/useIdle.ts` (`useIdle(ms, enabled)`: resets on `keydown`, `pointermove`, `pointerdown`, `wheel`, `scroll` (capture), `touchstart`; returns `idle` boolean and `reset()`).
- [ ] T053 [P] [US2] Create `apps/web/components/Screensaver.tsx` (research R16): full-terminal `<canvas data-testid="screensaver" aria-hidden>` matrix rain in the theme's primary colour, ≤ 30 fps rAF loop, resizes with the container, stops on `visibilitychange` hidden, cleans up on unmount.
- [ ] T054 [US2] Mount the screensaver in `apps/web/components/Terminal.tsx` via `next/dynamic` (`ssr: false`) when `useIdle(60_000, enabled)` is idle, where `enabled` = not streaming, no sequence playing, tab visible, reduced motion off. Dismiss on the first input event; let typed keys reach the input; `preventDefault` only for Enter (dismiss only). Re-focus the input after dismissal.
- [ ] T055 [US2] Run `npm test`, `npm run build:web` and `cd apps/web && CI=1 npx playwright test e2e/motion.spec.ts`; check first terminal output is still < 1.5 s in a throttled (Moto G Power / Slow 4G) Lighthouse run of `/` and record it in `specs/005-living-portfolio/implementation-progress.md`.

**Checkpoint**: US2 shippable on its own (GUI skills section can now show bars: optional follow-up T056).

- [ ] T056 [US2] If US1 has shipped, make `apps/web/components/gui/GuiSkills.tsx` show static bars with repo counts: in `apps/web/app/gui/page.tsx` call `getInventory()` (from `apps/web/lib/inventory-store.ts`) and `skillEvidence(snapshot, cvData.skills)` on the server (the page revalidates hourly, see T026) and pass the result to `GuiSkills`; chips when the inventory is missing or stale.

---

## Phase 5: User Story 3 — Presence and guestbook (Priority: P3)

**Goal**: `who` shows people exploring now; visitors read and sign a guestbook (validated, filtered, human-checked, 1/day, 200 kept); the owner deletes entries.

**Independent Test**: quickstart.md "US3 — Presence and guestbook" steps 1–7, plus `apps/web/e2e/guestbook.spec.ts` green.

### Tests for User Story 3

- [ ] T057 [P] [US3] Write `packages/shared/test/guestbook-validate.test.ts` covering data-model §3 table: trimming/NFKC, control chars and bidi overrides removed, newlines → space; empty → `empty`; 24/25-char names and 140/141-char messages (count code points, test with emoji) → `too_long`; `http://x.y`, `www.x`, `example.com`, `foo.dev` → `link`; `a@b.co`, `+20 100 123 4567`, `(555) 123-4567` → `contact`, but `2026` and `v1.2` pass; blocked word plain, upper case, leetspeak and with repeated letters → `blocked`, while innocent words containing a blocked substring pass (word-boundary check). Every reason maps to the contracts/commands.md message.
- [ ] T058 [P] [US3] Write `packages/shared/test/live-commands.test.ts` with a fake `LiveServices`: `who` singular/plural text; `who` without `live` or when `presence` rejects → "Live count unavailable right now."; `guestbook` renders ≤ 20 entries newest first with relative times and the web/curl sign hint; empty and unavailable states; `sign "hi" --name Sam` on web returns `sign: { name: 'Sam', message: 'hi' }` and the "Checking you're human…" line; invalid input returns the reason message with status error and no effect; missing `--name` returns the usage hint; on curl, `sign` returns the web-only message. `who` and `guestbook` are `assistant: true`, `sign` is not (update `assistant-allowlist.test.ts`).
- [ ] T059 [P] [US3] Write `packages/shared/test/relative-time.test.ts` for `formatRelative(at, now)`: just now, minutes, hours, days, months, singular forms.
- [ ] T060 [P] [US3] Write `apps/web/e2e/guestbook.spec.ts` with `page.route` mocks for `/api/presence`, `/api/guestbook` and the Turnstile script (stub `window.turnstile` returning a token): (a) `who` shows the mocked count; (b) `guestbook` lists entries; (c) `sign "Hello" --name Tester` posts `{ name, message, turnstileToken }` and shows the thank-you; (d) a 429 `rate_limited` response shows its message and ↑ recalls the command; (e) an overlong message is refused client-side with no request sent; (f) `/gui#guestbook` lists entries, the form counter limits to 140, and submit works; (g) heartbeat `POST /api/presence` is sent on load with a UUID `sid`; (h) over curl (`user-agent: curl/8.0`) `/who`, `/guestbook` return text and `/sign` returns the web-only message.
- [ ] T061 [P] [US3] Add API checks to `apps/web/e2e/guestbook-api.spec.ts` against the real routes with Redis absent (the CI default): `POST /api/guestbook` with a valid body and no `TURNSTILE_SECRET_KEY` (CI runs `next start`, i.e. production) → 403 `human_check` (fail closed before Redis is touched); `POST` with a 141-char message → 422 `too_long` (validation runs before Redis); `POST /api/presence` with `sid: 'nope'` → 400; `DELETE /api/guestbook/x` → 404 when `ADMIN_TOKEN` is unset.

### Implementation for User Story 3

- [ ] T062 [P] [US3] Create `packages/shared/src/guestbook/blocklist.ts` (word list + `skeleton(text)`: lowercase, strip diacritics, leetspeak map, collapse repeats) and `packages/shared/src/guestbook/validate.ts` (`validateGuestbookEntry`, `GUESTBOOK_LIMITS = { name: 24, message: 140 }`, `SIGN_MESSAGES` per contracts/commands.md); export from `packages/shared/src/index.ts`. Make T057 pass.
- [ ] T063 [P] [US3] Create `packages/shared/src/guestbook/time.ts` with `formatRelative(at, now)`; make T059 pass.
- [ ] T064 [US3] Create `packages/shared/src/commands/live.ts` with `whoCommand`, `guestbookCommand`, `signCommand` per contracts/commands.md, and register `who`, `guestbook` (`assistant: true`, surfaces web+curl) and `sign` (`surfaces: ['web']`, args: positional `message` required, flag `--name`/`-n` string) with `man` pages in `packages/shared/src/commands/registry.ts`. Make T058 pass.
- [ ] T065 [P] [US3] Create `apps/web/lib/presence.ts` (research R19): `heartbeat(sid)` runs a Redis pipeline `ZADD presence:web now sid`, `ZREMRANGEBYSCORE presence:web -inf now-60000`, `ZCARD`, `EXPIRE presence:web 120`, then an `EVAL` that sets `presence_peak` in `surface:stats:<date>` only when larger; `count()` trims and returns `ZCARD` as `PresenceCount`; both return `null` when `redis` is null.
- [ ] T066 [US3] Create `apps/web/app/api/presence/route.ts`: checks run in this order: (1) `POST` body validation `{ sid: uuid v4, surface: 'web' }` → 400 on failure; (2) Redis absent → 503; (3) rate limit 60/min per IP (`rl:presence`, fail open, sized for many visitors behind one office network); then `POST` returns `heartbeat()` and `GET` returns `count()`; `Cache-Control: no-store`.
- [ ] T067 [P] [US3] Create `apps/web/lib/turnstile.ts` with `verifyTurnstile(token, ip)`: POST to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with `TURNSTILE_SECRET_KEY`, 3 s `AbortSignal.timeout`; returns false on any error; when the secret is unset returns `process.env.NODE_ENV !== 'production'` and logs a warning once.
- [ ] T068 [US3] Create `apps/web/lib/guestbook.ts` (research R20–R22): `listEntries(limit = 20)` (`LRANGE guestbook:v1 0 limit-1`, parse, skip bad JSON), `signEntry({ name, message, token, ip })` following the contracts/http-api.md processing order (validate → `verifyTurnstile` → per-visitor `Ratelimit.fixedWindow(1, '1 d')` keyed by SHA-256(`GUESTBOOK_SALT` + ip) → site-wide `fixedWindow(200, '1 d')` key `all` → `LPUSH` + `LTRIM 0 199`), failing closed on limiter errors; `deleteEntry(id)` (`LRANGE 0 199`, find by id, `LREM 1 <raw>`); ids are 12-char base62 from `crypto.getRandomValues`; record `guestbook_signed` / `guestbook_rejected` via `recordSurfaceEvent`.
- [ ] T069 [US3] Create `apps/web/app/api/guestbook/route.ts` (`GET` → `{ entries }`, 60/min fail open; `POST` → `signEntry` with status mapping 201/400/403/422/429/503 per contracts/http-api.md, body size ≤ 2 KB, visitor IP from `resolveVisitorIp`) and `apps/web/app/api/guestbook/[id]/route.ts` (`DELETE`: 404 when `ADMIN_TOKEN` unset, constant-time bearer compare (hash + `timingSafeEqual`), 401 on mismatch, 10/min per IP, 204/404/503).
- [ ] T070 [US3] Extend `packages/shared/src/surface/stats.ts`: `SurfaceEventKind` gains `gui_visits`, `guestbook_signed`, `guestbook_rejected`; `readSurfaceStats` returns those plus `presence_peak` (default 0). Update `packages/shared/test/surface-stats.test.ts`. Count `gui_visits` in `apps/web/middleware.ts` for `/gui` document navigations and non-prefetch RSC requests (`rsc: 1` header).
- [ ] T071 [US3] Add the `LiveServices` client to `apps/web/lib/live-services.ts` (`presence` → GET `/api/presence`, `guestbook` → GET `/api/guestbook`, both throwing on non-200) and a server implementation for curl (direct `count()` / `listEntries()`); pass `live` to `createShell` in `apps/web/hooks/useTerminal.ts` and to `runTextRequest` in `apps/web/app/api/term/route.ts`.
- [ ] T072 [P] [US3] Create `apps/web/hooks/usePresence.ts`: per-tab `sid` in `sessionStorage` (in-memory fallback), `POST /api/presence` on mount, every 30 s while `document.visibilityState === 'visible'`, and on becoming visible; returns the latest `PresenceCount | null`. Use it in `apps/web/components/Terminal.tsx` and `apps/web/app/gui/page.tsx` (via a client `PresenceBadge` in `apps/web/components/gui/PresenceBadge.tsx`, hidden when null).
- [ ] T073 [P] [US3] Create `apps/web/components/Turnstile.tsx` and a `getTurnstileToken()` helper in `apps/web/lib/turnstile-client.ts`: load `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` on first use only, render an invisible/managed widget with `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, resolve a token or reject after 10 s.
- [ ] T074 [US3] Apply the `sign` effect in `apps/web/hooks/useTerminal.ts` (like `ask`): get a Turnstile token, `POST /api/guestbook`, then append either `Thanks for signing, <name>!` + the entry, or the server `message` with error status; keep the command in history so ↑ recalls it; never run `sign` from a deep link (treat like `openUrl`: show text only).
- [ ] T075 [US3] Create `apps/web/components/gui/GuiGuestbook.tsx` (client, contracts/ui.md "Guestbook form"): list from `/api/guestbook`, form with name (`maxLength` 24) and message (`maxLength` 140, live counter), Turnstile loaded on first field focus, shared client validation, `aria-live="polite"` errors, typed text kept on failure, new entry prepended on success. Add the `#guestbook` section to `apps/web/app/gui/page.tsx` between skills and contact.
- [ ] T076 [US3] Run `npm test`, `npm run build:web`, `cd apps/web && CI=1 npx playwright test e2e/guestbook.spec.ts`, then the manual quickstart US3 steps against a real Upstash database (two browsers for `who`, the 1/day limit, filters, owner `DELETE`).

**Checkpoint**: US3 shippable; all three stories done.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T077 [P] Update `CLAUDE.md`: new commands (`gui`/`startx`, `who`, `guestbook`, `sign`, `theme crt`), new routes (`/gui`, `/api/presence`, `/api/guestbook`, `/api/guestbook/[id]`, `/api/skills`), new components/hooks/libs, and the env var table (`ADMIN_TOKEN`, `GUESTBOOK_SALT`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`).
- [ ] T078 [P] Update `README.md` with the GUI view, the motion features and how to delete a guestbook entry (`curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" …`).
- [ ] T079 Security pass over the diff: no secret in client bundles (grep the `.next/static` output for `TURNSTILE_SECRET_KEY`, `ADMIN_TOKEN`, `GUESTBOOK_SALT` values); every new route rate-limited; guestbook text rendered only as text (React) and stripped of control chars before ANSI.
- [ ] T080 Check the assistant: `who` and `guestbook` callable via `run_command`, guestbook text treated as untrusted tool output (add one injection-style guestbook message to an assistant eval fixture in `packages/shared/test/fixtures/` if the eval set covers `run_command` output), `npm run eval:assistant` unchanged pass rate.
- [ ] T081 Run the full gate: `npm run typecheck`, `npm test`, `npm run build:web`, `cd apps/web && CI=1 npx playwright test` (both projects), and the whole quickstart.md; record results and Lighthouse scores in `specs/005-living-portfolio/implementation-progress.md`.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories.
- **US1, US2, US3** each depend only on Phase 2 and can run in any order or in parallel.
- **Polish** after the stories you ship.

### Cross-story touch points (all optional, none blocking)

- T056 (GUI skill bars) needs US1 + US2.
- T075 (GUI guestbook section) and the GUI presence badge in T072 need US1; without US1 the terminal commands still ship.
- `apps/web/hooks/useTerminal.ts` and `apps/web/components/Terminal.tsx` are edited by all three stories: if stories run in parallel, serialise edits to these two files (T028/T029, T043/T047/T048/T051/T054, T071/T072/T074).

### Within each story

- Tests first (they should fail), then shared engine code, then server libs/routes, then web UI, then the story's verification task.

## Parallel Examples

### User Story 1

```text
T009 gui-command.test.ts         | T010 gui.spec.ts
T012 view-cookie.ts              | T014 Tailwind/motion install | T017 cx.ts + Reveal.tsx
T019 GuiNav | T020 GuiHero | T021 GuiAbout | T022 GuiTimeline | T023 GuiProjects | T024 GuiSkills | T025 GuiContact
```

### User Story 2

```text
T032 skill-evidence.test | T033 motion.test | T034 skills-bars tests | T035 motion.spec
T036 boot.ts | T037 reveal.ts | T038 inventory/skills.ts | T040 crt theme | T041 /api/skills
T044 useReducedMotion | T045 useTypewriter | T049 glitch CSS | T050 CrtFilter | T052 useIdle | T053 Screensaver
```

### User Story 3

```text
T057 validate.test | T058 live-commands.test | T059 relative-time.test | T060 guestbook.spec
T062 blocklist + validate | T063 time.ts | T065 presence.ts | T067 turnstile.ts | T072 usePresence | T073 Turnstile.tsx
```

## Implementation Strategy

### MVP first (US1 only)

1. Phase 1 + Phase 2.
2. Phase 3 (US1). Stop and validate with `gui.spec.ts`, Lighthouse and quickstart US1.
3. Merge: recruiters can already use the site without typing.

### Incremental delivery

1. US1 → merge (MVP).
2. US2 → merge (motion; then T056 if desired).
3. US3 → merge (presence and guestbook; needs `ADMIN_TOKEN`, `GUESTBOOK_SALT` and Turnstile keys set in Vercel before release).
4. Polish → merge.
