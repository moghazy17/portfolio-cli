# Data Model: Access Surfaces (deep links + curl)

No new persistent entities beyond one Redis counter hash. Everything else is in-memory value types.

## 1. `AddressResult` (shared, `surface/address.ts`)

The parsed meaning of a site address. The same result is used by middleware, the curl handler and the web client.

```ts
type AddressResult =
  | { kind: 'root' }                                  // "/" with no cmd
  | { kind: 'command'; line: string; form: 'path' | 'query' }
  | { kind: 'invalid'; reason: 'too-long' | 'undecodable' | 'ambiguous' | 'control-chars' }
  | { kind: 'not-command'; line: string };             // "/foo/bar" where foo is no visible command → line "foo bar"
```

Validation:
- `line` is trimmed and non-empty, at most `MAX_LINK_LENGTH = 200` characters, with no C0 control characters except tab (`\t` becomes a space).
- `form: 'path'`: the first segment is a visible command or alias (case-insensitive). The other segments are decoded with `decodeURIComponent` and each becomes one argument, quoted if it contains whitespace or tokenizer metacharacters.
- `form: 'query'`: comes from the `cmd` search parameter on `/` only.
- A path other than `/` together with `cmd` gives `invalid/ambiguous`.
- `not-command` is built from the segments exactly like the path form and is still a deep link. Browsers get the terminal, which runs `line` as typed input from a link (so it reaches "did you mean", the not-found output or the prefilled prompt), with `X-Robots-Tag: noindex`. Text clients get the shell's not-found output and 404 (or the command's output, for hidden commands such as `/sudo/hire-me`).

## 2. Canonical address (shared, `toAddress(line, names)`)

| Input line | Address |
|---|---|
| `projects` | `/projects` |
| `skills llm` | `/skills/llm` |
| `experience act` | `/experience/act` |
| `projects \| grep -i rag` | `/?cmd=projects+%7C+grep+-i+rag` |
| `sudo hire-me` (hidden) | `/?cmd=sudo+hire-me` |
| `cat "/projects/x/README.md"` | `/?cmd=…` (quotes and slashes are not path-safe) |

Invariant: `parseAddress(toAddress(line)) → { kind: 'command', line: L' }`, where `tokenize(L')` equals `tokenize(line)`. Vitest checks this round-trip for every visible command and for example pipelines.

## 3. `LinkRun` (web host state, `useTerminal`)

```ts
interface RunOptions { origin: 'typed' | 'link' }
interface Prefill { text: string; nonce: number }    // nonce re-triggers CommandLine's effect
```

Lifecycle of a deep link (runs once per page load):

```text
load ─ parseAddress ─┬─ root ─────────────► idle
                     ├─ invalid ──────────► notice entry ─► idle
                     └─ command | not-command ─► shell.run(line)
                                     ├─ result.ask ─► prefill(line), no history, no AI ─► idle
                                     └─ otherwise ──► render (welcome kept; openUrl/download
                                                      dropped with a dim note) ─► syncAddress
```

## 4. Address sync (web host)

| Event | Address bar |
|---|---|
| Command finished (typed or linked), cwd was `/` | `toAddress(line)` |
| Command finished, cwd was `/x` | `toAddress("cd /x && " + line)` |
| Any address over 200 characters | `/` |
| `clear`, `welcome` | `/` |
| `ask` result (in-place question), chat-mode message, cancelled run | unchanged |

The address is written with `history.replaceState`, using a 250 ms trailing debounce.

## 5. `TextResponse` (shared, `surface/curl.ts`)

```ts
interface TextRequest {
  address: AddressResult;
  color: boolean;                 // false when nocolor/no_color is present
  origin: string;                 // e.g. https://www.moghazy.me
  github?: (signal: AbortSignal) => Promise<GitHubStats>;
}
interface TextResponse { status: 200 | 400 | 404; body: string }   // 429 is produced by the route
```

Status mapping: `root` → 200 (guide). `command` with ok status → 200. Unknown command → 404. `invalid` → 404. Any other error status → 400.

## 6. Shell option additions (shared, `types.ts`)

```ts
interface ShellOptions { /* existing */ github?: (signal: AbortSignal) => Promise<GitHubStats> }
interface CommandContext { /* existing */ github?: (signal: AbortSignal) => Promise<GitHubStats> }
```

`chat`, `theme` and `clear` get `surfaces: ['web', 'ssh']`.

## 7. `SurfaceStats` (Redis)

| Key | Type | TTL | Fields |
|---|---|---|---|
| `surface:stats:<YYYY-MM-DD>` (UTC) | hash | 90 days, set only when `hincrby` returns 1 (first write of the day) | `curl_requests`, `curl_rate_limited`, `deep_links` |
| `gh:stats:v1` | string (JSON `GitHubStats`) | 10 min | — |
| `rl:curl:*` | owned by `@upstash/ratelimit` | limiter-managed | — |

Writes go through the shared `recordSurfaceEvent(client, kind, now)` (`packages/shared/src/surface/stats.ts`), which only ever touches the three fields above, using 1 command per event plus 1 per day for the TTL. Records never contain addresses, paths, commands or user agents (FR-028). The `/api/chat-stats` response gains `surfaces.daily[]` with these three counters per day.
