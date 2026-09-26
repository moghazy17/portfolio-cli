# Contract: content scripts and CI checks

## npm scripts

| Command (repo root) | Does | Exit |
|---|---|---|
| `npm run content:validate` | Loads and validates `/content`, printing every error and warning | 1 on any error |
| `npm run content:generate` | Validate, then write `packages/shared/src/content/generated.ts` | 1 on any error |
| `npm run cv:sync -- --pdf <file> [--dry-run]` | CV → resume merge (see `cv-update-workflow.md`) | 1 on failure |
| `npm test` | Vitest (unit, recorded-fixture merge tests) | |
| `npm run test:e2e` | Playwright smoke against `next build && next start` | |
| `npm run eval:cv` | Live CV eval over the fixture PDFs (needs `OPENAI_API_KEY`) | 1 if any expectation fails |
| `npm run typecheck` | All workspaces (generation runs first via `pretypecheck`) | |

`apps/web` hooks: `predev` and `prebuild` run `content:generate` and copy
`content/cv/latest.pdf` to `apps/web/public/cv/latest.pdf` if it exists.

## Validation error format (FR-005, SC-003)

One line per problem, all problems at once, errors before warnings:

```text
✖ content/resume.yaml:58:15  work[1].position  expected a non-empty string, received undefined
✖ content/resume.yaml:112:3  projects[2].slug  duplicate slug "rag-chatbot" (also projects[0].slug)
✖ content/projects/rag-bot/README.md  folder "rag-bot" does not match any projects[].slug (known: news-aggregator, automl, rag-chatbot, expensum, star-schema)
✖ content/resume.yaml:23:13  work[0].startDate  expected YYYY-MM (e.g. 2025-10), received "Oct 2025"
⚠ content/resume.yaml:30:3  education  2 entries; commands currently show only the first
2 errors, 1 warning
```

## CI (`.github/workflows/ci.yml`)

On `pull_request` and on `push` to `main`, in this order: `npm ci` → `content:validate` →
`typecheck` → `npm test` → `build:web` (a separate step, so a build failure is reported
on its own) → `test:e2e`, where Playwright reuses the built app through `next start`. A failure blocks the merge
(Principle X). This needs branch protection on `main` requiring the `ci` check, which is a
manual repo setting and is listed in quickstart.

## Link check (`.github/workflows/link-check.yml`) (FR-005a)

On PRs touching `content/**` and on a weekly cron. It runs lychee over `content/**`,
accepts `200..=299` and `999`, excludes `mailto:` and `tel:`, uses `fail: false`, and
writes the results to the job summary. It **never blocks**.

## Propagation (`.github/workflows/content-propagate.yml`) (FR-020)

On `push` to `main` with paths `content/**`, with `permissions: actions: write`. If
`.github/workflows/inventory.yml` exists it runs `gh workflow run inventory.yml`;
otherwise it logs "inventory workflow not present (Spec 004) — skipped".
