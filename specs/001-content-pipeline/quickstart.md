# Quickstart: Content Pipeline (Spec 001)

How to check that each user story works. The commands run from the repo root.

## One-time setup

1. `npm ci`
2. Local CV tooling: `pdftotext -v` must work. On Windows, poppler 4.x on PATH is already
   installed here. On Ubuntu CI, `sudo apt-get install -y poppler-utils`.
3. GitHub repo settings (manual, once):
   - **Secret** `GOOGLE_GENERATIVE_AI_API_KEY` (you already have this key for Vercel).
   - **Secret** `CV_BOT_TOKEN`: a fine-grained PAT, *only this repository*, with
     permissions *Contents: Read and write* and *Pull requests: Read and write*. Set a
     1-year expiry and a calendar reminder to renew it.
   - **Branch protection** on `main`: require the `ci` status check.
4. Playwright browsers: `npx playwright install chromium`.

## US1: Content as files

```bash
npm run content:validate          # ✔ 0 errors
npm test                          # includes legacy-equivalence (SC-001)
npm run dev:web                   # open http://localhost:3000
```

In the terminal, try `about`, `experience act`, `projects`, `skills`, `timeline` and
`neofetch`. The output is identical to production before the migration.

Break something on purpose to check the error messages:

```bash
# change "position:" to "positon:" on the first work entry, then:
npm run content:validate
# ✖ content/resume.yaml:…  work[0].position  expected a non-empty string, received undefined
# ✖ content/resume.yaml:…  work[0].positon   unknown key
```

Also check that no content is hardcoded:
`git grep -nE "Cairo University|LangGraph|akhaledmoghazy" -- apps packages ':!**/test/**'`
should return nothing.

## US2: CV → pull request

Dry run locally (no PR, no file changes):

```bash
GOOGLE_GENERATIVE_AI_API_KEY=… npm run cv:sync -- --pdf Ahmed_Moghazy.pdf --dry-run
```

Expected result on the first real CV (spec US2 scenario 12):
- All 5 roles, 5 projects and 2 certificates are matched, with no "Possible rename" for
  either ACT role.
- Most bullets appear under **Updated** (CV wording is longer).
- **Added**: skill categories *Core Computer Science* and *Soft Skills*, plus extra
  skill items.
- Nothing under **Not in CV, kept**.

Tip: before the real run, protect any short bullets you want to keep, e.g.

```yaml
- value: Engineered a Hierarchical RAG Pipeline in PGVector, reducing hallucinations by 30% on long-form queries.
  manual: true
```

The real flow:

```bash
git mv Ahmed_Moghazy.pdf content/cv/incoming/Ahmed_Moghazy.pdf
git commit -m "cv: upload Ahmed_Moghazy.pdf" && git push   # to main
```

Then, under Actions, the **cv-update** run should be green and a PR titled
`CV update: … changes from Ahmed_Moghazy.pdf` should be open with CI running on it.

Failure paths, using the fixtures:

```bash
npm run eval:cv    # runs same-as-current, new-role, new-layout, dropped-project, image-only, corrupt
```

## US3: Propagation

1. Merge a content PR.
2. Within the Vercel deploy time, the site, the HTML fallback (view source), `/cv/latest.pdf`
   and the chat all show the new content.
3. Check the API:
   ```bash
   curl -si https://moghazy.me/api/content | head -5           # 200, ETag
   curl -si -H 'If-None-Match: "<etag>"' https://moghazy.me/api/content | head -1   # 304
   ```
4. Under Actions, **content-propagate** ran and logged either "dispatched inventory.yml"
   or the Spec 004 no-op message.
