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
| 3 | T038–T056 US2 in-shell assistant | queued | — |
| 4 | T057–T073 US3 guardrails + evals | queued | — |
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

## Needs your eyes

- `legacy-output.test.ts.snap` keeps coming back with only line-ending changes after test runs on Windows. Each commit restores it. Consider adding `*.snap text eol=lf` to `.gitattributes`.

## End-of-run checklist

- [ ] Full gate on the final tree: `content:validate`, `typecheck`, `test`, `build:web`, `test:e2e`
- [ ] Push the branch and open a PR with the surfaces statement
- [ ] Make `assistant-eval` a required check in branch protection
- [ ] Redeploy on Vercel, which picks up `GH_INVENTORY_TOKEN` and `ASSISTANT_FALLBACK_MODEL`
