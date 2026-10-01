# Implementation progress: Spec 004 (deep links + curl)

- **Implementer**: Codex CLI 0.159.0, `gpt-5.6-terra`, high effort (the owner's choice).
- **Orchestrator**: Claude Code. It reviews each run, re-runs the gates, marks tasks in `tasks.md` and commits.
- **Parallelism**: the foundation runs first on `004-access-surfaces`. Then US1 and US2 run at the same time in separate worktrees (`004-us1`, `004-us2`) and are merged back.

| # | Scope | Status | Commit |
|---|---|---|---|
| 1 | Foundation: T001–T003, T005, T006 | ✅ reviewed + 1 orchestrator fix, committed | (this commit) |
| 2a | US1: T004, T007–T012 (worktree `004-us1`) | queued | — |
| 2b | US2: T013–T020 (worktree `004-us2`) | queued | — |
| 3 | Merge both lanes, full gates, Polish T021–T023 | queued | — |
| — | T024 Vercel apex domain | owner, after deploy | — |

## Review notes

### Run 1 (Codex `gpt-5.6-terra`, high): foundation
- **Codex delivered** the address module (`parseAddress`, `toAddress`, `isTextClient`, `wantsColor`, `routableCommandNames`), the shared usage counters with an injected client, the web binding, and the browser half of the middleware (command, non-command and invalid paths rewrite to `/`; `noindex` on non-command and invalid non-root paths; prefetches pass through).
- **Orchestrator fix**: path segments containing a backslash weren't quoted, so the tokenizer would read the backslash as an escape. Added the quote case and a regression test that checks spaces, pipes, quotes and backslashes each stay one argument.
- **Gates (re-run by the orchestrator)**: typecheck; 53 files / 412 tests; `build:web` (middleware 46.9 kB).

## Needs your eyes

## End of run

- [ ] Full gates on the merged branch: typecheck, Vitest, `build:web`, Playwright
- [ ] Push `004-access-surfaces` and open the PR (surfaces: web, curl)
- [ ] T024: Vercel dashboard, apex serves directly; then the quickstart production checks
