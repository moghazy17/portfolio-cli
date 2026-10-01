# Research: Access Surfaces (deep links + curl)

Scope: US1 (deep links) and US2 (curl). US3 (SSH) is deferred (spec → "Deferred: SSH terminal"),
so nothing here adds a host, an app or a paid service.

Facts checked in the code before deciding:

- `createShell({ surface, origin, onUnknownCommand })` already takes the surface. No command
  sets `surfaces` today except the filters, so every command currently runs on curl.
- The engine returns effects (`openUrl`, `download`, `theme`, `sequence`, `ask`, …) and never
  performs them. `useTerminal.handleCommand` performs them. The AI is only called by the host
  when `result.ask` is set, so a deep-link guard can live entirely in the host.
- `createAssistantUnknownHandler()` already returns the default not-found result when
  `surface === 'curl'` (rule 1 in `specs/003-github-aware-assistant/contracts/shell-integration.md`).
- `renderAnsi(output, { color, width, theme })` exists. `width` is accepted but unused, and
  `color: false` already drops styles and OSC 8 hyperlinks. `toLines()` renders links as
  `text: url`, so no-color output keeps the URL.
- `sudo hire-me` returns a `sequence` plus a `mailto:` **link** node. It never opens anything by
  itself, so it needs no extra guard.
- The web theme is not persisted (`useThemeApplier` is plain `useState`), so FR-009 holds as
  long as this feature doesn't add persistence.
- `github` calls `api.github.com` with `fetch` from wherever the shell runs. On the web that's
  the visitor's browser. Over curl it would be Vercel's shared egress IPs (60 unauthenticated
  requests/hour, shared).
- Next.js is 15.5.12 and there is no `middleware.ts` yet. `@upstash/ratelimit` and
  `lib/redis.ts` (null when unconfigured) are already used by `/api/content` and `/api/chat-stats`.
- `resolveVisitorIp(headers, undefined)` gives `x-real-ip` / first `x-forwarded-for`.

---

## R1. One address format for browsers and curl

**Decision**: a pure, shared module `packages/shared/src/surface/address.ts`:

- `parseAddress(pathname, search, names) → AddressResult` (see data-model §1).
- `toAddress(commandLine, names) → string` (the canonical address for the address bar).

Rules:

- `/` with no `cmd` is the root.
- `/?cmd=<line>` is a full command line, URL-decoded.
- `/<command>[/<arg>…]` is a command path. Each segment is decoded and becomes one argument,
  re-quoted for the tokenizer, so `/skills/machine%20learning` becomes
  `skills "machine learning"`. The first segment must be a visible (non-hidden) command name
  or alias, case-insensitive.
- A command path plus `cmd` is invalid, because it's ambiguous.
- The decoded command line is capped at 200 characters. Longer, undecodable or
  control-character input is `invalid`.
- The path form is used only when every token is "path-safe" (`[A-Za-z0-9._~-]+`, not starting
  with `-`) and the first token is a visible command. Otherwise the query form is used. So
  `projects` → `/projects`, `skills llm` → `/skills/llm`, `projects | grep -i rag` →
  `/?cmd=projects+%7C+grep+-i+rag`.
- Hidden commands (`sudo`, `rm`, …) always use the query form, so they don't appear as
  crawlable paths.

**Rationale**: one function pair used by middleware, the curl handler and the web client
makes it impossible for "the same address" to mean different things on different surfaces
(clarification Q1). Pure functions are easy to cover with Vitest.

**Alternatives**: a separate format per surface was rejected in clarification. A catch-all
Next route (`app/[[...cmd]]/page.tsx`) was rejected because it would make every path
dynamic and change how the SEO page is served. Middleware rewrites keep `/` static.

## R2. Telling curl from browsers, and routing

**Decision**: add `apps/web/middleware.ts` (Edge runtime) with a matcher that skips
`/api/`, `/_next/` and any path with a file extension (`/cv/latest.pdf`, `/favicon.ico`).

- **Text client**: `User-Agent` matches `^(curl|Wget|HTTPie|xh|aria2|libfetch|Lynx|w3m)\/`
  (case-insensitive). Root, command paths, `?cmd` links and unknown first segments are all
  rewritten to `/api/term` with the original path and query carried in query params. Unknown
  input then gets not-found text and a 404 status (FR-014), not the HTML 404 page.
- **Browser**: root → pass through. A command path → `NextResponse.rewrite('/')`, keeping the
  query, so the static page is served and the address bar keeps `/projects`. An invalid
  address → rewrite to `/`, and the client shows the notice. An unknown first segment
  (`/projct`, `/whatever/else`) → also rewrite to `/` with `X-Robots-Tag: noindex`. The client
  runs the segments as typed input from a link, so a typo shows "did you mean", the same as
  curl's not-found text, and free text is prefilled but not sent. (Analysis I1: every
  browser address now opens the terminal, matching the spec's typo edge case and FR-010.)
- Prefetches (`next-router-prefetch` / `purpose: prefetch`) are passed through untouched.

**Rationale**: the decision has to happen before the CDN serves the cached `/` HTML, and
middleware is the one place that runs before it. User-agent matching is the documented
assumption ("clients that disguise themselves as browsers get the web terminal").

**Alternatives**: content negotiation on `Accept` was rejected because curl sends `*/*`.
A separate `/txt/...` prefix was rejected because it breaks "the same link works in curl".

**Edge bundle**: the middleware needs the visible command names. It imports
`routableCommandNames` from `@ahmed-moghazy/shared`, which pulls in the registry and
generated content. That's client-safe code and small (the content is about 25 KB), well
inside the Edge limit. The build step in CI is the check.

## R3. curl handler

**Decision**: the logic lives in a shared pure function, and the route stays thin.

- `packages/shared/src/surface/curl.ts`: `runTextRequest({ address, color, origin, shellOptions }) → { status, body }`.
  It runs `createShell({ surface: 'curl', origin, onUnknownCommand: createAssistantUnknownHandler() })`,
  so rule 1 guarantees no `ask`. Ignored effects: `clear`, `mode`, `theme`, `openUrl`,
  `download`, `ask`. A `sequence` is skipped and only its final `output` is printed. The
  output is rendered with `renderAnsi`.
- The root returns `curlIndex(origin)`: the banner and subtitle, then a short guide built from
  the registry. It lists example paths (`/about`, `/projects`, `/skills/<category>`,
  `/experience/<company>`, `/?cmd=projects+%7C+grep+-i+rag`), the no-color option and the web
  address. It doesn't use `WELCOME_HINT`, which talks about arrow keys and a menu.
- Status: `200` when the status is ok; `404` for an unknown command or an invalid address; `400`
  for other command errors (bad arguments, "not available on curl", "no project matching").
- `apps/web/app/api/term/route.ts` (Node runtime) does four things: rate limit, record usage,
  call `runTextRequest`, return `text/plain; charset=utf-8` with `Cache-Control: no-store`,
  `X-Content-Type-Options: nosniff` and `Vary: User-Agent`.

**Rationale**: Constitution II (renderers stay thin; output is assembled in shared). The
whole surface can be tested in Vitest without starting Next.

## R4. No-color option

**Decision**: `nocolor` or `no_color` in the query, with any value or none (`?nocolor`,
`?nocolor=1`, `&no_color`), turns off all escape codes. The guide documents it and suggests
a shell function for people who use the `NO_COLOR` convention:
`portfolio() { curl -sG moghazy.me -d nocolor --data-urlencode "cmd=$*"; }`.
Full command lines in the guide use `curl -G … --data-urlencode "cmd=…"`, because curl
rejects URLs that contain spaces (verified with curl 8.17).

**Rationale**: a client's `NO_COLOR` environment variable is never sent over HTTP, so the
server can't honour it directly. The spec's FR-013 was reworded to match.

## R5. Commands that don't belong on curl

**Decision**: set `surfaces: ['web', 'ssh']` on `chat`, `theme` and `clear`. Change the
engine's surface message (currently `"<name>: not available on this surface"`) to
`<name>: only available in the interactive terminal — open <origin>/<name>` (the deep link),
falling back to the bare name when there's no origin. Change the default not-found hint on
curl from "or `chat` to ask the AI" to "or open <origin> to ask the AI", using `ctx.surface`.

`welcome`, `open`, `resume`, `sudo`, `cd` and `exit` stay available. Their text output makes
sense on its own (`resume` already prints the URL on non-web surfaces).

**Alternatives**: hiding these commands from curl's `help` was rejected because `help` is
shared and the message is clearer.

## R6. `github` over curl

**Decision**: add an optional `github?: (signal: AbortSignal) => Promise<GitHubStats>` to
`ShellOptions`, passed through as `CommandContext.github`. `githubCommand` uses it when
present and falls back to `fetchGitHubData` otherwise, so web behaviour is unchanged. The curl
route supplies `getGitHubStatsCached()` in `apps/web/lib/github-stats.ts`. It calls
`fetchGitHubData` with a `fetch` that adds `Authorization: Bearer GH_INVENTORY_TOKEN` when
set, and memoizes the result in Redis (`gh:stats:v1`, 10-minute TTL) and in process. Without
Redis or a token it degrades to a direct call.

**Rationale**: otherwise one busy minute of curl traffic would exhaust GitHub's shared
unauthenticated limit for every curl visitor. The token already exists for the assistant's live
tools, so this adds no new secret.

## R7. Deep-link execution in the web host

**Decision**: changes stay in `apps/web/hooks/useTerminal.ts`. The engine doesn't change.

- On mount, `parseAddress(location.pathname, location.search, routableCommandNames)`:
  - `root` → nothing happens.
  - `invalid` → append a dim notice ("This link couldn't be used: …") and run nothing.
  - `command` → `handleCommand(line, { origin: 'link' })`.
- `handleCommand(input, { origin })`, when `origin === 'link'`:
  - keeps the welcome screen (it doesn't call `setShowWelcome(false)`)
  - drops `openUrl` and `download`, and appends a dim line: "Opened from a link, so nothing was
    opened or downloaded. Use the link above." (`resume` also prints "Downloading resume…",
    and the line explains why nothing started.)
  - if `result.ask` is set, adds no history entry and doesn't call `runAssistant`. Instead it
    sets `prefill = { text: input, nonce }`, which `CommandLine` puts into its input and
    focuses. Pressing Enter goes through the normal typed path.
  - `theme`, `mode: 'chat'`, `sequence` and `welcome` are applied as if typed (spec edge case).
  - commands are pushed to command history; a prefilled question is not, until it's sent.
- The run happens once per page load. A ref guard covers React Strict Mode's double effect.

**Rationale**: the AI call, `window.open` and the download anchor are all host code, so
guarding there keeps the engine untouched and the web/SSH parity contract unchanged.
Prefilling needs no assistant request at all (FR-005, SC-002).

## R8. Keeping the address bar in sync

**Decision**: `syncAddress(line, cwdBefore)` runs after each completed typed or linked command:

- skipped for cancelled runs, `ask` results (questions, FR-008) and anything in chat mode
- `clear` / `welcome` → `/`
- otherwise `toAddress(cwdBefore === '/' ? line : \`cd ${cwdBefore} && ${line}\`)`, so
  relative paths reproduce exactly (SC-003). If that is over 200 characters, use `/` rather
  than a link that can't be opened.
- writes with `history.replaceState(history.state, '', url)` (no new back entries), coalesced
  with a 250 ms trailing debounce and wrapped in `try/catch`. Safari throws after about 100
  `replaceState` calls in 30 s, so the debounce prevents that.

**Rationale**: FR-007 / SC-003, with no back-button spam.

## R9. Rate limiting the curl route

**Decision**: `Ratelimit.slidingWindow(60, '1 m')`, prefix `rl:curl`, keyed by
`resolveVisitorIp(headers, undefined)`. If it's exceeded: `429`, `Retry-After`, and a
readable text body ("Slow down — 60 requests per minute. Try again in Ns."). It **fails open**
when Redis is missing or erroring, matching `/api/content`.

The decision lives in a shared pure helper, `rateLimitedResponse(limiter, id, now)`
(`packages/shared/src/surface/curl.ts`), that accepts any `{ limit(id) }` object. That makes
the 429 path, the `Retry-After` value and the fail-open path testable in Vitest with a stub
(analysis C1). The route only constructs the Upstash limiter.

When the limiter is missing (local development) the helper returns `null` silently. When it throws in production, the helper logs `console.error('[curl] rate limiter unavailable, allowing request:', error)` before allowing the request, matching `/api/content` (analysis K1).

**Rationale**: Constitution V requires a rate limit. Failing open is acceptable here because
the curl route only serves static content and can't run up costs, unlike the assistant's limits,
which fail closed.

## R10. Usage totals

**Decision**: Redis hash `surface:stats:<YYYY-MM-DD>` (UTC) with a 90-day TTL, matching
`chat:stats:` retention. Fields: `curl_requests`, `curl_rate_limited`, `deep_links`.

- `curl_requests` and `curl_rate_limited` are counted in `/api/term`.
- `deep_links` is counted in middleware for browser deep-link requests (command path, `?cmd`
  link or non-command path) that are real top-level page loads (`Sec-Fetch-Dest: document`
  and `Sec-Fetch-Mode: navigate`), skipping prefetches. It uses `event.waitUntil(...)`, so the
  page isn't delayed. Most link-preview bots and scripts don't send those headers, so they
  aren't counted.
- **Cost bound (analysis S1)**: every write goes through the shared
  `recordSurfaceEvent(client, kind, now)` in `packages/shared/src/surface/stats.ts`. It issues
  exactly one `hincrby` and calls `expire` only when that returns 1 (the first write of the
  day). A client faking browser headers can inflate the count, but each request costs exactly
  one Redis command, the same order as the per-request limiter check `/api/content` already
  does. This is accepted rather than adding a per-IP limiter, which would itself cost 2–3
  commands for every real visitor.
- `/api/chat-stats` adds `surfaces: { daily: [{ date, curl_requests, curl_rate_limited, deep_links }] }`.
  It's an additive JSON field; existing fields are unchanged.
- Nothing stores addresses, paths or commands (FR-028). The rate limiter keeps IPs only inside
  Upstash's own short-lived limiter keys, as `/api/content` already does.

**Alternatives**: a client beacon endpoint was rejected because it would be another public
endpoint to rate-limit, and middleware already sees every deep-link request.

## R11. Testing

- **Vitest (shared)**: `address.test.ts` covers parse and format round-trips, the cap,
  invalid input, hidden commands and `cd` prefixing. `curl.test.ts` covers every visible
  command returning 200 text, unknown → 404 with no `ask`, interactive-only → 400 with the web
  pointer, no escape codes with no-color (regex `/\x1b/`), the root guide, sequence flattening,
  and the injected `github` provider being used.
- **Playwright (web)**: deep link pre-runs (`/projects`, `/?cmd=projects|grep -i rag`);
  `open github` raises no `popup` event; `resume` raises no `download` event; a question link
  prefills, with `page.route('/api/chat')` asserting 0 requests, and Enter then sends exactly 1;
  the address updates after a typed command and `clear` resets it; an invalid link shows the
  notice. Curl checks use `request.get` with `User-Agent: curl/8.7.1`: `/projects` returns
  `text/plain` containing ANSI codes, `?nocolor` returns none, and an unknown path returns 404.
  The same path without the curl user agent returns `text/html` (SC-005).
- No SSH smoke test: Constitution VIII's SSH item applies once `apps/ssh` exists.

## R12. The apex domain redirect

**Problem**: `moghazy.me` currently 307-redirects to `www.moghazy.me` (see the root `plan.md`).
Vercel applies domain redirects before middleware runs. So `curl moghazy.me/projects`, the
headline example, would print nothing without `-L`.

**Decision**: change the domain settings in the Vercel dashboard so the apex serves the
deployment directly. Either make `moghazy.me` the primary domain with `www` redirecting to it,
or remove the redirect. It costs nothing and needs no code. The curl guide prints its own
request origin, so it stays correct either way. Until the change is made, the docs show
`curl -L moghazy.me`.

**Alternatives**: keeping `www` as the only working address for curl and documenting `-L`
everywhere. It's ugly for the headline command and easy for visitors to get wrong.
