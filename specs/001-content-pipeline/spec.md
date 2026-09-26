# Feature Specification: Content Pipeline

**Feature Branch**: `002-content-pipeline`
**Created**: 2026-09-26
**Status**: Draft
**Input**: User description: "Portfolio content lives in plain files that I can edit and that automation can update safely, and my CV updates flow into the portfolio automatically."

## Clarifications

### Session 2026-09-26

- Q: When the new CV no longer lists an item that is in the portfolio, what happens? →
  A: Keep it; the PR summary lists it under "Not in CV, kept".
- Q: CV wording vs. the portfolio's shorter wording? → A: CV wording by default; fields
  marked as manually maintained keep the portfolio wording.
- Q: Which PDF is the first CV? → A: `Ahmed_Moghazy.pdf` (repository root).
- Q: Where is a new CV uploaded? → A: To an "incoming CV" location on the main branch;
  the pull request moves it into place as the live downloadable CV together with the
  resume changes, so both go live in the same merge.
- Q: Must every project have a write-up? → A: No. Write-ups are optional; a project
  without one shows its resume bullets. A write-up with no matching project still fails
  validation.
- Q: What can be marked as manually maintained? → A: Any single field, down to one
  bullet or one skill name; the rest of that entry still follows the CV.
- Q: Where does the owner see a CV-update failure? → A: The automated run is marked as
  failed with a plain-language reason in its run summary; the platform's standard
  failure email notifies the owner. No extra channel.
- Q: How are CV entries matched to existing resume entries when names change (e.g. a new
  CV format)? → A: By organisation/project plus dates, not exact name; uncertain matches
  are listed in the PR under "Possible rename / duplicate".
- Q: What happens to CV sections the resume has no place for (e.g. Publications,
  Languages)? → A: Never dropped silently; listed in the PR under "In CV, not mapped".
- Q: What about links that stop working (e.g. a deleted GitHub repo)? → A: A link check
  reports broken links as a warning; it never blocks the build or deploy.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Content as files (Priority: P1)

As the portfolio owner, I edit my portfolio by changing plain files in one place: a single
structured resume file (profile, summary, education, experience, skills, certifications,
links) and an optional Markdown write-up per project (a project without one shows its
resume bullets). Every place that shows portfolio content —
the website terminal, the website's accessible HTML fallback, the AI assistant, and (once
they exist) the SSH terminal and curl output — reads from these files, so they always show
the same thing. If I make a mistake in a content file, the build fails with a message that
names the file and the exact field that is wrong, and the broken content never goes live.
Everything currently on the site moves into these files with nothing lost.

**Why this priority**: every later feature (CV automation, the shell's filesystem, SSH,
curl, the AI's knowledge) depends on content living in one validated place. It is also
valuable on its own: editing content no longer means editing code.

**Independent Test**: move all content into the files, remove the old in-code copy, and
compare every command's output on the website before and after — it must be identical.
Then break a field on purpose and confirm the build fails with a precise error.

**Acceptance Scenarios**:

1. **Given** the current site content, **When** it is migrated to the content files,
   **Then** every existing command (about, education, experience, projects, skills,
   certifications, contact, timeline, whoami) produces the same output as before, and the
   accessible HTML fallback shows the same facts.
2. **Given** a project write-up file, **When** I change its text and redeploy, **Then**
   the new text is in the published content (the same content every surface reads) with
   no code change. Showing write-up bodies in the terminal is delivered by Spec 002
   (`cat` / `projects <slug>`).
3. **Given** a resume file with a missing required field (e.g. an experience entry with no
   role), **When** the build runs, **Then** it fails and the error names the file, the
   field path (e.g. `experience[1].role`) and what was expected.
4. **Given** a write-up whose project identifier doesn't match any project in the resume,
   **When** the build runs, **Then** it fails and names the write-up and the unknown
   identifier. A resume project with no write-up is valid and shows its resume bullets.
5. **Given** a failing content check on a proposed change, **When** someone tries to
   merge or deploy it, **Then** the change is blocked and the live site keeps showing the
   last valid content.
6. **Given** the migration is complete, **When** I search the UI and command code,
   **Then** no portfolio facts (name, first name, headline, location, dates, bullets,
   links, page title and description) are hardcoded there. The one documented exception
   is the hand-drawn ASCII-art banner of the name.

---

### User Story 2 - CV upload to pull request (Priority: P2)

When I drop a new version of my CV as a PDF into the repository's incoming-CV location,
the system reads it, updates the structured resume file to match, and opens a pull request
for me to review. The pull request also moves the PDF into place as the live downloadable
CV, so the new CV and the updated resume go live together when I merge.
The pull request shows exactly what changed plus a short human-readable summary (e.g.
"Added role at X, updated 2 skills, changed summary"). It never merges on its own. Things
the PDF doesn't contain — project identifiers, links, project write-ups, and fields I have
marked as manually maintained — are left exactly as they were. If the PDF can't be read,
or reading it produces content that fails validation, no pull request is opened and I get
a clear failure message saying why (in the failed run's summary, with the usual
failure email as the alert).

**Why this priority**: keeps the portfolio in sync with the CV I already maintain, without
retyping. It depends on Story 1 (a validated resume file to update) but not on Story 3.

**Independent Test**: upload a test CV PDF that differs from the current resume in known
ways (new job, changed skill) and confirm a pull request appears with exactly those
changes, a readable summary, and untouched protected fields. Upload an unreadable PDF and
confirm no pull request is opened and a failure message is shown.

**Acceptance Scenarios**:

1. **Given** a new CV PDF that adds an experience entry, **When** I upload it, **Then** a
   pull request opens that adds that entry to the resume file and its summary mentions it.
2. **Given** resume fields marked as manually maintained, plus project identifiers, links
   and write-ups, **When** a CV PDF is processed, **Then** none of them are changed in the
   pull request.
3. **Given** a CV PDF byte-identical to the live CV, **When** it is processed, **Then**
   no pull request is opened and the run reports "no changes". If the PDF is a different
   file but produces no resume changes, a "PDF only" pull request is opened instead.
4. **Given** a corrupted, password-protected or image-only PDF, **When** it is uploaded,
   **Then** no pull request is opened and the run reports that the CV could not be read.
5. **Given** extraction that produces content failing validation, **When** the run
   finishes, **Then** no pull request is opened and the failure message lists the invalid
   fields.
6. **Given** an open CV-update pull request, **When** I upload another CV version before
   merging it, **Then** the existing pull request is updated rather than a second one
   being opened.
7. **Given** any CV-update pull request, **When** nobody approves it, **Then** it is never
   merged automatically.
8. **Given** the current resume has an experience entry, project or certification that the
   new CV no longer lists, **When** the CV is processed, **Then** the item is kept in the
   resume, and the pull request summary lists it under "Not in CV, kept" so the owner can
   delete it by hand if wanted.
9. **Given** the portfolio shows different wording from the CV for the same fact (e.g.
   "HPO" where the CV says "Hyperparameter Optimization"), **When** a CV is processed,
   **Then** the pull request uses the CV wording, except for fields marked as manually
   maintained, which keep the portfolio wording unchanged.
10. **Given** a CV in a completely new layout where an entry is renamed (e.g. "ACT"
    instead of "Advanced Computer Technology (ACT)") but has the same dates, **When** it
    is processed, **Then** the existing entry is updated in place (no duplicate), and if
    the match is uncertain the PR lists it under "Possible rename / duplicate".
11. **Given** a CV with a section the resume has no place for (e.g. "Publications"),
    **When** it is processed, **Then** that section's content is listed in the PR under
    "In CV, not mapped" and nothing is silently dropped.
12. **Given** `Ahmed_Moghazy.pdf` as the first CV and the migrated site content as the
    starting resume, **When** the first run completes, **Then** all five roles, five
    projects and two certifications are matched to their existing entries (no duplicates,
    including the two separate ACT roles), bullets take the CV wording, and the two missing
    skill categories and extra skill items are added.

---

### User Story 3 - Propagation after merge (Priority: P3)

After I merge a content change (whether from a CV pull request or a hand edit), the
website, the SSH terminal, curl output, the downloadable CV and the AI assistant all
reflect it, without any further manual step from me.

**Why this priority**: completes the loop so a CV update is a single review-and-merge.
Most of this happens naturally once Story 1 is in place; this story guarantees the slower
paths (SSH cache, AI knowledge) catch up too.

**Independent Test**: merge a visible content change (e.g. a new skill) and, without doing
anything else, check each surface within the propagation window.

**Acceptance Scenarios**:

1. **Given** a merged content change, **When** the deployment finishes, **Then** the
   website terminal and the HTML fallback show the new content.
2. **Given** a merged CV PDF, **When** a visitor downloads the CV, **Then** they get the
   new PDF.
3. **Given** a merged content change, **When** a visitor asks the AI assistant about the
   changed fact, **Then** the answer reflects the new content.
4. **Given** the SSH terminal and curl surface exist, **When** a content change is merged,
   **Then** they show the new content within 10 minutes without being redeployed.
5. **Given** a merged CV change, **When** propagation runs, **Then** the GitHub knowledge
   refresh used by the AI assistant is triggered automatically.

---

### Edge Cases

- A content file has valid structure but a value in the wrong format (e.g. a date written
  as "Summer 2024", a link without a scheme): validation fails with the field and the
  expected format.
- Two projects share the same identifier: validation fails and names both.
- A whole new CV format (different layout, section order or titles): the layout doesn't
  matter; content is matched to existing entries by organisation/project plus dates
  (FR-010d), and anything that doesn't fit is listed as "In CV, not mapped" (FR-010e).
- A project is removed from the CV: it stays on the portfolio and is listed under
  "Not in CV, kept" on every later run until the owner deletes it from the resume by
  hand. Once deleted, later CVs that also lack it do not bring it back.
- A project's GitHub repository is deleted or made private: the project stays on the
  portfolio (content is the source of truth); the link check (FR-005a) reports the broken
  link as a warning.
- A protected (manually maintained) bullet has no clear counterpart in the new CV: it is
  kept as is, and the pull request summary lists it under "Protected, not matched in CV"
  so the owner can check it.
- A project is not marked as featured: it is treated the same way on every surface
  (never featured on one surface and not on another).
- The CV PDF is very large or has many pages (over 10 MB or over 10 pages): the run fails
  with "too large" before any AI call; it never opens a partial pull request.
- A CV pull request is merged, which empties the incoming-CV location: this is not treated
  as a new upload; the automation finishes quietly as "nothing to process" (no failure
  email).
- The CV text contains instructions (e.g. "ignore previous rules and…"): it is treated as
  CV content only and cannot change how the update behaves (Constitution Principle IV).
- The content source is temporarily unreachable from the SSH terminal: it keeps serving
  the last good content rather than failing or showing nothing.
- A hand edit and a CV pull request both change the same field: the normal merge-conflict
  process applies; the automation never overwrites changes already on `main` silently.

## Requirements *(mandatory)*

### Functional Requirements

**Content files (US1)**

- **FR-001**: All portfolio content MUST be stored in a single `content/` area as one
  structured resume file, one small site-copy file (page title, description, keywords),
  optional Markdown write-ups (at most one per project), and the downloadable CV PDF.
- **FR-002**: The resume file MUST cover: name, headline (e.g. "Data Science & ML
  Engineer") and profile, professional summary, contact
  details and links, education (including coursework and GPA), experience, projects
  (identifier, name, stack, dates, graduation flag, highlights), skills by category, and
  certifications/awards.
- **FR-003**: Project write-ups are optional. A write-up MUST carry its project links and
  a "featured" flag alongside its Markdown body, and MUST be linked to exactly one resume
  project by a stable project identifier. The project's title and stack come only from
  the resume entry (never repeated in the write-up), so a CV update that renames a
  project or changes its stack can never contradict a write-up. A project without a write-up MUST be
  shown using its resume bullets. New projects added by CV automation need no write-up.
- **FR-004**: Every consumer of portfolio content (web terminal commands, HTML fallback,
  AI assistant prompt, and later SSH and curl) MUST read it through one shared loader;
  no consumer may keep its own copy.
- **FR-005**: The content MUST be validated against a single schema on every build and
  on every proposed change. A failure MUST block the deploy/merge and report the file,
  field path, and expected value.
- **FR-005a**: The system MUST check that project and contact links still resolve, on
  every proposed content change and on a regular schedule. Broken links MUST be reported
  as a warning listing each link and where it is used; they MUST NOT block a build,
  merge or deploy.
- **FR-006**: All content currently on the site MUST be migrated with no loss, and the
  old in-code content source MUST be removed once migration is verified.
- **FR-007**: The system MUST make the current content available to non-web surfaces
  (SSH, curl) from the deployed site, so those surfaces never need their own copy.

**CV automation (US2)**

- **FR-008**: Adding a PDF to the incoming-CV location MUST start the CV update process
  automatically; the owner MUST also be able to start it manually.
- **FR-008a**: A PDF in the incoming-CV location MUST NOT be served to visitors. The live
  downloadable CV changes only when the CV-update pull request is merged, which moves the
  PDF into place in the same change as the resume update. On failure the incoming PDF is
  left where it is and the live CV is unchanged.
- **FR-009**: The process MUST produce an updated resume file that changes only what the
  CV actually changed, using the current resume file as the starting point.
- **FR-010**: The process MUST NOT modify project identifiers, links, project write-ups,
  or any field the owner has marked as manually maintained.
- **FR-010a**: Entries (experience, projects, certifications, skills) that are in the
  current resume but absent from the CV MUST be kept, and the pull request summary MUST
  list them under "Not in CV, kept". Items *inside* a matched entry (bullets, skill
  names, coursework) follow the CV: an unprotected item the CV no longer has is removed
  and shown as removed in the pull request.
- **FR-010b**: For fields not marked as manually maintained, the CV wording MUST replace
  the portfolio wording. Fields marked as manually maintained keep their wording even
  when the CV phrases the same fact differently.
- **FR-010c**: The manual-override marker MUST work on any single field, including one
  bullet in a list or one skill name. Other fields of the same entry (e.g. dates, other
  bullets) still follow the CV. When a protected bullet's CV counterpart is reworded, the
  protected bullet is kept in its place and the CV version is NOT added as a duplicate.
- **FR-010d**: CV entries MUST be matched to existing resume entries by organisation (or
  project) plus dates, not by exact name, so a renamed or reformatted entry is updated in
  place rather than duplicated. When a match is uncertain, the change MUST still be
  proposed and the PR summary MUST list it under "Possible rename / duplicate".
- **FR-010e**: CV content that doesn't fit any part of the resume (e.g. a new section)
  MUST NOT be dropped silently; the PR summary MUST list it under "In CV, not mapped".
- **FR-011**: The updated resume MUST pass the same validation as FR-005 before a pull
  request is opened.
- **FR-012**: The pull request MUST include the resume diff and a short, plain-language
  summary of the changes.
- **FR-013**: The process MUST NOT merge, approve, or push directly to the main branch.
- **FR-014**: When the PDF can't be read, extraction fails, or validation fails, the
  process MUST open no pull request, MUST mark its run as failed, and MUST write a
  plain-language reason (and any invalid fields) to the run summary. The owner is
  notified through the standard run-failure email; no additional notification channel
  is used.
- **FR-015**: When the resulting resume is unchanged **and** the uploaded PDF is
  byte-identical to the live CV, the process MUST open no pull request, MUST finish as
  successful (not failed), and MUST report "no changes" in its run summary. When the
  resume is unchanged but the PDF differs (e.g. a new layout with the same facts), it
  MUST open a "PDF only" pull request that only replaces the live CV.
- **FR-016**: If a CV-update pull request is already open, a new run MUST update it
  instead of opening another.
- **FR-017**: Text inside the CV MUST be treated as data only; it cannot alter the
  process's rules or protected fields.

**Propagation (US3)**

- **FR-018**: A merged content change MUST reach the website, HTML fallback, AI assistant
  and downloadable CV through the normal deployment, with no manual step.
- **FR-019**: SSH and curl surfaces MUST pick up merged content within 10 minutes without
  being redeployed, and MUST keep serving the last good content if the source is
  unreachable.
- **FR-020**: Merging a CV change MUST trigger a refresh of the AI assistant's GitHub
  knowledge (delivered by Spec 004; until it exists this trigger is a no-op).

### Key Entities

- **Resume**: the structured record of the owner's profile — summary, contact/links,
  education, experience entries, project entries, skill categories, certifications.
  Validated by one schema.
- **Site copy**: page title, social-share title, description and keywords. Owned by the
  owner, never changed by CV automation.
- **Project write-up** (optional): a Markdown document for one project with links and a
  featured flag (title and stack come from the resume); linked to exactly one project entry in the Resume by
  identifier. Zero or one per project.
- **CV document**: the live downloadable PDF that visitors get. Changes only through a
  merged CV-update pull request.
- **Incoming CV**: a newly uploaded PDF waiting to be processed; never served to visitors.
- **Manual-override marker**: a flag on a single resume field (down to one bullet or one
  skill name) meaning "automation must not change this".
- **CV update proposal**: a pull request containing the resume diff and a change summary;
  requires owner review to merge.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After migration, 100% of existing commands produce output identical to
  before, and zero portfolio facts remain hardcoded outside the content files.
- **SC-002**: The owner can change any piece of portfolio content by editing a single
  file, with no code change, and see it live after one merge.
- **SC-003**: 100% of deliberately broken content files are caught before deploy, and
  every error message names the file and field.
- **SC-004**: From uploading a new CV PDF to a reviewable pull request takes under
  10 minutes.
- **SC-005**: Across the CV test set, protected fields (identifiers, links, write-ups,
  manual overrides) are changed in 0% of runs.
- **SC-006**: Unreadable or invalid CVs result in zero pull requests and a failure message
  in 100% of cases.
- **SC-007**: After a merge, every surface shows the new content within 10 minutes with
  no manual step.
- **SC-008**: Across the CV test set (including at least one CV in a different layout
  with renamed entries and an extra section), 0 entries are duplicated by renaming and
  0 pieces of CV content are dropped without appearing in the PR summary.

## Assumptions

- The SSH terminal and curl surfaces are delivered by Spec 003. This spec provides the
  single loader and the published content they will use; SSH/curl acceptance scenarios
  are verified once those surfaces exist.
- The AI knowledge refresh in FR-020 belongs to Spec 004; this spec only fires the trigger.
- The first CV is `Ahmed_Moghazy.pdf` (currently untracked at the repository root). It
  goes into the incoming-CV location as the first real input to the CV automation (and
  is kept as a test fixture); it becomes the live downloadable CV when that first
  pull request is merged.
- The migration in US1 copies the **current site content** exactly (so "no loss" is
  checkable by comparing command output). The first CV has the same roles, projects and
  certifications as the site, but longer bullet wording, full skill names (e.g.
  "Hyperparameter Optimization" vs "HPO"), two extra skill categories (Core Computer
  Science, Soft Skills) and a few extra skill items. Those differences come in through the
  first US2 run as a reviewable pull request, not through the migration.
- The owner is the only person who edits content or reviews CV pull requests.
- The CV is a text-based PDF in English. Scanned, image-only CVs are out of scope and are
  reported as unreadable.
- Dates in the resume keep their current human-readable month-year style ("Oct 2025",
  "Present") so command output stays identical after migration.
- Existing content inconsistencies (e.g. degree listed as Computer Science while the
  summary says Data Science) are fixed in the Phase 0 quick-fix PR, not by this migration;
  the migration copies content exactly as it is.
