# Contract: Shell Commands

New and changed commands in `packages/shared/src/commands/`. All return structured `CommandOutput`
(Principle II). Surfaces: W = web, C = curl, S = SSH (when it ships).

## `gui` (alias `startx`)

| | |
|---|---|
| Usage | `gui` |
| Surfaces | W, C |
| Menu | yes ("GUI view") |
| Assistant | no |

- **Web**: output `Opening the regular page…` and effect `view: 'gui'`. The host navigates to `/gui`
  (client navigation) and sets the `view=gui` cookie. Allowed from deep links (display only).
- **curl**: text `Prefer a regular web page? Open <origin>/gui`, status ok, no effect.
- `startx` is an alias, listed in `man gui` ("startx — the classic way to start a desktop").

## `theme crt`

- `crt` is added to `themes` and to `theme` completion. `theme crt` returns `theme: 'crt'` like
  other themes; the host applies colours and, because `effects.crt` is set, the CRT overlay.
- curl: unchanged (themes are web-only today).

## `skills [category]` (changed)

- When `ctx.skillEvidence` is provided and resolves: per category, a section whose children are
  `progress` nodes, one per skill: `{ label, value, note: 'N repos' | '1 repo' | 'no public repos', reveal: true }`,
  labels padded to align. A dim footer line: `Bars: public GitHub repos using each skill (nightly).`
- When `ctx.skillEvidence` is absent, rejects, or times out (2 s): exactly today's list output.
- Category filter and error message unchanged.
- Piped (`skills | grep python`): lines conversion renders each bar as text
  `Python      ████████░░░░  6 repos`, so grep still works.

## `who`

| | |
|---|---|
| Usage | `who` |
| Surfaces | W, C (S later) |
| Assistant | yes |

- Output (web only so far): `1 person exploring right now` / `N people exploring right now`. Once
  SSH ships: a table `Surface | Now` with `web` and `ssh` rows and a total.
- If `ctx.live` is missing or `presence()` fails: `Live count unavailable right now.` (dim), status ok.
- The count includes the caller when they are on the web (their own heartbeat).

## `guestbook`

| | |
|---|---|
| Usage | `guestbook` |
| Surfaces | W, C (S later) |
| Assistant | yes (read-only) |

- Output: heading `Guestbook`, then up to 20 entries newest first, each as
  `name · 3 days ago` (bold name, dim time) followed by the message, then a dim hint:
  web → `Sign it: sign "your message" --name "your name"`; curl → `Sign it in the web terminal: <origin>`.
- Empty: `No entries yet — be the first: sign "hello!" --name "you"`.
- Unavailable: `Guestbook unavailable right now.` status ok.
- Relative time uses a shared formatter (`just now`, `5 minutes ago`, `3 days ago`, `2 months ago`).

## `sign "<message>" --name <name>`

| | |
|---|---|
| Usage | `sign "<message>" --name <name>` |
| Args | positional `message` (required, may be quoted); flag `--name`/`-n` (string, required) |
| Surfaces | W (S later, see research R23) |
| Assistant | no |

- Runs `validateGuestbookEntry` locally. On failure: error text for the reason code, status error, no
  effect. Missing `--name`: `Please add your name: sign "…" --name "your name"`.
- On success: output `Checking you're human…` (dim) and effect `sign: { name, message }`. The web
  host loads Turnstile, verifies, posts to `/api/guestbook`, and appends the result line:
  - ok → `Thanks for signing, <name>!` followed by the new entry rendered as in `guestbook`.
  - refused → the server's `message` (see http-api.md), status error.
- The typed command stays in history, so a refused signature can be fixed with ↑ and edited.
- curl/unsupported surface: the standard "available in the web terminal" message (spec 004).

## Reason messages (shared, used by client and server)

| Code | Message |
|---|---|
| `empty` | `Name and message can't be empty.` |
| `too_long` | `Keep it short: name up to 24 characters, message up to 140.` |
| `link` | `Links aren't allowed in the guestbook.` |
| `contact` | `Please don't share emails or phone numbers here.` |
| `blocked` | `That message can't be posted. Try different words.` |
| `human_check` | `Couldn't confirm you're human. Please try again.` |
| `rate_limited` | `You've already signed today — thanks! Try again tomorrow.` |
| `daily_cap` | `The guestbook is full for today. Try again tomorrow.` |
| `unavailable` | `Guestbook unavailable right now. Your message wasn't lost — press ↑ to retry.` |

## Registry metadata

- `gui`, `who`, `guestbook`, `sign` get `man` pages and appear in `help`; `gui` appears in the menu.
- `registry-coverage.test.ts` and `read-only.test.ts` are updated: `who`/`guestbook` assistant-safe,
  `sign` not.
