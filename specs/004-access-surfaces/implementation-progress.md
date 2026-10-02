# Implementation progress: Spec 004 (deep links + curl)

- **Implementer**: Codex CLI 0.159.0, `gpt-5.6-terra`, high effort (the owner's choice).
- **Orchestrator**: Claude Code. It reviews each run, re-runs the gates, marks tasks in `tasks.md` and commits.
- **Parallelism**: the foundation runs first on `004-access-surfaces`. Then US1 and US2 run at the same time in separate worktrees (`004-us1`, `004-us2`) and are merged back.

| # | Scope | Status | Commit |
|---|---|---|---|
| 1 | Foundation: T001–T003, T005, T006 | ✅ reviewed + 1 orchestrator fix, committed | 6ba79f1 |
| 2a | US1: T004, T007–T012 (worktree `004-us1`) | ✅ reviewed + 1 test fix, merged | 10cf708, merge 03d9dd4 |
| 2b | US2: T013–T020 (worktree `004-us2`) | ✅ reviewed, merged; guide fix after live check | 22ba467, merge a69c340, da98a61 |
| 3 | Merge both lanes, full gates, Polish T021–T023 | ✅ middleware conflict resolved by hand; docs by the orchestrator | (this commit) |
| — | T024 Vercel apex domain + production checks | ✅ done; bare `?nocolor` fixed in the follow-up PR | — |

## Review notes

### Run 1 (Codex `gpt-5.6-terra`, high): foundation
- **Codex delivered** the address module (`parseAddress`, `toAddress`, `isTextClient`, `wantsColor`, `routableCommandNames`), the shared usage counters with an injected client, the web binding, and the browser half of the middleware (command, non-command and invalid paths rewrite to `/`; `noindex` on non-command and invalid non-root paths; prefetches pass through).
- **Orchestrator fix**: path segments containing a backslash weren't quoted, so the tokenizer would read the backslash as an escape. Added the quote case and a regression test that checks spaces, pipes, quotes and backslashes each stay one argument.
- **Gates (re-run by the orchestrator)**: typecheck; 53 files / 412 tests; `build:web` (middleware 46.9 kB).


### Run 2a (Codex, US1 deep links, worktree `004-us1`)
- **Codex delivered** the link run on mount, the effect guard (no `openUrl`/`download`, with a note), question prefill, address sync with a 250 ms `replaceState` debounce and a `cd <cwd> &&` prefix, deep-link counting for real page loads, `surfaces` in `/api/chat-stats`, and 11 Playwright tests.
- **Review**: typed behaviour is unchanged. The `Terminal.tsx` change (no prompt line for entries without a prompt) only affects the new invalid-link notice.
- **Orchestrator fix**: the back-button test passed even with `pushState`. It now asserts `history.length` doesn't grow across two commands.
- **Gates (orchestrator)**: 412 tests; build; Playwright 46/46.

### Run 2b (Codex, US2 curl, worktree `004-us2`)
- **Codex delivered** `runTextRequest`/`curlIndex`/`rateLimitedResponse`, the engine changes (`surfaces` on chat/theme/clear, the new surface and not-found messages, an injected `github` provider), the cached GitHub fetch, `/api/term`, the middleware text branch, 9 Vitest tests, a curl Playwright test, and `E2E_PORT` in the Playwright config.
- **Codex note**: the route falls back to the request's own path when `__path` is missing. It's harmless either way, because the route resolves the same address whichever URL it sees.
- **Gates (orchestrator)**: 421 tests; build; Playwright 36/36 on port 3200.

### Merge and live check
- The only conflict was in `middleware.ts` imports, resolved by hand. Merged gates: typecheck; 54 files / 421 tests; build (middleware 60.7 kB); Playwright 47/47.
- **Live check against `next start`**: statuses were 200 for commands, 404 for unknown input and questions, 400 for `theme`; browsers got HTML, and `/whatever` got `noindex`. **Found a bug**: the guide's `curl "…/?cmd=projects | grep -i rag"` printed nothing, because curl 8.17 rejects URLs with spaces. The guide now uses `curl -G … --data-urlencode "cmd=…"` and a `portfolio()` shell function. Both were verified by running them exactly as printed, and a test now rejects any quoted guide URL that contains a space.

### Review round (Codex `gpt-6-astra`, high, read-only) and fixes
- **Deep review**: not ready (address round-trips broken by URL rules, curl status mapping, a malformed-link repair in the route, analytics blocking responses, prefill reuse, unquoted `$`/backtick, weak tests). **Security review**: safe with fixes (C1 terminal-control injection into curl output; unbounded authenticated GitHub refreshes). The core guard held: links never open, download or ask the AI. The orchestrator reproduced every main finding before fixing.
- **Fixes, in parallel worktrees**: Codex `gpt-6-sol` (high) took the engine and security fixes, and Codex `gpt-5.6-terra` (high) took the route, host and tests. Both were reviewed. **Orchestrator fix**: the new GitHub cache let one disconnecting curl client cancel the shared refresh and trigger the 60 s cooldown for everyone. The refresh now depends only on its own timeout, with a regression test.
- **Decision recorded**: a bare `clear`/`welcome` writes `/`, but a reset followed by output (`clear && projects`) keeps the command line, so the link reproduces the screen.
- **Gates (orchestrator, merged branch)**: typecheck; 55 files / 429 tests; build; Playwright 49/49. Live re-check against `next start`: every reproduction now behaves as the contract says.

### Production checks after merge (PR #13, `c24e5b8`)
- **curl**: correct statuses: 200 `/`, `/projects`, `/skills/llm`, `/github`; 404 `/nonsense`, questions, `pwd && nonsense`, the `%FF` link and the C1 escape link; 400 `/theme` and `/projects/no-such-project`. The guide's `-G --data-urlencode` example works as printed. `/api/content` still returns JSON.
- **Browser**: HTML on `/`, `/projects` and `/whatever`; `noindex` only on the non-command path; `X-Frame-Options: DENY` everywhere. `www` and `http://` both 308 to `https://moghazy.me`.
- **CDN**: never mixed curl and browser responses, in either request order and on the cached `/` (`X-Vercel-Cache: HIT` for the browser while curl still got text).
- **Usage report**: `surfaces.daily` live (75 curl requests, 0 rate-limited, 32 deep links on the first day).
- **Found in production**: Vercel drops a bare `?nocolor` before it reaches the route (`?nocolor=1` works). Fixed in a follow-up: the middleware normalises the flag, and the guide and docs show `nocolor=1`.

## Needs your eyes

- `sudo <anything>` and `rm …` now report an error status, like a real shell, so `&&` chains stop after them and curl returns 400. Nothing changes visually on the web.
- The GitHub cache is per server instance (in memory) plus Redis. Under a cold start on several instances, each instance can make one refresh.

- **T024**: the apex domain change is done (verified: `https://moghazy.me` returns 200, `www` 308-redirects to it). Plain `http://` is always upgraded by Vercel, so the README now shows `curl https://moghazy.me/...`. The quickstart production checks run once this branch is deployed.
- `curlIndex()` falls back to `https://moghazy.me` when no origin is passed. The route always passes the request origin, so this only affects direct callers. `content/site.yaml` has no canonical URL to use instead.
- The `deep_links` counter can be inflated by clients that fake browser headers, at 1 Redis command per request. This was accepted in the plan.

## End of run

- [x] Full gates on the merged branch: typecheck, Vitest, `build:web`, Playwright
- [ ] Push `004-access-surfaces` and open the PR (surfaces: web, curl)
- [ ] T024: Vercel dashboard, apex serves directly; then the quickstart production checks
