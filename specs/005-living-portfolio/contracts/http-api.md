# Contract: HTTP Routes

All routes live in `apps/web/app/api/` (and `app/gui/` for the page). JSON bodies are UTF-8.
Every route is rate-limited (Principle V). When Redis is not configured, the data routes answer
`503 { "error": "unavailable" }` and the UI shows its "unavailable" message.

## `POST /api/presence` — heartbeat

Request:

```json
{ "sid": "3f6c1a8e-…-uuid-v4", "surface": "web" }
```

Responses:

| Status | Body |
|---|---|
| 200 | `PresenceCount` — `{ "total": 3, "bySurface": { "web": 3 }, "at": "2026-10-02T10:00:00.000Z" }` |
| 400 | `{ "error": "bad_request" }` (sid not a UUID v4, surface not `web`) |
| 429 | `{ "error": "rate_limited" }` + `Retry-After` |
| 503 | `{ "error": "unavailable" }` |

- Check order: body validation (400), then Redis present (503), then limit 60/min per IP, fail
  open. `Cache-Control: no-store`.
- Side effects: ZADD/trim/ZCARD on `presence:web`; raises `presence_peak`.

## `GET /api/presence` — read count (used by `who`)

200 `PresenceCount`; 429; 503. Does not add the caller. `Cache-Control: no-store`.

## `GET /api/guestbook`

| Status | Body |
|---|---|
| 200 | `{ "entries": GuestbookEntry[] }` newest first, at most 20 |
| 429 | `{ "error": "rate_limited" }` |
| 503 | `{ "error": "unavailable" }` |

- Limit: 60/min per IP, fail open. `Cache-Control: no-store`.

## `POST /api/guestbook` — sign

Request:

```json
{ "name": "Sam", "message": "Love the terminal!", "turnstileToken": "0.xxxx" }
```

Processing order (each step stops on failure, nothing stored):

1. Parse; body over 2 KB → 400 `bad_request`.
2. `validateGuestbookEntry` → 422 with reason `empty | too_long | link | contact | blocked`.
3. Turnstile `siteverify` (3 s timeout) → 403 `human_check` on failure, timeout or missing token.
4. Per-visitor limiter (1/day) → 429 `rate_limited`; site-wide limiter (200/day) → 429 `daily_cap`;
   limiter error → 503 `unavailable` (fail closed).
5. `LPUSH` + `LTRIM 0 199` → 201 with the stored entry.

Responses (all match `SignResult` in data-model.md):

| Status | Body |
|---|---|
| 201 | `{ "ok": true, "entry": GuestbookEntry }` |
| 400 | `{ "ok": false, "reason": "bad_request", "message": "…" }` |
| 403 / 422 / 429 / 503 | `{ "ok": false, "reason": "<code>", "message": "<shared message>" }` |

- Counters: `guestbook_signed` on 201; `guestbook_rejected` on 403/422/429.
- Validation failures (step 2) do not consume the rate limit.

## `DELETE /api/guestbook/{id}` — owner deletion

Header: `Authorization: Bearer <ADMIN_TOKEN>`

| Status | Meaning |
|---|---|
| 204 | Deleted |
| 401 | Missing or wrong token |
| 404 | `ADMIN_TOKEN` unset (route hidden) or no entry with that id |
| 429 | Over 10/min per IP |
| 503 | Redis unavailable |

Example: `curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" https://moghazy.me/api/guestbook/a1B2c3D4e5F6`

## `GET /api/skills` — skill evidence

| Status | Body |
|---|---|
| 200 | `{ "evidence": { "Python (Advanced)": 9, "SQL": 3, "LangChain": 2, "C++": 0, … }, "generatedAt": "<inventory time>" }` |
| 404 | `{ "error": "no_inventory" }` (missing or stale inventory → client shows plain list) |
| 429 | rate limited (30/min per IP, fail open) |

`Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.

## `GET /api/chat-stats` (changed)

`surfaces.daily[]` items gain `gui_visits`, `guestbook_signed`, `guestbook_rejected`,
`presence_peak` (numbers, default 0). Auth and limits unchanged.

## `GET /gui` — regular page

- Static HTML, indexable, self-canonical, own title/description, OG image reused.
- Middleware: browsers pass straight through (never rewritten as a deep link); text clients get the
  `gui` command over curl. Counts `gui_visits` for document and non-prefetch RSC navigations.

## `GET /` (changed middleware behaviour)

- Browser, path exactly `/`, empty query, cookie `view=gui` → `307 Location: /gui`,
  `Cache-Control: private, no-store`, `Vary: Cookie`.
- Everything else as in spec 004.

## `/api/term` (curl) — changed

- Injects `live` (direct Redis reads) and `skillEvidence` (from the inventory store) into the shell, so
  `curl moghazy.me/who`, `/guestbook` and `/skills` show live data. `sign` returns the web-only message.
