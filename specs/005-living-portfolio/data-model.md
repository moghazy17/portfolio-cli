# Data Model: Living Portfolio

**Feature**: 005-living-portfolio | **Date**: 2026-10-02

Portfolio content itself is unchanged (still `/content`, generated into `packages/shared`). This
feature adds browser-side preferences, two Redis structures, a few type extensions, and new counters.

## 1. Browser-side preferences (visitor's device only)

| Name | Storage | Values | Written when | Read when |
|---|---|---|---|---|
| `view` | Cookie, 1 year, `SameSite=Lax`, `Path=/` | `gui` \| `terminal` | Visitor reaches `/gui` (any way) → `gui`; uses "back to terminal" or loads `/` → `terminal` | Middleware on a plain `/` request (no query, not a deep link) |
| `boot:v1` | `localStorage` | `"1"` | The boot sequence starts | Terminal mount on plain `/` |
| `presence:sid` | `sessionStorage` | UUID v4 | First heartbeat in the tab | Every heartbeat |
| `gui:seen` | `localStorage` | `"1"` | The visitor first uses a view switch (button, `gui`/`startx`, or "Terminal") | Terminal mount, to style the GUI button (accent until set, outline after) |

Rules:
- A deep link (spec 004) never reads `view` and never plays the boot; it does not set `boot:v1`.
- If storage throws, `boot:v1` falls back to an in-memory flag for the page's lifetime; presence falls
  back to an in-memory id.

**View state transitions**

```text
(no cookie) --plain "/"--> terminal
terminal --gui/startx/button/open "/gui"--> gui        [cookie := gui]
gui --"back to terminal"--> terminal                    [cookie := terminal]
gui-cookie --plain "/"--> 307 → /gui
gui-cookie --deep link "/projects" or "/?cmd=…"--> terminal (cookie unchanged)
```

## 2. Presence (Redis)

**Key**: `presence:web` (later `presence:ssh`) — sorted set.

| Field | Type | Rule |
|---|---|---|
| member | string | UUID v4 session id; anything else is rejected with 400 |
| score | number | Last heartbeat, epoch ms (server clock) |

- Window: a member counts while `score > now − 60 000`.
- Every write and read trims members older than the window.
- Key expiry: `EXPIRE presence:web 120` on each write, so the key disappears when nobody is online.

**PresenceCount** (returned to clients):

```ts
interface PresenceCount {
  total: number;
  bySurface: { web: number; ssh?: number }; // ssh appears only once SSH ships
  at: string; // ISO time of the count
}
```

## 3. Guestbook entry (Redis)

**Key**: `guestbook:v1` — list, newest first, at most 200 items (`LTRIM 0 199` after every push).

```ts
interface GuestbookEntry {
  id: string;       // 12-char base62 random, unique within the list
  name: string;     // 1–24 code points after normalisation
  message: string;  // 1–140 code points after normalisation
  at: string;       // ISO time signed (server clock)
}
```

Validation (`validateGuestbookEntry`, shared, runs on client and server; server is authoritative):

| Step | Rule | Reason code |
|---|---|---|
| Normalise | NFKC, trim, control chars and bidi overrides removed, whitespace runs → one space | — |
| Empty | name or message empty after normalising | `empty` |
| Length | name > 24 or message > 140 code points | `too_long` (message names the limit) |
| Links | URL, `www.`, or bare domain with a common TLD | `link` |
| Contact | email address, or ≥ 7 digits in a phone-like run | `contact` |
| Blocklist | skeleton (lowercase, no diacritics, leetspeak mapped, repeats collapsed) contains a blocked word at a word boundary | `blocked` |

No IP, user agent or session id is stored with an entry. Deleted entries are removed from the list
(no tombstone).

**SignResult** (returned to clients):

```ts
type SignResult =
  | { ok: true; entry: GuestbookEntry }
  | { ok: false; reason: 'empty' | 'too_long' | 'link' | 'contact' | 'blocked'
      | 'human_check' | 'rate_limited' | 'daily_cap' | 'unavailable'; message: string };
```

## 4. Rate-limit keys (Upstash Ratelimit)

| Prefix | Identifier | Window | On limiter error |
|---|---|---|---|
| `rl:guestbook` | SHA-256(`GUESTBOOK_SALT` + visitor IP) | 1 per 1 day (fixed) | Refuse (fail closed) |
| `rl:guestbook-all` | `all` | 200 per 1 day (fixed) | Refuse (fail closed) |
| `rl:guestbook-read` | visitor IP | 60 per 1 min | Allow (fail open) |
| `rl:presence` | visitor IP | 60 per 1 min (room for many visitors behind one network) | Allow (fail open) |
| `rl:guestbook-admin` | visitor IP | 10 per 1 min | Allow, token still required |
| `rl:skills` | visitor IP | 30 per 1 min | Allow (fail open) |

## 5. Usage counters (existing daily hash `surface:stats:<YYYY-MM-DD>`, 90-day TTL)

| Field | Kind | Incremented when |
|---|---|---|
| `gui_visits` | counter | Document or client navigation to `/gui` (prefetches excluded) |
| `guestbook_signed` | counter | An entry is stored |
| `guestbook_rejected` | counter | A signature is refused for any reason except `unavailable` |
| `presence_peak` | max | A heartbeat's count exceeds the stored value |

Existing fields (`curl_requests`, `curl_rate_limited`, `deep_links`) are unchanged.

## 6. Type extensions in `packages/shared`

```ts
// types.ts
interface ProgressOutput {
  type: 'progress';
  label: string;
  value: number;      // 0..1
  note?: string;      // NEW: shown instead of the percentage, e.g. "4 repos"
  reveal?: boolean;   // NEW: renderer may animate the fill once on mount
}

interface Theme {
  // existing colour fields…
  effects?: { crt?: boolean }; // NEW: host-applied visual effects
}

interface CommandResult {
  // existing effects…
  view?: 'gui';                                  // NEW: switch the host to the regular page
  sign?: { name: string; message: string };      // NEW: host runs human check + submits
}

interface CommandContext {
  // existing fields…
  live?: LiveServices;                           // NEW
  skillEvidence?: (signal: AbortSignal) => Promise<SkillEvidence>; // NEW
}

interface LiveServices {
  presence(signal: AbortSignal): Promise<PresenceCount>;
  guestbook(signal: AbortSignal): Promise<GuestbookEntry[]>;
}

type SkillEvidence = Record<string /* skill label as in content */, number /* repo count */>;
```

## 7. Skill evidence

- Computed by `skillEvidence(snapshot, cvData.skills)` from the inventory snapshot (`inventory:v1`).
- For each skill label: candidates = label without parenthetical, plus the parenthetical when it is an
  acronym (2–6 capitals); count = max over candidates of distinct repos returned by `lookupTech`.
- Bar value = count / max(count over all skills); `0` shows an empty bar with note `no public repos`.
- Inventory missing or older than its stale limit: `skillEvidence` is not offered and `skills` shows
  the plain list.
