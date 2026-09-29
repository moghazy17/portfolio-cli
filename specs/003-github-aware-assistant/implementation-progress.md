# Implementation Progress: Spec 003

- **Implementer**: Codex CLI 0.159.0 at medium effort (the owner's choice).
  - Run 1: `gpt-6-astra`. It was already running when the owner restricted models.
  - Runs 2+: `gpt-6-sol`. The owner allows only sol or terra; sol is the stronger of the
    two.
- **Reviewer**: Claude. For each run: review the diff, re-run the gates, then commit.
- **Baseline** (`5b21fa7`): typecheck green, 32 test files and 218 tests passing.

## Status

| Run | Tasks | Status | Commit |
|---|---|---|---|
| 0 | T001 deps (`octokit`, `smol-toml`, `@ai-sdk/google@^3`, `@ai-sdk/provider`) | done by orchestrator | (with run 1) |
| 1 | T002–T015 Setup + Foundational | ✅ reviewed and committed. astra stopped by the owner; sol hit the Codex usage limit; the orchestrator finished the audit | (this commit) |
| 2 | T016–T036 US1 inventory | queued | — |
| — | T037 US1 manual verification | orchestrator (needs network + token) | — |
| 2b | US2 client slice: T038, T040, T042, T045–T048, T053–T055 (T039/T044 minus the `github` exclusion part) | ✅ Sonnet agent (isolated worktree), reviewed and merged | 7243fac, 8a6a121 |
| 3 | US2 server slice: T041, T043, T049–T052, T056 | queued (after run 2) | — |
| 4a | US3 independent slice: T059–T061, T067–T070, T072, T073, T062 (golden.yaml only) | ✅ Sonnet agent (isolated worktree), reviewed and merged | c83c0b0, 3671dc5, 9ddae40 (+ barrel commit) |
| 4b | US3 rest: T057, T058, T062 runner, T063–T066, T071 | queued (after runs 2–3) | — |
| — | T074 run golden evals | orchestrator (needs API key) | — |
| 5 | T075–T078 Polish | queued | — |
| — | T079 quickstart + dispatch the inventory workflow | orchestrator / owner | — |

## Review notes

### Run 1 (T001–T015)
- **Implementers**: astra (stopped by the owner at a checkpoint), then sol (stopped by the Codex usage limit at 02:1x, which resets at 3:01 AM). The orchestrator finished the audit.
- **Orchestrator fixes on top of the implementer draft**:
  - `fallback.ts`: the "first chunk" check now skips the `stream-start` and `response-metadata` parts, which arrive with the headers before any output. It holds them and replays them. Before this, a provider error right after `stream-start` never triggered the fallback.
  - `fallback.ts`: the losing branch of the first-chunk race is now caught. A timed-out primary request that settled later used to surface as an unhandled promise rejection.
  - `sanitize.ts`: token prefixes (`ghp_`, `github_pat_`, `sk-`) need at least 20 characters. `__` is no longer stripped, since it mangled `__init__.py`.
  - `@ai-sdk/provider` is declared as a direct dependency (`fallback.ts` imports its types).
  - Added 3 tests: an error after metadata only switches to the fallback; held metadata parts are replayed; no unhandled rejection.
- **Gates**: typecheck clean; 36 test files and 280 tests pass (baseline 32 / 218).

### Run 2b (Sonnet agent, US2 client slice)
- **Reviewed**: the handler routing (a quote-aware pipe scan; `what's a|b` counts as piped), the allowlist (rejects hidden commands, resolves aliases, one pipeline of at most 4 stages), the client (checks the shape of every data part; transport and HTTP errors become one fixed error notice, and server text is never shown), and the web hook (drops events after a cancel; memory keeps only finished answers, last 5 exchanges). There's also a dim `^C` on cancelled answers, and Ctrl+L aborts the answer in flight. Neither was asked for, but I kept both as sensible.
- **Gates** after the fast-forward merge: typecheck clean; 40 test files and 301 tests.
- **Known limit**: `DefaultChatTransport` throws away the HTTP status, so a 403 and a 500 show the same generic error notice. That's acceptable: limits come back as 200 notice streams by design.

### Run 4a (Sonnet agent, US3 independent slice)
- **Reviewed**:
  - Relay identity: the relay header is honored only with a valid bearer (SHA-256 then `timingSafeEqual`) and a valid IP.
  - Limits: 15/h per visitor, then the daily cap. They fail **closed** when Redis errors and are off when Redis is unset.
  - Question log: `EXPIREAT` at day start + 30 days, and entries carry no identifying fields.
  - Stats endpoint: a 10/min per-IP limit is checked before the token.
  - Eval fixtures: 6 neutral repos, and `golden.yaml` has 18 cases.
- **Orchestrator follow-up**: exported `resolveVisitorIp`, `classifyOutcome` and `buildLogEntry` from the server barrel, and replaced `question-log.ts`'s duplicate type with the shared one.
- **Gates**: 42 test files and 322 tests; typecheck clean.
- **Decided for you**: the daily-cap wording is "The assistant has reached its daily question limit — try again tomorrow. Commands like `projects` still work."
- **For the eval runner (run 4b)**: the fixture dates sit around 2026-09-28, so the runner must freeze "now" near that date.

## Needs your eyes

- ~~Snapshot line-ending churn on Windows~~: fixed by adding `*.snap text eol=lf` to `.gitattributes`, at the owner's request.

## End-of-run checklist

- [ ] Full gate on the final tree: `content:validate`, `typecheck`, `test`, `build:web`, `test:e2e`
- [ ] Push the branch and open a PR with the surfaces statement
- [ ] Make `assistant-eval` a required check in branch protection
- [ ] Redeploy on Vercel, which picks up `GH_INVENTORY_TOKEN` and `ASSISTANT_FALLBACK_MODEL`
