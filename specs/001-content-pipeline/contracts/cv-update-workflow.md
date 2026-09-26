# Contract: CV update workflow (`.github/workflows/cv-update.yml`)

Implements US2: FR-008 to FR-017.

## Triggers

| Trigger | Condition |
|---|---|
| `push` | branch `main`, paths `content/cv/incoming/**.pdf` |
| `workflow_dispatch` | manual; no inputs |

`concurrency: { group: cv-update, cancel-in-progress: false }`, so runs queue and never
overlap.

## Inputs

- The newest committed PDF in `content/cv/incoming/`, found through `git log`. If there is
  none:
  - on `push` (typically the merge of a CV PR, which deletes the incoming PDFs), the run
    **succeeds** with outcome `nothing` and the summary "Nothing to process", and sends
    no email;
  - on `workflow_dispatch`, the run fails with `NO_INPUT`.
- `content/resume.yaml` and `content/cv/latest.pdf` (may be missing on the first run).
- Secrets: `OPENAI_API_KEY` (extraction), `CV_BOT_TOKEN` (a fine-grained PAT
  for this repo with Contents RW and Pull requests RW, used only to open or update the PR).
- Variable (optional): `CV_SYNC_MODEL`, default `gpt-6-luna` (an empty value also falls back to the default).

Permissions: `contents: read`. The PR is written using `CV_BOT_TOKEN`, not `GITHUB_TOKEN`.

## Script contract (`npm run cv:sync -- --pdf <path>`)

Exit code `0` means `changes`, `pdf-only`, `no-changes` or `nothing`. Exit code `1` means
failure. The script receives the trigger via `--event push|workflow_dispatch` (from
`${{ github.event_name }}`), which decides between `nothing` and `NO_INPUT`.
It writes:

| Output | Where |
|---|---|
| `outcome=changes\|pdf-only\|no-changes\|nothing` | `$GITHUB_OUTPUT` |
| Human-readable report (always, including on failure) | `$GITHUB_STEP_SUMMARY` |
| PR body markdown | `.cv-sync/pr-body.md` |
| Modified working tree | `content/resume.yaml` (if changes); `content/cv/latest.pdf` replaced by the incoming file; all `content/cv/incoming/*.pdf` deleted |

The script never runs `git commit`, `git push` or any GitHub API call. The PR step does
that. This keeps the script testable locally (`--dry-run` prints the report and leaves the
tree untouched).

### Failure reasons (exactly one, first line of the summary)

| Code | Message (example) |
|---|---|
| `NO_INPUT` | No PDF in content/cv/incoming/. (manual runs only) |
| `UNREADABLE` | The CV could not be read (corrupt, password-protected, image-only — 0 characters of text found — or too large: over 10 MB / 10 pages). |
| `EXTRACTION_FAILED` | The AI extraction failed after 2 attempts: `<provider error>`. |
| `INVALID_RESULT` | The updated resume failed validation: followed by one `path  message` line per issue. |

## Pull request (only for `changes` / `pdf-only`; skipped for `no-changes` / `nothing`)

`peter-evans/create-pull-request@v7` with `token: CV_BOT_TOKEN`, `branch: cv-update`,
`delete-branch: true`, `add-paths: content/resume.yaml, content/cv/**`, labels
`cv-update`, `automated`. If a PR for `cv-update` is already open, it is **updated**, never
duplicated (FR-016). The workflow never merges or approves (FR-013).

Title: `CV update: <N> changes from <file name>` or `CV update: PDF only (<file name>)`.

Body (sections are omitted when empty, and appear in this order):

```markdown
**Source:** `content/cv/incoming/Ahmed_Moghazy.pdf` → `content/cv/latest.pdf`
**Summary:** 3 added · 12 updated · 2 removed · 1 needs a look

### Added
- `skills[7]` Core Computer Science: Data Structures & Algorithms, …
### Updated
- `work[0].highlights[1]`
  - from: Engineered a Hierarchical RAG Pipeline in PGVector, reducing hallucinations by 30% …
  - to:   Engineered a Hierarchical RAG Pipeline in PGVector to navigate high-density …
### Removed (no longer in the CV)
### ⚠ Needs a look
#### Possible rename / duplicate
#### Not found verbatim in CV — please check
#### Protected, not matched in CV
#### New project — set `graduation` if needed
### Not in CV, kept
### In CV, not mapped
---
Protected fields are never changed. To protect a field, write it as `{ value: "…", manual: true }`.
```

## Guarantees (tested)

1. Slugs, write-ups (`content/projects/**`), profile and project links and `manual` values
   are byte-identical before and after (SC-005).
2. No entry (work, project, certificate, skill category, education) disappears (FR-010a).
3. On failure no PR is created or updated, and the live CV is unchanged (FR-014, FR-008a).
4. CV text can't change these rules. The model output only fills the extraction schema;
   every rule above is enforced in code (FR-017).
