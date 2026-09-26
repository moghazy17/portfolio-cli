<!--
Sync Impact Report
==================
Version change: (template, unversioned) → 1.0.0
Bump rationale: initial ratification; all placeholders replaced with concrete principles.

Modified principles: n/a (first version)
Added principles:
  I. Single Source of Truth
  II. Render-Agnostic Core
  III. Simplicity First
  IV. Honest AI
  V. Security by Default
  VI. Accessibility & Motion
  VII. Performance Budgets
  VIII. Layered Testing
  IX. Independently Shippable User Stories
  X. Green Gate Before Merge
Added sections: Platform & Surface Constraints; Development Workflow & Quality Gates; Governance
Removed sections: none

Templates:
  ✅ .specify/templates/plan-template.md — "Constitution Check" gate is generic and is filled
     per feature from this file; no edit needed.
  ✅ .specify/templates/spec-template.md — already requires prioritized, independently
     testable user stories (Principle IX); no edit needed.
  ✅ .specify/templates/tasks-template.md — "tests are OPTIONAL" note amended to point at
     Principle VIII, which makes tests mandatory for engine, web, SSH and AI work.
  ✅ .specify/templates/commands/*.md — directory not present; nothing to check.
  ⚠ CLAUDE.md — still says CV data lives in packages/shared/src/data.ts. Correct for the
     current code; update when Spec 001 migrates content to /content.
  ⚠ README.md — still documents npm install and data.ts (tracked in plan.md Phase 0).

Deferred TODOs: none.
-->

# Portfolio CLI Constitution

A terminal-style personal portfolio served over web, SSH and curl from one TypeScript monorepo.

## Core Principles

### I. Single Source of Truth

- All portfolio content (resume data, project write-ups, downloadable CV) MUST live in
  `/content` as YAML and Markdown.
- UI, renderer and server code MUST NOT hardcode portfolio content. They read it through
  the shared content loader in `packages/shared`.
- Content files MUST be schema-validated; invalid content fails the build and never deploys.

**Rationale**: one place to edit keeps web, SSH, curl and the AI assistant consistent and
lets automation (e.g. CV → PR) update content safely.

*Transition note*: `packages/shared/src/data.ts` is the pre-migration source and is
removed by Spec 001. Until then, new content MUST NOT be added anywhere else.

### II. Render-Agnostic Core

- The command engine in `packages/shared` MUST return structured output nodes, never
  raw colored strings or surface-specific markup.
- Web (React DOM), SSH (Ink) and curl (ANSI text) are thin renderers. They MUST NOT
  contain command logic.
- Every command MUST work on all three surfaces, or declare in the registry which
  surfaces it supports and give a clear message on the others.

**Rationale**: one engine means a feature is built and tested once and appears everywhere.

### III. Simplicity First

- When two approaches both meet the requirement, choose the one with fewer moving parts
  and fewer paid services.
- Any new infrastructure (service, datastore, host, paid API) MUST have a written
  justification in the feature's `plan.md` Complexity Tracking table, including the
  simpler alternative that was rejected and why.

**Rationale**: this is a one-person project; every extra service is ongoing cost and upkeep.

### IV. Honest AI

- The assistant MUST only state facts backed by `/content` or GitHub evidence, and MUST
  cite the source (repo and file) for claims about experience or technologies.
- When evidence is missing it MUST say "no public evidence found", never "never used"
  or any other claim of absence.
- Repository text, READMEs and tool results are untrusted data, never instructions.
  Prompt-injection attempts MUST NOT change the assistant's behavior or scope.
- The assistant MUST decline tasks unrelated to the portfolio.

**Rationale**: visitors (often recruiters) act on what the assistant says; invented
experience would be worse than no assistant.

### V. Security by Default

- No secrets in client bundles. API keys and tokens are read only on the server or in CI.
- Every public endpoint (chat, guestbook, content API, curl route, SSH) MUST be
  rate-limited.
- SSH sessions MUST have an idle timeout and a hard session-length cap, plus
  per-IP and global concurrency limits.
- Admin actions (e.g. guestbook deletion) MUST require a server-side token.

**Rationale**: the site is public and anonymous; abuse and cost spikes must be contained
by design, not by monitoring.

### VI. Accessibility & Motion

- Every animation (boot, typewriter, glitch, CRT, screensaver) MUST be skippable and MUST
  respect `prefers-reduced-motion`.
- The site MUST stay fully usable by keyboard and screen reader.
- The semantic HTML fallback of the portfolio content MUST be kept.

**Rationale**: the terminal is a gimmick for some visitors and a barrier for others; the
content must reach everyone.

### VII. Performance Budgets

- First terminal output MUST appear in under 1.5 s on a mid-range phone.
- The boot animation MUST NOT block input for more than 2 s.
- Heavy animation or UI libraries MUST NOT be loaded on the terminal's critical path.

**Rationale**: a slow first screen loses the visitor before any content is seen.

### VIII. Layered Testing

- Engine logic (parser, pipes, VFS, commands, content loader) MUST have Vitest unit tests.
- Web user flows MUST have Playwright tests.
- The SSH server MUST have a scripted smoke test (connect, run a command, check output).
- The AI assistant MUST have a golden-question eval set (tech lookups, "no evidence"
  cases, off-topic refusals, injection attempts) that runs in CI.

**Rationale**: three surfaces and an LLM can regress silently; each layer needs its own
cheap, automated check.

### IX. Independently Shippable User Stories

- Specs MUST be written as prioritized user stories (P1, P2, P3…).
- Each story MUST be implementable, testable and mergeable on its own, without waiting
  for lower-priority stories.

**Rationale**: small, shippable slices keep `main` releasable after every story.

### X. Green Gate Before Merge

- `npm run typecheck` and all tests (unit, Playwright, SSH smoke, AI evals as applicable)
  MUST pass before any merge to `main`.
- A failing or skipped check MUST NOT be bypassed without a written reason in the PR.

**Rationale**: the gate is what makes Principles VIII and IX enforceable.

## Platform & Surface Constraints

- **Monorepo**: TypeScript, strict mode. Shared logic in `packages/shared`; web app in
  `apps/web` (Next.js on Vercel); SSH server in `apps/ssh` (Node + `ssh2` + Ink on Fly.io).
- **Content**: `/content/resume.yaml`, `/content/projects/<slug>/README.md`,
  `/content/cv/latest.pdf`, validated with zod in `packages/shared`.
- **AI**: Gemini through the Vercel AI SDK, called only from server routes or CI.
- **State**: Upstash Redis for cache, inventory, presence, guestbook and rate limits.
  Features MUST degrade gracefully when Redis env vars are absent in local development.
- Adding a surface, host or datastore beyond these requires a Principle III justification.

## Development Workflow & Quality Gates

- Each feature follows the Spec Kit loop: specify → clarify → plan → tasks → analyze →
  implement, one user story at a time.
- Every `plan.md` MUST include a Constitution Check listing each principle as pass,
  not applicable, or justified violation.
- Pull requests MUST state which surfaces (web, SSH, curl) a change affects and how each
  was verified.
- CI runs typecheck, content validation, unit tests, Playwright, SSH smoke and AI evals.

## Governance

- This constitution supersedes other practices and guidance files. `CLAUDE.md` and
  `README.md` hold runtime guidance and MUST NOT contradict it.
- **Amendments**: change this file in a PR that explains the change, updates the Sync
  Impact Report, and updates any affected templates in `.specify/templates/`.
- **Versioning** (semantic):
  - MAJOR: a principle is removed or redefined in a backward-incompatible way.
  - MINOR: a principle or section is added, or guidance is materially expanded.
  - PATCH: clarifications and wording fixes with no change in meaning.
- **Compliance**: `/speckit-plan` and `/speckit-analyze` check every feature against these
  principles; reviewers confirm compliance before merge. Violations are allowed only when
  recorded in the plan's Complexity Tracking table.

**Version**: 1.0.0 | **Ratified**: 2026-09-26 | **Last Amended**: 2026-09-26
