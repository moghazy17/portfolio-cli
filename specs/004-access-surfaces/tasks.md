# Tasks: Access Surfaces (deep links + curl; SSH deferred)

**Input**: Design documents from `specs/004-access-surfaces/`
**Prerequisites**: plan.md, spec.md, research.md (R1–R12), data-model.md, contracts/ (addresses, curl-http, web-deep-links), quickstart.md

**Tests**: Required by Constitution VIII. Engine logic gets Vitest tests and web flows get Playwright tests. There is no SSH smoke test because SSH is deferred.

**Organization**: tasks are grouped by user story. US3 (SSH) is deferred and has no tasks here.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 = deep links, US2 = curl

---

## Phase 1: Setup

**Purpose**: create the new shared module folder and its export.

- [X] T001 Create `packages/shared/src/surface/index.ts` re-exporting `./address` (and later `./curl`), and add `export * from './surface';` to `packages/shared/src/index.ts`. The main entry must stay client-safe: no `node:` imports in `src/surface/`.

---

## Phase 2: Foundational (blocks US1 and US2)

**Purpose**: the shared address grammar that the middleware, the curl route and the web client all use (contracts/addresses.md, data-model §1–2, research R1).

**⚠️ No user-story work starts until this phase is done.**

- [X] T002 [P] Write `packages/shared/test/address.test.ts` covering every row of the examples table in `contracts/addresses.md`, plus:
  - `parseAddress(toAddress(line))` round-trips to the same `tokenize()` tokens for every visible command name and for `projects | grep -i rag`, `skills "machine learning"`, `cd /projects && ls`
  - a 200-character line is accepted and a 201-character line gives `invalid/too-long`
  - a bad percent-encoding (`/%E0%A4%A`) gives `invalid/undecodable`
  - a control character gives `invalid/control-chars`; a tab is turned into a space
  - `/projects?cmd=skills` gives `invalid/ambiguous`
  - a trailing slash and upper case (`/Projects/`) give `command` with `line: 'projects'`
  - empty segments are dropped
  - filters have no path form: `toAddress('grep x')` uses the query form and `/grep` gives `not-command`
  - hidden commands (`sudo`, `rm`) never get the path form; `/sudo/hire-me` gives `not-command` with `line: 'sudo hire-me'`, and `/whatever/else` gives `not-command` with `line: 'whatever else'`
  - `isTextClient` is true for `curl/8.7.1`, `Wget/1.21`, `HTTPie/3.2.2`, `xh/0.22`, and false for Chrome/Safari/Firefox user agents, `Slackbot-LinkExpanding`, `''` and `null`
  - `wantsColor` is false for `?nocolor`, `?nocolor=1`, `?no_color`, `?cmd=x&nocolor`, and true otherwise
- [X] T003 Implement `packages/shared/src/surface/address.ts` per `contracts/addresses.md`:
  - `MAX_LINK_LENGTH = 200`
  - `routableCommandNames`: a lower-case set of the names and aliases of every non-hidden entry in `commandRegistry`, excluding `kind: 'filter'`
  - `parseAddress(pathname, search, names = routableCommandNames)` returning the data-model §1 union. Path segments are decoded with `decodeURIComponent` inside `try/catch`, and each segment becomes one argument, wrapped in double quotes with `"` and `\` escaped when it has whitespace or any of `|&;<>'"\`. Only the first `cmd` value is read, and only on `/`.
  - `toAddress(line, names)`: the path form when every `tokenize(line)` token matches `/^[A-Za-z0-9._~][A-Za-z0-9._~-]*$/` and the first token is in `names`; otherwise `/?cmd=` + `encodeURIComponent(line)` with `%20` replaced by `+`
  - `isTextClient(ua)` using `/^(curl|Wget|HTTPie|xh|aria2|libfetch|Lynx|w3m)\//i`
  - `wantsColor(search)`
  - Make T002 pass with `npm test -w @ahmed-moghazy/shared`.

**Checkpoint**: the address module is green in Vitest and exported from `@ahmed-moghazy/shared`.

---

## Phase 3: User Story 1 — Shareable deep links (P1) 🎯 MVP

**Goal**: a link runs its command on load. The address bar follows the last command. A link never opens sites, starts downloads or sends AI questions; a question goes into the prompt instead.

**Independent test**: the quickstart "Deep links" section, plus `apps/web/e2e/deep-links.spec.ts`, passes on its own with the US2 tasks not started.

### Tests for User Story 1

- [ ] T004 [P] [US1] Write `apps/web/e2e/deep-links.spec.ts`. Follow `apps/web/e2e/assistant.spec.ts` for its `page.route` / stream stub style. Cover:
  1. `/projects` shows the welcome banner and then `projects` output (assert a known project title from `content/resume.yaml`) with no typing, within 2 s of `load`.
  2. `/?cmd=projects%20%7C%20grep%20-i%20rag` shows the pipeline output.
  3. `/?cmd=open%20github`: `page.on('popup')` never fires, and the dim note "Opened from a link, so nothing was opened or downloaded" is visible.
  4. `/resume`: `page.on('download')` never fires, and the same note is visible.
  5. `/?cmd=what%20RAG%20work%20has%20he%20done%3F`: the prompt input has that value and is focused; a `page.route('**/api/chat')` stub records 0 requests; after Enter it records exactly 1 request.
  6. `/?cmd=` with 201 characters shows "This link couldn't be used", and nothing runs.
  7. Typing `skills` then Enter makes `page.url()` end with `/skills` within 1 s, and `page.goBack()` doesn't step to an earlier command. Typing `clear` makes the URL `/`.
  8. After `cd projects` and then `ls`, the URL decodes to `cd /projects && ls`.
  9. Asking a question by typing it leaves the URL unchanged.
  10. `/projct` and `/?cmd=projct` both open the terminal and show "did you mean" with no prefill; the `/projct` response carries `X-Robots-Tag: noindex`. `/whatever/else` opens the terminal with `whatever else` prefilled and 0 `/api/chat` requests.
  11. `/?cmd=theme%20dracula` applies the dracula theme; reloading `/` afterwards shows the default `matrix` theme (FR-009: no persistence).

### Implementation for User Story 1

- [X] T005 [US1] Create `apps/web/middleware.ts` (Edge) for the browser branch only, per `contracts/web-deep-links.md`:
  - `export const config = { matcher: ['/((?!api/|_next/|.*\\.[^/]+$).*)'] }`
  - pass through prefetch requests (`next-router-prefetch` / `purpose: prefetch` headers)
  - `parseAddress(nextUrl.pathname, nextUrl.search)`:
    - `command` with `form: 'path'` → `NextResponse.rewrite(new URL('/' + nextUrl.search, request.url))`
    - `not-command` → the same rewrite, with response header `X-Robots-Tag: noindex`
    - `invalid` → the same rewrite (plus `noindex` unless the path is `/`)
    - `root` → `NextResponse.next()`
  - Leave a clearly marked spot where T018 will add the text-client branch.
- [X] T006 [US1] Usage counters (data-model §7, research R10):
  - Create `packages/shared/src/surface/stats.ts` and export it from `surface/index.ts`. It must have no Node imports and must not import `@upstash/redis`. It takes a minimal injected client type `{ hincrby(key, field, n): Promise<number>; expire(key, s): Promise<unknown>; hgetall(key): Promise<Record<string, unknown> | null> }`.
    - `recordSurfaceEvent(client, kind: 'curl_requests' | 'curl_rate_limited' | 'deep_links', now = new Date())` does one `hincrby` on `surface:stats:<UTC YYYY-MM-DD>`, and calls `expire(key, 90 days)` only when `hincrby` returns 1. A null client is a no-op. Errors are caught and logged with `console.error('[surface] …')`.
    - `readSurfaceStats(client, days, now)` returns `{ daily: [{ date, curl_requests, curl_rate_limited, deep_links }] }`, or `null` for a null client.
  - Write `packages/shared/test/surface-stats.test.ts` with a recording fake client. Assert:
    - the only key written matches `/^surface:stats:\d{4}-\d{2}-\d{2}$/`
    - the only fields written are the three counters
    - no written key or field contains an IP-like string, path or command (FR-028, SC-011)
    - `expire` is called exactly once for two writes on the same day, and again on the next day
    - a throwing client doesn't throw
  - Create `apps/web/lib/surface-stats.ts`, which binds those helpers to `redis` from `./redis` (`recordSurfaceEvent(kind)`, `getSurfaceStats(days)`). It must import only `./redis` and `@ahmed-moghazy/shared`, so it is Edge-safe.
- [ ] T007 [US1] In `apps/web/middleware.ts`, count browser deep links: for `command` and `not-command` results that aren't prefetches **and** carry `Sec-Fetch-Dest: document` and `Sec-Fetch-Mode: navigate` (real top-level page loads), call `event.waitUntil(recordSurfaceEvent('deep_links'))`, using the `NextFetchEvent` second argument. The response must never wait on it. Depends on T005 and T006.
- [ ] T008 [US1] In `apps/web/app/api/chat-stats/route.ts`, add `surfaces: await getSurfaceStats(days)` to the default (non-`log`) JSON response, as an additive field. Keep the 503 behaviour unchanged when Redis is missing.
- [ ] T009 [P] [US1] In `apps/web/components/CommandLine.tsx`, add an optional `prefill?: { text: string; nonce: number } | null` prop. A `useEffect` keyed on `prefill?.nonce` calls `setInput(prefill.text)`, puts the caret at the end, and focuses `inputRef`. Pass it through from `apps/web/components/Terminal.tsx` (`prefill` from `useTerminal()`).
- [ ] T010 [US1] In `apps/web/hooks/useTerminal.ts`, implement the link run and the effect guard (research R7, contracts/web-deep-links.md):
  - change the signature to `handleCommand(input: string, opts: { origin?: 'typed' | 'link' } = {})`
  - when `origin === 'link'`:
    - skip `setShowWelcome(false)`
    - if `result.ask`: set `prefill` state `{ text: input, nonce: Date.now() }` and return before `push(input)`, before any history entry and before `runAssistant`
    - don't perform `openUrl` / `download`; if either was present, append `{ type: 'text', content: 'Opened from a link, so nothing was opened or downloaded. Use the link above.', style: { dim: true } }` to the entry's output
  - add a mount `useEffect` with a `ranLinkRef` guard (React Strict Mode safe):
    - parse `window.location.pathname` / `search`
    - for `command`, call `handleCommand(line, { origin: 'link' })`
    - for `invalid`, push a history entry with no prompt and the dim text `This link couldn't be used (<reason>). Type "help" to explore.`, using a readable reason string for each `reason`
  - return `prefill` from the hook
  - Existing typed behaviour must stay byte-for-byte the same; `apps/web/e2e/shell.spec.ts` and `assistant.spec.ts` must still pass.
- [ ] T011 [US1] In `apps/web/hooks/useTerminal.ts`, add address sync (research R8, data-model §4):
  - `syncAddress(line: string, cwdBefore: string)` with a 250 ms trailing debounce held in a ref, calling `window.history.replaceState(window.history.state, '', url)` inside `try/catch`
  - capture `cwdBefore` (`getShell().session.cwd`) before `run`
  - after a completed, non-cancelled, non-`ask` result in command mode:
    - `/` for `result.clear || result.welcome`
    - otherwise `toAddress(cwdBefore === '/' ? input : \`cd ${cwdBefore} && ${input}\`)`, or `/` if that address's decoded command line is over `MAX_LINK_LENGTH`
  - applies to both typed and linked runs; never called from chat mode
- [ ] T012 [US1] Run `npm run typecheck`, `npm test`, `npm run build:web`, then `cd apps/web && CI=1 npx playwright test e2e/deep-links.spec.ts e2e/shell.spec.ts e2e/assistant.spec.ts`. Fix failures, and note the middleware size from the build output in the PR description (plan Risks).

**Checkpoint**: US1 works on its own and can be merged without US2.

---

## Phase 4: User Story 2 — curl from your own terminal (P2)

**Goal**: text clients get colored or plain terminal text for any address, with 404 for unknown input, never the AI, rate-limited at 60/min, and counted.

**Independent test**: the quickstart "curl" section, plus `apps/web/e2e/curl.spec.ts` and `packages/shared/test/curl.test.ts`.

### Tests for User Story 2

- [ ] T013 [P] [US2] Write `packages/shared/test/curl.test.ts` for `runTextRequest` / `curlIndex` (contracts/curl-http.md, data-model §5):
  - `root` → 200; the body contains the banner, the example paths `/projects`, `/skills/`, `/?cmd=`, the no-color tip and the passed `origin`; it doesn't contain the `WELCOME_HINT` arrow-keys text
  - every `routableCommandNames` entry except `chat`, `theme`, `clear`, `github` → status 200 and a non-empty body
  - `chat`, `theme dracula` and `clear` → 400, with the body containing "only available in the interactive terminal" and `<origin>/chat`
  - an unknown command and the question `what is his stack?` → 404, body contains "command not found", the hint contains "open <origin> to ask the AI", and a spy `onUnknownCommand`/`fetch` shows no `ask` and no network call
  - `invalid` → 404 with "this link couldn't be used"
  - `color: false` → no `\x1b` anywhere for every command; `color: true` → `\x1b[` present for `projects`
  - `sudo hire-me` → only the final output is printed (no `****` frames)
  - `github` uses the injected `github` provider: a stub resolves `GitHubStats`, and a `fetch` spy records 0 calls
  - `not-command` (`whatever else`) → 404 not-found; `/sudo/hire-me` as `not-command` → 200 with the final output
  - `rateLimitedResponse` with a stub limiter:
    - `{ success: true }` → `null`
    - `{ success: false, reset: now + 12_500 }` → `{ status: 429, retryAfter: 13 }`, with a body that starts `Slow down — 60 requests per minute. Try again in 13s.` and ends with `\n`
    - a limiter whose `limit` throws → `null` (fails open)
    - a `null` limiter → `null`
  - the body ends with `\n`

### Implementation for User Story 2

- [ ] T014 [P] [US2] Engine changes for curl (research R5, R6):
  - `packages/shared/src/commands/registry.ts`: add `surfaces: ['web', 'ssh']` to `chat`, `theme`, `clear`.
  - `packages/shared/src/shell/shell.ts`: replace the message `` `${def.name}: not available on this surface` `` with `` `${def.name}: only available in the interactive terminal${options.origin ? ` — open ${options.origin}/${def.name}` : ''}` ``, and pass `options.github` into `CommandContext`.
  - `packages/shared/src/types.ts`: add `github?: (signal: AbortSignal) => Promise<GitHubStats>` to `CommandContext`, importing the type from `./github`, and the same to `ShellOptions` in `shell.ts`.
  - `packages/shared/src/commands/github.ts`: `githubCommand(ctx)` uses `ctx.github?.(ctx.signal) ?? fetchGitHubData(ctx.signal)`. Update the registry `execute` call accordingly.
  - `packages/shared/src/shell/unknown.ts`: on `ctx.surface === 'curl'` the dim hint reads `` Type `help` for commands, or open <origin> to ask the AI. `` (falling back to "the website" when `origin` is empty).
  - Update any existing tests in `packages/shared/test/` whose expected text changed, then run `npm test -w @ahmed-moghazy/shared`.
- [ ] T015 [US2] Implement `packages/shared/src/surface/curl.ts` and export it from `surface/index.ts`:
  - `curlIndex(origin)` builds `CommandOutput[]`: the `ASCII_BANNER` (ascii, primary), `WELCOME_SUBTITLE` (bold), a divider, a `section` "Try" listing:
    - `curl <host>/about`
    - `curl <host>/projects`
    - `curl <host>/skills/<category>` (with the first category's slug from content)
    - `curl <host>/experience/<company>`
    - `curl "<host>/?cmd=projects | grep -i rag"` (shown readable; it notes that spaces need quoting or `%20`)
    - `curl "<host>/projects?nocolor"`
    - the alias tip from research R4
    - `Interactive terminal and AI assistant: <origin>`
  - `runTextRequest({ address, color, origin, github })`:
    - `root` → `curlIndex`
    - `invalid` → an error line plus `try: curl <host>`, with status 404
    - `not-command` → run `address.line` exactly like `command` (so unknown input gets the shell's not-found output and suggestion, and hidden commands such as `sudo hire-me` run)
    - `command` → `createShell({ surface: 'curl', origin, onUnknownCommand: createAssistantUnknownHandler(), github }).run(line)`
    - ignore every effect; when `result.sequence` is set, print only `result.output`
    - status: 200 if ok; 404 if the routed word is not a registry command or the address is invalid; otherwise 400
    - body: `renderAnsi(output, { color })`, guaranteeing a trailing `\n`
  - `rateLimitedResponse(limiter: { limit(id: string): Promise<{ success: boolean; reset: number }> } | null, id: string, now = Date.now())` returns `null` or `{ status: 429, retryAfter, body }`, with `retryAfter = max(1, ceil((reset - now) / 1000))`. It returns `null` on a null limiter or a thrown error, after logging it.
  - Make T013 pass. Depends on T014.
- [ ] T016 [P] [US2] Create `apps/web/lib/github-stats.ts`:
  - `getGitHubStatsCached(signal)`: first an in-process memo (10 minutes), then Redis `gh:stats:v1` (JSON, `ex: 600`), then `fetchGitHubData(signal)`, using a `fetch` wrapper that adds `Authorization: Bearer ${process.env.GH_INVENTORY_TOKEN}` when that variable is set
  - write-through to Redis and the memo; Redis errors are logged and ignored
  - If `fetchGitHubData` doesn't accept a custom fetch yet, add an optional second parameter `fetchImpl: typeof fetch = fetch` in `packages/shared/src/github.ts`. This is additive; web callers are unchanged.
- [ ] T017 [US2] Create `apps/web/app/api/term/route.ts` (`export const dynamic = 'force-dynamic'`, Node runtime), per contracts/curl-http.md:
  - read `__path` and the remaining query from `request.url`
  - build `limiter = redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m'), prefix: 'rl:curl' }) : null` once at module scope, then call the shared `rateLimitedResponse(limiter, resolveVisitorIp(request.headers, undefined))`. If it returns a 429: `await recordSurfaceEvent('curl_rate_limited')`, then respond with that status, its body and `Retry-After: <retryAfter>`.
  - otherwise `await recordSurfaceEvent('curl_requests')` before returning (it never throws)
  - call `runTextRequest({ address: parseAddress(path, search), color: wantsColor(search), origin: new URL(request.url).origin, github: getGitHubStatsCached })`
  - respond with headers `Content-Type: text/plain; charset=utf-8`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Vary: User-Agent`
  - Depends on T006, T015, T016.
- [ ] T018 [US2] In `apps/web/middleware.ts`, add the text-client branch before the browser logic:
  - if `isTextClient(request.headers.get('user-agent'))` and the path is `/`, a routable command path, an invalid address or a `not-command` path, rewrite to `/api/term?__path=<encodeURIComponent(pathname)>&<original search params>`
  - text clients never reach the deep-link counter
  - Depends on T005 and T017.
- [ ] T019 [US2] Write `apps/web/e2e/curl.spec.ts` using Playwright's `request` fixture with header `User-Agent: curl/8.7.1`:
  - `/projects`: 200, `content-type` starts with `text/plain`, and the body contains `\x1b[` and a known project title
  - `/projects?nocolor`: no `\x1b`
  - `/?cmd=projects%20%7C%20grep%20-i%20rag`: 200
  - `/nonsense`: 404 with "command not found"
  - `/?cmd=what%20is%20his%20stack`: 404 and the body contains "command not found". That no AI call happens is proven in T013, not here.
  - `/`: 200 guide containing `/projects`
  - the same `/projects` with a Chrome user agent: 200 `text/html` (SC-005)
  - `/api/content` with the curl user agent is still JSON
  - Depends on T018.
- [ ] T020 [US2] Run `npm run typecheck`, `npm test`, `npm run build:web`, then `cd apps/web && CI=1 npx playwright test`. Also run the quickstart curl commands manually against `npx next start -p 3100` and paste the colored output into the PR description.

**Checkpoint**: US1 and US2 both work; curl never reaches the assistant.

---

## Phase 5: Polish & Cross-Cutting

- [ ] T021 [P] Update `README.md`: a "Share a view" section with `/projects` and `/?cmd=` link examples and the "links never act for you" note, and a "From your terminal" section with `curl moghazy.me`, `curl moghazy.me/projects`, `?nocolor` and the alias tip. Keep the existing "coming soon: `ssh term.moghazy.me`" note.
- [ ] T022 [P] Update `CLAUDE.md`:
  - under Web App Flow, add `middleware.ts` (text-client and browser routing, deep-link counter), `app/api/term/route.ts`, `lib/surface-stats.ts` and `lib/github-stats.ts`
  - under the shared package, add `src/surface/` (`parseAddress`, `toAddress`, `runTextRequest`, `curlIndex`)
  - under Key Patterns, add "links run commands but never perform `openUrl`/`download`/`ask`"
  - note that `/api/chat-stats` now includes `surfaces.daily`
- [ ] T023 [P] Update the root `plan.md` roadmap: mark Spec 003 (repo `specs/004-access-surfaces`) as deep links + curl shipped, with SSH deferred for hosting cost and moved to a later milestone. Add the Vercel apex-domain step.
- [ ] T024 Manual deploy step (Ahmed): in the Vercel dashboard, make `moghazy.me` serve the deployment directly instead of 307-redirecting to `www` (research R12). Then run the quickstart "Production checks" and confirm `/api/chat-stats` shows `surfaces.daily` the next day.

---

## Dependencies & Execution Order

```text
T001 ─► T002 ∥ T003 (T003 makes T002 green)
           │
           ├─► US1: T004 ∥ T009 ; T005 ─► T007 (needs T006) ; T006 ─► T008 ; T010 ─► T011 ─► T012
           │
           └─► US2: T013 ∥ T014 ∥ T016 ; T014 ─► T015 ; (T006,T015,T016) ─► T017 ─► T018 ─► T019 ─► T020
                                                                        ▲
Polish: T021–T023 after their story lands; T024 after deploy.   T005 (middleware file exists)
```

- US2 depends on US1 only through two files: `middleware.ts` (T005, which creates the file) and `lib/surface-stats.ts` (T006). If US2 must ship first, do T005 (skeleton only) and T006 inside US2.
- The same files are edited in sequence: `useTerminal.ts` (T010 → T011), `middleware.ts` (T005 → T007 → T018), `shell.ts`/`types.ts` (T014 only).

## Parallel Examples

```text
US1: T004 (Playwright spec) ∥ T009 (CommandLine prefill) ∥ T006 (shared stats + test + web binding) — then T005/T007, T010/T011
US2: T013 (curl.test.ts) ∥ T014 (engine changes) ∥ T016 (github-stats)
```

## Implementation Strategy

1. **MVP**: Phases 1–3 (deep links). Merge after T012 is green.
2. **Increment**: Phase 4 (curl). Merge after T020 is green, then do T024 in the Vercel dashboard.
3. **Polish**: T021–T023 go in the same PR as the story they document.
4. **Later spec**: SSH, starting from the spec's "Deferred: SSH terminal" section.

## Notes

- No new npm packages, services or secrets. `GH_INVENTORY_TOKEN` already exists on Vercel.
- Never call `/api/chat` from link handling or from `/api/term`. Tests T004.5, T004.10 and T013 enforce this.
- Commit after each task or logical group. PRs must state the surfaces affected (web, curl) and how each was verified (constitution workflow).
