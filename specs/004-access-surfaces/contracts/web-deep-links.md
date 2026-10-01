# Contract: Web deep links (host behaviour)

## Middleware (browsers)

| `parseAddress` result | Action | Counted as a deep link |
|---|---|---|
| `root` (no `cmd`) | pass through | no |
| `root` with valid `cmd` → `command/query` | pass through | yes |
| `command/path` | `rewrite('/')`, URL kept | yes |
| `invalid` | `rewrite('/')` (with `X-Robots-Tag: noindex` unless the path is `/`), so the client shows the notice | no |
| `not-command` | `rewrite('/')`, URL kept, response header `X-Robots-Tag: noindex`; the client runs `line` as a link | yes |

Requests with `next-router-prefetch: 1` or `purpose: prefetch` are passed through and not counted.

A request is counted only when it is a real top-level page load: `Sec-Fetch-Dest: document` and `Sec-Fetch-Mode: navigate`. That leaves out link-preview bots and plain scripts that don't send those headers. Counting calls `event.waitUntil(recordSurfaceEvent(redis, 'deep_links'))`. That is one `hincrby` per counted request, plus one `expire` the first time each day, and it never delays the response. Without Redis, nothing is counted.

Accepted residual risk: a client faking browser headers can still inflate the counter. Each fake request costs exactly one Redis command, the same order of cost as the rate-limit check that `/api/content` already performs per request, and no request can cause more than that.

## `useTerminal`

```ts
handleCommand(input: string, opts?: { origin?: 'typed' | 'link' }): Promise<void>
prefill: Prefill | null        // passed to <CommandLine prefill={…} />
```

On mount (once, with a Strict-Mode-safe ref), the hook reads `window.location`:

- `command` or `not-command` → `handleCommand(line, { origin: 'link' })`
- `invalid` → push a notice entry: `This link couldn't be used (<reason>). Type "help" to explore.` (dim, with no prompt line)

When `origin === 'link'`:

| Result field | Behaviour |
|---|---|
| `ask` | No history entry and no `runAssistant`. Set `prefill` to the original input. `CommandLine` puts it in the input and focuses it. Enter sends it through the typed path. |
| `openUrl`, `download` | Not performed. Append a dim text line: `Opened from a link, so nothing was opened or downloaded. Use the link above.` |
| `welcome` (screen stays) | `setShowWelcome(false)` is not called before the run. The output appears below the welcome. |
| `theme`, `mode`, `sequence`, `clear`, `welcome` | Applied as for typed input. The theme is not persisted. |

## Address sync

This applies to typed and linked runs. See data-model §4. It uses `history.replaceState` only (never `pushState`), with a 250 ms trailing debounce and `try/catch`. The address is never written for `ask` results, chat mode or cancelled runs.

## Test hooks (Playwright)

- `page.on('popup')` and `page.on('download')` must not fire for `/?cmd=open%20github` and `/resume`.
- `page.route('**/api/chat', …)` must record 0 requests after loading `/?cmd=what%20RAG%20work%20has%20he%20done%3F`, and exactly 1 after pressing Enter.
