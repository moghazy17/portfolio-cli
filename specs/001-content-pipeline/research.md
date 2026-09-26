# Research: Content Pipeline (Spec 001)

**Date**: 2026-09-26 · **Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Each entry: **Decision**, **Rationale**, **Alternatives considered**. Items marked
*(deviates from plan.md prompt)* change something in the original `plan.md` prompt and say why.

---

## R1. How content reaches the browser

The command engine runs **client-side** (`useTerminal.ts` and `Terminal.tsx` are
`'use client'` and import `executeCommand` from `@ahmed-moghazy/shared`). Content therefore
has to be in the client bundle, just as `data.ts` is today. Reading YAML with `fs` at
runtime is impossible in the browser.

- **Decision**: a build-time generator (`packages/shared/scripts/generate-content.ts`)
  loads and validates `/content`, then writes `packages/shared/src/content/generated.ts`,
  which exports `content` (normalized, plain strings) and `contentVersion` (sha256). The
  file is **gitignored** and produced by `pre*` hooks (`predev`, `prebuild`,
  `pretypecheck`, `pretest`). `cvData` is derived from `content` by a pure function
  (`toCVData`), so the existing `CVData` shape and every command stay unchanged.
- **Rationale**: this is the smallest change (commands keep importing `cvData`). There is
  no zod or YAML parser in the client bundle (Principle VII), there is still exactly one
  source of truth (Principle I), and a validation failure fails the build (FR-005).
- **Alternatives**: commit the generated file with a CI freshness check (two copies in git,
  risk of staleness); fetch `/api/content` in the browser (an extra round trip before the
  first output, which hurts the 1.5 s budget); parse YAML in the client (adds about 30 kB).

## R2. Resume file format *(JSON Resume, with extensions)*

- **Decision**: `content/resume.yaml` follows the **JSON Resume** v1 field names (`basics`,
  `work`, `education`, `projects`, `certificates`, `skills`). It adds a few extension keys
  the site needs: `slug` on work and projects, `stack` and `graduation` on projects,
  `faculty` and `location` on education, and `startDate`, `endDate` and `highlights` on
  certificates. Dates are **`YYYY-MM`** strings. An open end date (`endDate` omitted) means
  "Present".
- **Rationale**: LLMs know JSON Resume well, which helps extraction accuracy. JSON Resume
  explicitly allows extra properties. ISO months sort correctly and let the timeline stop
  parsing strings.
- **Display dates must stay byte-identical** (SC-001). Every date in today's data follows
  one rule: *a month name of 4 letters or fewer is written in full (May, June, July); any
  other month uses its 3-letter abbreviation (Jan, Apr, Aug, Sep, Oct…)*. `formatMonth()`
  implements that rule, and the legacy-equivalence test (R10) proves it against all 25
  dates currently in `data.ts` (Jan, Apr, May, June, July, Aug, Sep, Oct, Nov, Dec all occur).
- **Alternatives**: keep human-readable date strings in YAML (the LLM would output
  inconsistent formats, and sorting would need `parseTimelineDate` forever); a custom
  schema (loses the LLM familiarity and future `resume-cli` theme export for free).

## R3. Manual-override marker (field-level, FR-010c)

- **Decision**: any CV-derived string in `resume.yaml` may be written either as a plain
  string or as `{ value: "...", manual: true }`. This includes a single bullet, a single
  skill name, a summary, a role or a date. The loader unwraps it to a plain string, so
  renderers never see the marker.
  ```yaml
  highlights:
    - Architected a Multi-Agent Concierge System …          # follows the CV
    - value: Engineered a Hierarchical RAG Pipeline …        # protected
      manual: true
  ```
- **Rationale**: a single explicit mechanism that works at every level, including list
  items (a plain string can't carry a flag), and is visible to the schema, so a typo like
  `manul: true` fails validation.
- **Alternatives**: `# manual` YAML comments (invisible to the schema, so typos are
  silently ignored); an `x-manual: [paths]` list keyed by index (breaks as soon as bullets
  shift); marking whole entries only (rejected in clarification Q3).
- *(deviates from plan.md prompt: `x-manual` → `{ value, manual: true }`)*

## R4. Project write-ups: front-matter fields *(deviates from plan.md prompt)*

- **Decision**: `content/projects/<slug>/README.md` front-matter holds only `featured`
  (boolean, default `false`) and `links` (a list of `{ label, url }`). **Title and stack
  are not in front-matter**; they come from the matching `resume.yaml` project. The folder
  name is the project slug. A write-up is optional (clarification Q2 of the /clarify
  session).
- **Rationale**: if front-matter repeated the title and stack, any CV update renaming a
  project would contradict a write-up the automation isn't allowed to touch (FR-010). That
  PR would either fail validation or leave the two copies inconsistent, breaking
  Principle I. Keeping project links in write-ups also protects them by construction,
  since the automation never edits `content/projects/**`.
- **Alternatives**: title and stack in both places with an equality check (blocks CV PRs);
  links in `resume.yaml` (then the automation needs a code rule to protect them, a second
  mechanism).
- Spec FR-003 was amended accordingly.

## R5. YAML and front-matter parsing

- **Decision**: the `yaml` package (eemeli) for both `resume.yaml` and front-matter. The
  front-matter is split off with a single regex (`^---\n…\n---\n`) and there is no
  `gray-matter`. `LineCounter` maps zod issue paths to `file:line:col`.
- **Rationale**: one YAML library. It supports the **Document API**, which the CV writer
  needs to edit specific nodes while keeping the owner's comments, ordering and formatting
  (R8), and it reports source positions for clear errors (FR-005).
- **Alternatives**: `js-yaml` + `gray-matter` (two dependencies, no comment-preserving
  round trip).

## R6. Validation and error format

- **Decision**: zod 4 schemas in `packages/shared/src/content/schema.ts`, plus cross-file
  checks in `validate.ts` (unique slugs, each write-up folder matches a project slug,
  exactly one LinkedIn and one GitHub profile, at least one education entry). Errors are
  printed as
  `content/resume.yaml:57:9  work[1].position  Required: expected a non-empty string`.
  All errors are reported at once, not just the first. `npm run content:validate` runs
  standalone; the generator runs the same validation, so `next build` fails too.
- **Rationale**: FR-005 and SC-003 (file, field and expectation for 100% of broken files).
  zod 4 is already in `node_modules` (4.3.6, via `ai`), and the AI SDK accepts zod 4
  schemas.
- More than one `education` entry: allowed by the schema, but the current commands render
  only the first. The validator prints a **warning** (not an error) so a CV PR is never
  blocked. Rendering all entries belongs to Spec 002.

## R7. CV → structured data extraction

- **Decision**:
  1. **Gate (deterministic)**: a file over 10 MB, or over 10 pages (counted from the form-feed page breaks in `pdftotext` output), fails as
     "unreadable: too large". `pdftotext -layout` then fails the run as "unreadable" on a
     non-zero exit (corrupt or password-protected file) or on fewer than 200 non-whitespace
     characters (image-only). All of this happens **before any LLM call**. This implements the spec rule
     that scanned CVs are reported as unreadable.
  2. **Extraction**: AI SDK 6 `generateText` with `output: Output.object({ schema })`.
     (`generateObject` is marked `@deprecated` in the installed `ai@6.0.116`.) The model
     receives **the PDF itself as a file part** (layout-aware, which handles two-column
     CVs) plus the `pdftotext` text, plus the current resume with **transient ids**
     (`w0`, `w0.h2`, `p3`, `s1.k4`…).
  3. The model returns **only what is in the CV**, mapped to those ids: an item that
     corresponds to an existing one carries its `_id`, a new item has none, and each entry
     carries `_match: "certain" | "uncertain"`. Sections with no home go in `unmapped[]`.
     It never outputs slugs, links, `basics.profiles`, write-ups, `graduation` or manual
     flags; those are not in its schema. (`basics.profiles` is excluded because CVs print
     URLs without a scheme, which would fail validation on every run.)
- **Model**: env `CV_SYNC_MODEL`, default **`gemini-2.5-flash`**. The live eval (T048, 2026-09-26)
  decided this:
  - **`gemini-3.5-flash-lite`** (the chat model): `real-cv` failed with "response did not match
    schema" in 3 out of 3 runs, and `new-layout` duplicated entries.
  - **`gemini-3.5-flash`**: every run failed with "high demand" or quota errors on this API key.
  - **`gemini-2.5-flash`**: 7/7 fixtures passed. In a second run, the only failures were quota
    errors, never logic errors.

  Other settings: `temperature: 0`. The prompt states the matching rules explicitly: an
  abbreviation or acronym plus overlapping dates means the same entry, while different dates at
  the same organisation mean different entries.

  **Caveat**: this key is on a small free-tier quota. The weekly `cv-eval` workflow uses about
  6 calls, and a CV update uses 1–2.
- **Rationale**: the model does the part only a model can do (reading a CV and deciding
  "this bullet is the same fact as w0.h2"), and everything with a rule (R8) is code.
  Principle IV and FR-017: the CV is data, so even a prompt-injected CV can at most propose
  text changes, which the PR shows for review.
- **Alternatives**: the LLM returns the full new YAML (it could drop, reorder or alter
  protected fields, and nothing would enforce the rules); an op-list patch format (harder
  for the model than "fill this schema"); `pdftotext` text only (two-column layouts
  interleave, which puts SC-008 at risk).
- *(deviates from plan.md prompt: native PDF input in addition to pdftotext;
  `generateText`+`Output.object` instead of the deprecated `generateObject`)*

## R8. Deterministic merge (`cv-merge.ts`, a pure function)

Input: current resume (with manual markers) plus the extraction. Output: new resume and a
change log. Rules, each mapping to a spec requirement:

| Rule | Spec |
|---|---|
| Entry with a known `_id` → update its fields with the CV values | FR-009, FR-010b |
| Entry without `_id` → append a new entry; code generates a unique `slug` from the name | FR-003, FR-010 |
| Existing entry not referenced by any `_id` → **kept unchanged**; logged "Not in CV, kept" | FR-010a |
| `_match: "uncertain"` → change applied, logged "Possible rename / duplicate" | FR-010d |
| **Code cross-check**: a matched entry whose name **and** dates both change → logged "Possible rename / duplicate" even if the model said "certain" | FR-010d |
| `basics.profiles` → copied from the current resume unchanged | FR-010 |
| New project → `graduation: false`, and listed under "Needs a look" so the owner can set the flag | usability |
| Item (bullet, keyword, course) inside a matched entry that is not referenced → removed, unless protected | FR-010a |
| Protected field or item → original value kept whatever the CV says; a CV item that references it is **not** added as a duplicate | FR-010b/c |
| Protected item not referenced by the CV → kept, logged "Protected, not matched in CV" | edge case |
| `slug`, write-ups and `links` → never read from the extraction (not in its schema) | FR-010 |
| `unmapped[]` → logged "In CV, not mapped"; nothing dropped | FR-010e |
| Unknown `_id` from the model → ignored, logged as a warning | robustness |

**Grounding check (Principle IV)**: every *new or changed* text value must appear in the
`pdftotext` output after normalization (collapse whitespace, rejoin hyphenated line breaks,
fold quotes and dashes). Since clarification Q2 says new wording *is* CV wording, a value
that isn't found points to a model paraphrase or hallucination. Such values are listed in
the PR as **"Not found verbatim in CV — please check"**. This is a warning, not a failure,
because PDF text extraction is imperfect.

**Writing**: changes are applied to the parsed YAML **Document** node by node (`setIn`,
`addIn`), so untouched lines, comments and key order are preserved and the PR diff shows
only real changes (FR-012).

**Change log** is generated **by code** from the applied operations, not written by the
LLM, so the summary can't misdescribe the diff.

## R9. The CV-update workflow

- **Trigger**: `push` to `main` with `paths: content/cv/incoming/**.pdf`, plus
  `workflow_dispatch`. `concurrency: cv-update` (queued, not cancelled).
  *(deviates from plan.md prompt: `content/cv/*.pdf` → `incoming/`, per /clarify Q1)*
- **Which file**: the most recently committed PDF in `incoming/`, determined from git log.
  The PR **moves** it to `content/cv/latest.pdf` and deletes every PDF in `incoming/`, so
  a lingering file from a closed PR is cleaned up next time.
- **Nothing to process**: merging a CV PR deletes the incoming PDFs, and a `paths` filter
  matches deletions too, so that merge starts the workflow again. On a `push`, an empty
  `incoming/` is therefore a **successful no-op** ("nothing to process"). `NO_INPUT` is a
  failure only for a manual `workflow_dispatch` run.
- **Outcomes**: `changes` → PR with resume and PDF; `pdf-only` → PR with PDF only;
  `no-changes` (byte-identical PDF and no resume diff) → no PR, success; failure → exit 1,
  with the reason written to `$GITHUB_STEP_SUMMARY` (FR-014, FR-015).
- **PR**: `peter-evans/create-pull-request@v7`, fixed branch `cv-update`. Reusing the
  branch makes a second upload **update** the open PR (FR-016). The body comes from R8's
  change log. There is no auto-merge.
- **Token** *(deviates from plan.md prompt)*: a **fine-grained PAT `CV_BOT_TOKEN`** scoped
  to this repo only, with *Contents: RW, Pull requests: RW*. PRs created with the default
  `GITHUB_TOKEN` **do not trigger `pull_request` workflows**, so CI (typecheck, tests,
  content validation) would never run on CV PRs, and Principle X could not be enforced.
  With a PAT, the "Allow GitHub Actions to create and approve pull requests" setting is not
  needed.
- **Alternatives**: a GitHub App (the same result with more setup); `GITHUB_TOKEN` plus
  close/reopen tricks (fragile).

## R10. Proving "no loss" (SC-001)

- **Decision**: before `data.ts` is deleted, its `cvData` is serialized once to
  `packages/shared/test/fixtures/legacy-cvdata.json`. A Vitest test asserts
  `toCVData(loadContent()) deep-equals legacy-cvdata.json`. A second test runs every
  content command (`about`, `education`, `experience`, `experience act`, `projects`,
  `skills`, `certifications`, `contact`, `timeline`, `whoami`, `neofetch`) before and
  after and compares the `CommandOutput[]` snapshots.
- **Rationale**: an exact, cheap, deterministic check. The HTML fallback in `page.tsx` and
  the AI prompt both read `cvData`, so they're covered by the same equality.
- This test stays green until the first CV PR is merged, which changes content on purpose.
  From then on the legacy fixture is retired and the test becomes "resume.yaml round-trips
  through the loader".

## R11. Tests and CV fixtures (Principle VIII)

- **Vitest** (new; `packages/shared/vitest.config.ts`) covers schema errors, the
  date formatter, the loader, write-up linking, legacy equivalence, `cv-merge` rules (with
  **recorded extraction JSON** as input, so no network is needed), grounding
  normalization, the YAML minimal-diff writer and the change log.
- **CV fixtures**: small HTML sources in `packages/shared/test/fixtures/cv/*.html` are
  rendered to PDF with Playwright's `page.pdf()` by `packages/shared/scripts/build-cv-fixtures.ts` (`@playwright/test` is a root devDependency). Both
  the HTML and the PDFs are committed, so the fixtures can be rebuilt and nobody hand-edits
  Word files. The set: `same-as-current`, `new-role`, `new-layout` (two columns, "ACT"
  renamed, an extra "Languages" section), `dropped-project`, `image-only` (a screenshot
  embedded as an image) and `corrupt`. The real `Ahmed_Moghazy.pdf` is also a fixture.
- **Live CV eval** (`npm run eval:cv`) runs the whole pipeline on each fixture against
  Gemini and asserts the outcome (SC-004/005/006/008). It runs in CI weekly and on PRs
  touching `packages/shared/src/cv-sync/**`, and is skipped when the secret is absent
  (fork PRs).
- **Playwright** (new): smoke tests that the home page loads and `about` shows the name and
  summary from content, `/api/content` returns 200 with an `ETag` and a conditional
  request returns 304, and `/cv/latest.pdf` returns 200 when present. This sets up the
  harness Specs 002 and 003 will extend.

## R12. Content API for SSH and curl (FR-007, FR-019)

- **Decision**: `GET /api/content` (Next route handler) returns
  `{ version, generatedAt, content }` from the generated module. It sends
  `ETag: "<contentVersion>"` and `Cache-Control: public, max-age=60, s-maxage=300,
  stale-while-revalidate=600`, returns 304 on a matching `If-None-Match`, and is
  **rate-limited** at 60 requests/minute/IP with `@upstash/ratelimit`. Without Redis the
  rate limit is disabled, as with chat (Principle V).
- **Rationale**: the SSH server (Spec 003) polls this with a ≤5-minute cache and falls back
  to a baked-in snapshot. Most traffic is served from the CDN cache and never reaches the
  function.

## R13. Downloadable CV serving

- **Decision**: web `prebuild`/`predev` copies `content/cv/latest.pdf` to
  `apps/web/public/cv/latest.pdf` (gitignored) when it exists; if it doesn't exist yet,
  that's not an error. `incoming/` is never copied, so an unreviewed PDF is never served
  (FR-008a).
- **Alternatives**: a route handler streaming from `/content` at runtime (needs Next file
  tracing configuration, which is more moving parts).

## R14. Propagation (US3)

- **Web, HTML fallback, AI and PDF**: all rebuilt by Vercel's normal deploy on merge
  (FR-018).
- **SSH and curl**: `/api/content` cache headers (R12) plus Spec 003's 5-minute client cache
  give at most about 10 minutes (FR-019, SC-007).
- **AI GitHub knowledge**: `.github/workflows/content-propagate.yml` runs on `push` to
  `main` affecting `content/**` and runs `gh workflow run inventory.yml` **only if that
  workflow file exists**; otherwise it logs a no-op (FR-020). The default `GITHUB_TOKEN`
  can dispatch workflows (`actions: write`).

## R16. Identity strings and site copy outside `data.ts` (Principle I, /analyze C1)

The analysis found facts hardcoded outside `data.ts`:

- **Headline** "Data Science & ML Engineer": `layout.tsx`, `page.tsx`, `ascii.ts`, `neofetch`.
- **Location** "Cairo, EG": `ascii.ts`.
- **Full name**: SEO metadata in `layout.tsx`.
- **First name** "Ahmed": `prompt.ts`, `ChatRenderer.tsx`, the `chat` command and its registry description, the `hello`, `sudo` and `whoami` texts.

- **Decision**: add `basics.label` (a standard JSON Resume field) and a pure
  `toProfile(content)` that returns `{ name, firstName, label, location }`. SEO copy goes to a
  new small `content/site.yaml` (title, ogTitle, description, keywords, copied verbatim
  from `layout.tsx`). Every string listed above is templated from `profile`/`site`, so
  output stays byte-identical, which the legacy command-output test proves.
- **Exception**: the block-letter `ASCII_BANNER` stays hand-drawn. It is recorded in plan
  Complexity Tracking and explicitly excluded by the no-hardcoded-content test.
- **Alternatives**: putting SEO copy inside `resume.yaml` under `x-site` (mixes CV data
  with page copy, and CV automation would have to know to skip it); generating the banner
  with figlet (a new dependency, and it changes the look).

## R15. Link check (FR-005a)

- **Decision**: `lycheeverse/lychee-action` over `content/**` on PRs touching `content/**`
  and on a weekly schedule, with `fail: false` and the results written to the job summary.
  Status `999` (LinkedIn's anti-bot response) is accepted, and `mailto:`/`tel:` are
  excluded.
- **Rationale**: no service and no code to maintain. A warning only, per the clarification.
