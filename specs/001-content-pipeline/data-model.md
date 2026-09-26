# Data Model: Content Pipeline (Spec 001)

**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

The owner edits three kinds of files. Everything else is derived from them.

```text
content/
├── resume.yaml                     # Resume (JSON Resume + extensions)
├── site.yaml                       # Site copy: SEO title/description/keywords (never touched by CV automation)
├── projects/<slug>/README.md       # Project write-up (optional, one per project at most)
└── cv/
    ├── latest.pdf                  # CV document (live, served at /cv/latest.pdf)
    └── incoming/                   # Incoming CV (never served; triggers CV automation)
        └── .gitkeep
```

## Shared value types

| Type | Rule |
|---|---|
| `Text` | A non-empty string **or** `{ value: <non-empty string>, manual: true }`. The loader unwraps it to a string. `manual` must be literally `true`; any other key fails validation. |
| `Month` | `Text` whose value matches `^\d{4}-(0[1-9]\|1[0-2])$` (e.g. `2025-10`). |
| `Slug` | `^[a-z0-9]+(-[a-z0-9]+)*$`, unique within its section. **Never changed by automation.** |
| `Url` | An absolute `https://` URL (`mailto:` only for email). |

`Text` applies to every field that a CV can change. Fields the CV can't change (slugs,
flags, links) are plain values.

## Resume (`content/resume.yaml`)

```yaml
basics:
  name: Text                         # "Ahmed Moghazy"
  label: Text                        # headline, "Data Science & ML Engineer" (page title, welcome subtitle, neofetch Role)
  summary: Text                      # professionalSummary
  email: Text                        # email address
  phone: Text
  location: { city: Text, countryCode: Text }     # rendered "Cairo, EG"
  profiles:                          # exactly one LinkedIn and one GitHub (validated)
    - { network: LinkedIn, url: Url }
    - { network: GitHub,   url: Url, username: Text }

education:                           # ≥1; commands render [0] (warning if >1)
  - institution: Text                # "Cairo University"
    area: Text                       # "Computer Science"
    studyType: Text                  # "Bachelor of Science"   → degree "Computer Science — Bachelor of Science"
    faculty: Text                    # ext
    location: Text                   # ext, "Giza, Egypt"
    score: Text                      # GPA "3.33"
    startDate: Month
    endDate: Month?                  # omitted = Present
    courses: [Text]

work:
  - slug: Slug                       # ext; was shortName ("act", "act-intern")
    name: Text                       # company
    position: Text                   # role
    startDate: Month?                # DEPI-style entries may lack dates
    endDate: Month?                  # omitted = Present (only if startDate set)
    highlights: [Text]

projects:
  - slug: Slug                       # was shortName; links to content/projects/<slug>/
    name: Text
    stack: Text                      # ext; was techStack, e.g. "LangChain + FAISS + Ollama"
    graduation: boolean              # ext; was isGraduation (default false)
    startDate: Month
    endDate: Month?
    highlights: [Text]

certificates:
  - name: Text                       # was title
    issuer: Text
    startDate: Month                 # ext
    endDate: Month?                  # ext
    highlights: [Text]               # ext (may be empty)

skills:
  - name: Text                       # category, e.g. "LLMs & Generative AI"
    keywords: [Text]
```

### Validation rules (FR-005)

1. Schema shape, as above. Unknown top-level keys are an error, which catches typos.
   Unknown keys inside entries are an error except under a key named `x-*` (a reserved
   escape hatch).
2. `work[].slug` and `projects[].slug` are each unique; the error names both duplicates.
3. `endDate`, if present, is ≥ `startDate`.
4. `basics.profiles` has exactly one `LinkedIn` and one `GitHub` entry.
5. Warning (non-fatal): more than one `education` entry.
6. Every error is reported as `file:line:col  path  message`, and all errors at once.

### Mapping to the legacy `CVData` view (`toCVData`, pure)

| CVData | From |
|---|---|
| `name`, `professionalSummary` | `basics.name`, `basics.summary` |
| `contact.email/phone` | `basics.email/phone` |
| `contact.linkedin/github` | `basics.profiles[network].url` |
| `contact.location` | `` `${city}, ${countryCode}` `` |
| `education.degree` | `` `${area} — ${studyType}` `` |
| `education.{institution,faculty,location,gpa,coursework}` | `institution, faculty, location, score, courses` |
| `experience[].{company,shortName,role,bullets}` | `work[].{name,slug,position,highlights}` |
| `projects[].{name,shortName,techStack,isGraduation,bullets}` | `projects[].{name,slug,stack,graduation,highlights}` |
| `certifications[].{title,issuer,bullets}` | `certificates[].{name,issuer,highlights}` |
| `skills[].{name,skills}` | `skills[].{name,keywords}` |
| every `startDate`/`endDate` | `formatMonth(Month)`; missing `endDate` → `"Present"` |

`formatMonth("2025-06") === "June 2025"`. A month name of ≤4 letters is written in full
(May, June, July); all others use a 3-letter abbreviation. SC-001 requires
`toCVData(content)` to deep-equal the pre-migration `cvData` exactly.

### Profile helper (`toProfile`, pure)

Used for the short identity strings that were hardcoded in UI code (C1):

| Field | From | Current value / used in |
|---|---|---|
| `name` | `basics.name` | "Ahmed Moghazy": layout metadata, `page.tsx` h1, prompt |
| `firstName` | first word of `basics.name` | "Ahmed": chat labels, chat placeholder, `hello`/`sudo`/`whoami` texts, `chat` command description, prompt |
| `label` | `basics.label` | "Data Science & ML Engineer": page title, h1, `WELCOME_SUBTITLE`, `neofetch` Role |
| `location` | `` `${city}, ${countryCode}` `` | "Cairo, EG": `WELCOME_SUBTITLE` |

`WELCOME_SUBTITLE` becomes `` `${label}  ·  ${location}` ``, which is byte-identical to today's value.

**Documented exception**: `ASCII_BANNER` in `ascii.ts` is block-letter art of the name.
It stays hand-drawn (see plan Complexity Tracking). The no-hardcoded-content test excludes it explicitly by file.

## Site copy (`content/site.yaml`)

```yaml
title: Text            # "Ahmed Moghazy | Data Science & ML Engineer"   (<title>)
ogTitle: Text          # "Ahmed Moghazy | Terminal Portfolio"            (OpenGraph + Twitter)
description: Text      # current layout.tsx meta description, verbatim
keywords: [Text]       # current layout.tsx keywords, verbatim, same order
```

This is strict and validated like the resume. It belongs to the owner: CV automation never
reads or writes it. It is exposed as `content.site`.

## Project write-up (`content/projects/<slug>/README.md`)

```markdown
---
featured: true                 # boolean, default false
links:                         # optional list
  - { label: GitHub, url: https://github.com/moghazy17/… }
  - { label: Demo,   url: https://… }
---
Markdown body (free text, may be empty).
```

Rules: the folder name must equal an existing `projects[].slug`, otherwise the error names
the folder and the unknown slug. Title and stack are **not** allowed in front-matter; they
come from the resume (R4). The body is stored raw (rendering is Spec 002). A project with
no folder is valid and shows its `highlights`.

## Normalized content (generated; what every surface consumes)

```ts
interface Content {
  schemaVersion: 1;                   // bumped on breaking shape changes (see contracts/content-api.md)
  resume: Resume;                     // all Text unwrapped to string
  site: Site;                         // content/site.yaml
  writeups: Record<Slug, { featured: boolean; links: {label: string; url: string}[]; body: string }>;
  cv: { available: boolean; path: '/cv/latest.pdf' };
}
// generated.ts exports:  content: Content;  contentVersion: string  // sha256 of canonical JSON
// index.ts exports:      cvData = toCVData(content)   (unchanged public name)
//                        profile = toProfile(content) ({ name, firstName, label, location })
//                        site = content.site
```

## CV automation entities (transient, never stored in `/content`)

### Incoming CV — lifecycle

```text
dropped in content/cv/incoming/  ──push──▶  processing
push with incoming/ empty (e.g. the merge commit of a CV PR) ──▶ NOTHING (run green, no email)
processing ──unreadable / too large / invalid──▶ FAILED (run red, reason in summary, file stays)
processing ──no resume diff & PDF byte-identical──▶ NO-CHANGES (run green, no PR)
processing ──no resume diff & PDF differs──▶ PR (pdf-only)
processing ──resume diff──▶ PR (changes)
PR ──merge──▶ incoming/ emptied, latest.pdf replaced, resume.yaml updated  ──▶ LIVE
PR ──new upload before merge──▶ same PR branch rewritten (FR-016)
PR ──closed unmerged──▶ file stays in incoming/; next run picks the newest
```

### Extraction (LLM output schema)

The Resume shape **without** `slug`, `links`, `manual`, `graduation`, **`basics.profiles`**,
or write-ups (and never `site.yaml`), plus the fields below. Profile URLs are excluded
because CVs often print them without a scheme (`linkedin.com/in/…`), which would either
fail the `Url` rule and break every run, or rewrite protected links (FR-010). The merge
copies `basics.profiles` over unchanged.

- `_id?: string` on every entry and every list item: a reference to a transient id in the
  current resume (e.g. `w0`, `w0.h2`, `s3.k1`); absent means new.
- `_match: "certain" | "uncertain"` on every entry that has an `_id`.
- `unmapped: { heading: string; text: string }[]`.

### Change log (produced by code)

```ts
type Change =
  | { kind: 'added';     path: string; value: string }
  | { kind: 'updated';   path: string; from: string; to: string }
  | { kind: 'removed';   path: string; value: string }        // unprotected item not in CV
  | { kind: 'kept-not-in-cv';       path: string; label: string }
  | { kind: 'possible-rename';      path: string; cvLabel: string; resumeLabel: string }
  | { kind: 'protected-unmatched';  path: string; value: string }
  | { kind: 'not-mapped';           heading: string; text: string }
  | { kind: 'not-grounded';         path: string; value: string }   // not found verbatim in CV text
```

`outcome = 'changes' | 'pdf-only' | 'no-changes' | 'nothing' | 'failed'`, derived from the
change log and a byte comparison with `latest.pdf`. `nothing` means a `push` run found
`incoming/` empty, e.g. right after a CV PR was merged. It is a success and sends no email.
