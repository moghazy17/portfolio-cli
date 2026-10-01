# Contract: Text (curl) HTTP interface

## Routing

`apps/web/middleware.ts`

- Matcher: `['/((?!api/|_next/|.*\\.[^/]+$).*)']`. Everything else passes through untouched.
- When `isTextClient(ua)` is true, rewrite to `/api/term?__path=<pathname>&<original query>`.
- For browsers, see `web-deep-links.md`.

`/api/term` can also be called directly (it is not secret). It always returns text, whatever the user agent.

## Request

```text
GET <any page address>          (User-Agent: curl/8.x, Wget/1.x, HTTPie/3.x, …)
    ?nocolor=1 | ?no_color=1    → no escape codes at all (a bare ?nocolor is normalised by the middleware)
```

## Response

| Case | Status | Body |
|---|---|---|
| Root | 200 | `curlIndex(origin)`: banner, subtitle, example paths, no-color tip, web address |
| Known command, ok | 200 | `renderAnsi(output, { color })` |
| Known command, error (bad args, "no project matching", "only available in the interactive terminal") | 400 | rendered output |
| Unknown command (including questions and non-command paths such as `/nonsense`) | 404 | default not-found output with suggestion; hint says "open <origin> to ask the AI" |
| Invalid address | 404 | `error: this link couldn't be used (<reason>)` + `try: curl <origin>` |
| Rate limited | 429 | `Slow down — 60 requests per minute. Try again in <n>s.` + `Retry-After` |

Headers on every response:

```text
Content-Type: text/plain; charset=utf-8
Cache-Control: no-store
X-Content-Type-Options: nosniff
Vary: User-Agent
```

## Guarantees

- The shell is created with `surface: 'curl'`. `createAssistantUnknownHandler()` never returns `ask` on curl, and the route never calls `/api/chat` or any model (FR-014).
- These effects are ignored: `clear`, `mode`, `theme`, `openUrl`, `download`, `ask`. For a `sequence`, only the final `output` is printed.
- Colored output uses the default theme's 24-bit colors plus OSC 8 hyperlinks. With no color there are 0 bytes of `\x1b`, and links still print as `text: url`.
- The body always ends with a newline.
- The rate limit is 60 requests per minute per `resolveVisitorIp(headers, undefined)`. It fails open when Redis is absent or errors. The decision and the 429 response are produced by the shared pure helper `rateLimitedResponse(limiter, id, now)` in `packages/shared/src/surface/curl.ts`. It takes any `{ limit(id) → { success, reset } }` object and returns `null` (allowed) or `{ status: 429, retryAfter, body }`, and it returns `null` when `limiter` is null or `limit` throws (logging the error in the second case). The route only wires in `@upstash/ratelimit`.
- `github` is served through the cached server-side provider (`lib/github-stats.ts`), never through unauthenticated calls per request.
- Usage: `curl_requests` is incremented on every request that passes the limiter, and `curl_rate_limited` on every 429, through the shared `recordSurfaceEvent`. Nothing else about the request is stored.
