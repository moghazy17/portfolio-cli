# Implementation Plan: Content Pipeline

**Branch**: `002-content-pipeline` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-content-pipeline/spec.md`

## Summary

Move all portfolio content out of `packages/shared/src/data.ts` into `/content`:
`resume.yaml` (JSON Resume plus extensions), optional `projects/<slug>/README.md`
write-ups, and `cv/latest.pdf`. A zod-validated loader feeds a **build-time generated
module**, because the command engine runs in the browser. `cvData` is then derived from it
through a pure `toCVData()`, so every command, the HTML fallback and the AI prompt stay
unchanged and are proven byte-identical by a test. `GET /api/content` publishes the same
content (ETag, CDN cached, rate-limited) for SSH and curl.

A GitHub Action watches `content/cv/incoming/`. It gates the PDF with `pdftotext`, has
the model (OpenAI `gpt-6-luna`) map the CV onto the **current** resume through transient ids, and then applies
every rule in code: keep entries missing from the CV, protect `manual` fields, never touch
slugs, links or write-ups, flag uncertain matches, unmapped sections and ungrounded text.
It writes YAML node by node for a minimal diff and opens or updates one reviewable PR
(`cv-update`) that also moves the PDF into place. On merge, Vercel redeploys and a
propagation workflow dispatches the Spec 004 inventory refresh if it exists.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), Node 20 (CI and scripts), Next.js 15 / React 18 (web)
**Primary Dependencies**: `zod` 4, `yaml` (eemeli), `ai` 6 + `@ai-sdk/openai` 3 (CV extraction and chat), `@upstash/ratelimit` (already used), `tsx` (scripts); CI: `poppler-utils`, `peter-evans/create-pull-request@v7`, `lycheeverse/lychee-action`
**Storage**: Files in git (`/content`). Redis is used only for the `/api/content` rate limit (optional).
**Testing**: Vitest (new), Playwright (new), live CV eval script over committed fixture PDFs
**Target Platform**: Vercel (web), GitHub Actions `ubuntu-latest` (automation); later Fly.io SSH (consumer of `/api/content`)
**Project Type**: TypeScript monorepo, with a web app, a shared library and CI automation
**Performance Goals**: No regression in first terminal output (content stays in the bundle, and no zod or YAML reaches the client); CV upload to PR in under 10 min (SC-004)
**Constraints**: Command output identical after migration (SC-001); the automation never merges; nothing unreviewed is served; no new paid services
**Scale/Scope**: 1 editor, ~230 lines of content, 5 roles, 5 projects, 2 certificates, 7→9 skill categories; about 1 CV run per month

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Pre-design | Post-design | How |
|---|---|---|---|---|
| I | Single source of truth | ✅ | ✅ with one recorded exception | `/content` only; `data.ts` deleted; `generated.ts` is gitignored and derived. Name, first name, headline, location and SEO copy move out of `layout.tsx`, `page.tsx`, `ascii.ts`, `prompt.ts`, the chat UI and the commands (R16). Write-ups hold no title or stack copies (R4). The ASCII banner exception is in Complexity Tracking |
| II | Render-agnostic core | ✅ | ✅ | Loader and `toCVData` live in `packages/shared`; `/api/content` serves the same normalized `Content` to SSH and curl; renderers untouched |
| III | Simplicity first | ✅ | ✅ with justification | No new services or datastores. New tooling (Vitest, Playwright, PAT, lychee) is justified in Complexity Tracking |
| IV | Honest AI | ✅ | ✅ | The CV is untrusted data; the model only fills a schema; all rules are in code; grounding check flags text not found verbatim in the CV; code writes the change log |
| V | Security | ✅ | ✅ | No secrets in the client; `/api/content` rate-limited at 60/min/IP; `CV_BOT_TOKEN` is repo-scoped with least privilege; `incoming/` is never served; no auto-merge |
| VI | Accessibility and motion | N/A | N/A | No UI or motion changes; the semantic HTML fallback keeps rendering from `cvData` |
| VII | Performance | ✅ | ✅ | The bundle carries the same data as today; zod, yaml and the loader are Node-only (`./content` subpath) |
| VIII | Testing | ✅ | ✅ | Vitest (loader, schema, formatter, legacy equivalence, merge rules), Playwright smoke, live CV eval. No SSH yet (Spec 003) |
| IX | Independent stories | ✅ | ✅ | US1 ships alone; US2 needs only US1; US3 is mostly configuration on top of US1 |
| X | Green gate | ✅ | ✅ | `ci.yml` (validate → typecheck → test → build → e2e) plus branch protection. The PAT lets CV PRs trigger CI |

No unjustified violations. **Gate: PASS.**

## Project Structure

### Documentation (this feature)

```text
specs/001-content-pipeline/
├── plan.md              # this file
├── research.md          # R1–R15 decisions
├── data-model.md        # Resume / write-up / Content / extraction / change log
├── quickstart.md        # how to verify each story
├── contracts/
│   ├── content-api.md          # GET /api/content
│   ├── cv-update-workflow.md   # workflow, script, PR body, failure codes
│   └── content-scripts.md      # npm scripts, error format, CI, link check, propagation
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
content/                                   # NEW, the single source of truth
├── resume.yaml
├── site.yaml                              # page title / description / keywords (was layout.tsx)
├── projects/                              # optional write-ups (none required at migration)
└── cv/
    ├── latest.pdf                         # arrives with the first CV PR
    └── incoming/.gitkeep

packages/shared/
├── package.json                           # + exports "./content" (Node-only); scripts generate/validate/cv:sync; deps zod, yaml
├── scripts/
│   ├── generate-content.ts                # validate → src/content/generated.ts
│   ├── validate-content.ts
│   ├── cv-sync.ts                         # CLI wrapper for src/cv-sync (used by the workflow)
│   ├── eval-cv.ts                         # live eval over fixtures
│   └── build-cv-fixtures.ts               # HTML → PDF via Playwright
├── src/
│   ├── index.ts                           # exports cvData = toCVData(content) (replaces ./data)
│   ├── data.ts                            # DELETED after migration
│   ├── content/
│   │   ├── schema.ts                      # zod: Text, Month, Resume, WriteupFrontMatter
│   │   ├── view.ts                        # toCVData(), formatMonth()  (browser-safe, pure)
│   │   ├── generated.ts                   # GENERATED, gitignored
│   │   ├── load.ts                        # Node: read files, parse YAML + front-matter, unwrap
│   │   ├── validate.ts                    # cross-file rules + file:line error formatting
│   │   └── node.ts                        # "./content" entry: re-exports load/validate/schema
│   └── cv-sync/                           # Node-only
│       ├── pdf.ts                         # pdftotext gate + text normalization
│       ├── extract.ts                     # prompt, transient ids, generateText + Output.object
│       ├── merge.ts                       # deterministic rules (R8), pure
│       ├── ground.ts                      # verbatim check
│       ├── write-yaml.ts                  # Document-API minimal-diff writer
│       └── report.ts                      # change log → PR body / step summary
└── test/
    ├── fixtures/legacy-cvdata.json        # snapshot of data.ts before deletion
    ├── fixtures/cv/*.html|*.pdf|*.extraction.json
    └── *.test.ts

apps/web/
├── package.json                           # predev/prebuild: generate + copy CV PDF; test:e2e
├── app/api/content/route.ts               # NEW, see contracts/content-api.md
├── public/cv/                             # gitignored copy target
└── e2e/smoke.spec.ts                      # NEW Playwright smoke

.github/workflows/
├── ci.yml                                 # NEW
├── cv-update.yml                          # NEW
├── content-propagate.yml                  # NEW
└── link-check.yml                         # NEW

packages/shared/vitest.config.ts          # NEW
apps/web/playwright.config.ts             # NEW (@playwright/test is a root devDependency,
                                           #      shared with scripts/build-cv-fixtures.ts)
```

**Structure Decision**: keep the existing two workspaces. Content logic goes into
`packages/shared`, split into a browser-safe part (`schema` types, `view`, `generated`) and
a Node-only `./content` subpath export plus `cv-sync/`, so the web client bundle never
pulls in `fs`, `yaml` or the AI SDK. There is no new package or app, which follows
Principle III.

## Implementation order (maps to user stories)

1. **US1a, no behavior change**: add the schema, loader, view, generator, `resume.yaml`
   (hand-migrated from `data.ts`) and the legacy fixture. Switch `index.ts` to the
   generated content and delete `data.ts`. Add CI, Vitest and the Playwright smoke.
   *Ship.*
2. **US1b**: `/api/content`, the PDF copy step and the link-check workflow. *Ship.*
3. **US2**: `cv-sync` modules with recorded-fixture tests, then the workflow, then the
   fixture PDFs and live eval, then the first real run with `Ahmed_Moghazy.pdf`. *Ship.*
4. **US3**: the propagation workflow, then end-to-end verification per quickstart. *Ship.*

## Risks

| Risk | Mitigation |
|---|---|
| Month formatting rule differs from a legacy string | The legacy-equivalence test fails loudly before `data.ts` is deleted |
| Model mis-matches the two ACT entries | `_match` "uncertain" is flagged; dates are part of the matching prompt; the eval fixture covers it; the model is configurable via `CV_SYNC_MODEL` |
| Model paraphrases instead of copying CV text | The grounding check lists every non-verbatim value under "Needs a look" |
| PAT expires and CV PRs stop being created | The workflow fails with a clear auth error; quickstart sets a 1-year expiry and a reminder |
| `generated.ts` missing in a fresh clone | Every entry point (`dev`, `build`, `typecheck`, `test`) has a `pre*` hook |

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|---|---|---|
| Build-time generated module (gitignored) | The engine runs client-side and needs content in the bundle without zod or yaml | Committing the generated file means two copies in git; runtime fetch delays the first output |
| Fine-grained PAT `CV_BOT_TOKEN` | PRs opened with `GITHUB_TOKEN` don't trigger CI, so Principle X can't gate CV PRs | A GitHub App gives the same result with more setup |
| Playwright (new dev dependency) | Required by Principle VIII for web flows; also renders the CV fixture PDFs | Word-edited fixtures aren't reproducible; there's no other way to test real pages |
| Vitest (new dev dependency) | Required by Principle VIII; the repo has no test runner | None meets the constitution |
| lychee link check | FR-005a | A custom fetch script means more code to maintain; lychee is a single action step |
| **Principle I exception**: `ASCII_BANNER` in `packages/shared/src/ascii.ts` stays hand-drawn block-letter art of the name | It is a designed visual asset, not text a CV or the owner edits. Hand-kerned glyphs look better than generated ones | Generating it at build time from `basics.name` (e.g. figlet) adds a dependency and changes the look. Revisit if the name ever changes. The no-hardcoded-content test excludes this one file explicitly |
