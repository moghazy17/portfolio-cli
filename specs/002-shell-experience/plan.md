# Implementation Plan: Shell Experience

**Branch**: `003-shell-experience` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/002-shell-experience/spec.md`

## Summary

This spec turns the web terminal into a believable shell, entirely inside
`packages/shared`, so SSH and curl (Spec 003) inherit it.

The engine gains:

- A `createShell()` session object.
- A hand-written tokenizer and parser (quotes, flags, `|`, `&&`, and friendly rejection
  of `;`, `>` and similar).
- A registry that declares aliases, an argument schema, supported surfaces, menu
  membership and man metadata in one place. `help`, `man`, completion, menu and flag
  parsing all come from it.
- Pipes into `grep`, `head`, `tail`, `wc` and `sort`, over a single `toLines()`
  flattening of structured output. `grep` prefixes each match with its item id.
- A read-only virtual filesystem derived at runtime from the Spec 001 `content` module,
  with one `.md` per project, role and certification, plus `about.md` and `resume.pdf`.
- Suggestions using restricted Damerau-Levenshtein distance.
- An `onUnknownCommand` hook that receives whole natural-language lines before
  tokenizing.
- `man`, `resume` (a download effect on the web, a link on text surfaces) and a skippable
  `sudo hire-me` sequence.

Commands return structured nodes (three new ones: `error`, `progress`, `lines`) and
explicit side-effect fields (`theme`, `welcome`, `download`, `sequence`, `status`), so
hosts never re-parse input.

The web gets a rewritten `CommandLine` (completion, history with draft restore and
persistence, Ctrl+C, Ctrl+L), a cwd-aware prompt, a `SequencePlayer` and renderer support
for the new nodes. A pure ANSI string renderer ships now for curl. The Ink renderer is
deferred to Spec 003, where its host app is created (research R15).

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), Next.js 15 / React 18 (web), Node 20 (tests and CI)
**Primary Dependencies**: None new. The engine is dependency-free TypeScript in `packages/shared`. It uses the existing `content` module (Spec 001) and `theme.ts`
**Storage**: None on the server. Command history lives in the visitor's `localStorage` (`portfolio.history.v1`, at most 100 entries). Content is read-only from the bundle
**Testing**: Vitest (`packages/shared/test`, already set up), Playwright (`apps/web/e2e`, already set up), and a snapshot for the legacy-output guard (SC-001)
**Target Platform**: Modern evergreen browsers on desktop and mobile (Vercel). The engine is also runnable in Node for the future SSH and curl surfaces
**Project Type**: TypeScript monorepo, with a shared engine library and a Next.js web app
**Performance Goals**: Completion, history and key handling within 100 ms of the key press (SC-004). No measurable change to first terminal output (Principle VII): the engine adds only a few KB gzipped, and the VFS is built lazily on first use
**Constraints**:
- Existing command output stays identical, apart from the documented exceptions (SC-001)
- No content hardcoded in source (`no-hardcoded-content.test.ts`)
- No zod or YAML on the client
- Animations ≤ 5 s, skippable, and reduced-motion aware
- grep patterns are literal (no `RegExp` built from visitor input)
- Lines are capped at 1,000 characters and pipelines at 8 stages
**Scale/Scope**:
- About 30 registry entries: 21 existing, 5 filesystem, 5 filters, `man`, `resume`, and hidden write stubs
- About 15 VFS nodes
- 1 visitor per shell session

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Pre-design | Post-design | How |
|---|---|---|---|---|
| I | Single source of truth | ✅ | ✅ | The VFS, item ids, `about.md`, `resume`, the man pages and the hire-me email are all derived from `content`. The prompt uses the generic `visitor@portfolio`. The `no-hardcoded-content` test keeps guarding new files |
| II | Render-agnostic core | ✅ | ✅ with a deferral | Parser, pipes, VFS, man, suggestions, history rules and the unknown-input hook live in `packages/shared`. Commands return nodes and effect fields, never markup or ANSI. The registry has a `surfaces` field. The web renderer and a pure ANSI renderer ship here. The Ink renderer ships with `apps/ssh` in Spec 003 (R15). It is not a violation, because no SSH surface exists yet for a command to fail on |
| III | Simplicity first | ✅ | ✅ | No new dependencies, services or storage. The tokenizer, distance function and VFS are hand-written and small. The VFS is built at runtime from the existing bundle rather than as a second generated artifact |
| IV | Honest AI | N/A | N/A | No AI behavior changes. The `onUnknownCommand` hook is only the seam that Spec 004 plugs into |
| V | Security | ✅ | ✅ | There are no new endpoints. Visitor input never reaches `RegExp`, `eval` or HTML: grep is literal and React escapes text. Line and stage caps bound the work. `mailto:` parameters are URL-encoded. The download uses a same-origin static path. History stays in the browser |
| VI | Accessibility and motion | ✅ | ✅ | `sudo hire-me` is skippable (Ctrl+C or typing) and honors `prefers-reduced-motion`. `progress` has `role="progressbar"`. Keyboard-first by design. Ctrl+C with a text selection still copies. Mobile menu buttons and the semantic HTML fallback are unchanged |
| VII | Performance | ✅ | ✅ | Tiny engine code, a lazy VFS, no new libraries, synchronous completion. Animation never blocks input |
| VIII | Layered testing | ✅ | ✅ | Vitest for the tokenizer, parser, suggestions, completion, history, filters, pipes, VFS, VFS commands, item ids, man, resume, hire-me, read-only stubs, the ANSI renderer, registry coverage and the legacy snapshot. Playwright for the headline flows, keys, reduced motion and download. SSH smoke is N/A until Spec 003 |
| IX | Independent stories | ✅ | ✅ | US1: engine, registry, pipes and keys. US2 adds the VFS and its commands to the US1 registry. US3 adds man, resume and hire-me, which need only US1 (man for filesystem commands appears automatically once US2 lands). Each story has its own test selectors (quickstart) |
| X | Green gate | ✅ | ✅ | The existing `ci.yml` (validate, typecheck, test, build, e2e) covers all new tests. No workflow changes are needed |

No unjustified violations. **Gate: PASS.**

## Project Structure

### Documentation (this feature)

```text
specs/002-shell-experience/
├── plan.md              # this file
├── research.md          # R1–R17 decisions
├── data-model.md        # output nodes, registry, context/result, VFS, item ids, history, completion
├── quickstart.md        # per-story verification
├── contracts/
│   ├── shell-grammar.md # tokenizer/parser grammar, operators, flags, errors
│   ├── engine-api.md    # createShell/run/complete, effects, host responsibilities, stability
│   └── commands.md      # new/changed commands and exact messages
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
packages/shared/src/
├── types.ts                    # + ErrorOutput, ProgressOutput, LinesOutput, Line, SectionOutput.item,
│                               #   Surface, ArgSpec, ManPage, CommandContext, CommandResult effects
├── index.ts                    # + shell / vfs / render exports
├── content/
│   └── items.ts                # NEW itemIds() + slugify (shared by VFS and commands)
├── shell/                      # NEW
│   ├── tokenizer.ts            # quotes, escapes, operators
│   ├── parser.ts               # chain → pipelines → stages, validation
│   ├── args.ts                 # flag parsing against ArgSpec, --help, synopsis rendering
│   ├── shell.ts                # createShell(), run(), effects merge, cancellation
│   ├── lines.ts                # toLines()
│   ├── filters.ts              # grep, head, tail, wc, sort
│   ├── suggest.ts              # OSA distance + thresholds
│   ├── completion.ts           # complete()
│   ├── history.ts              # pure history state
│   └── unknown.ts              # defaultUnknownCommandHandler
├── vfs/                        # NEW
│   ├── build.ts                # buildFileSystem(content)
│   └── path.ts                 # resolve / normalize / display
├── render/
│   └── ansi.ts                 # NEW renderAnsi()
└── commands/
    ├── registry.ts             # metadata for every entry (man, args, menu, kind)
    ├── engine.ts               # back-compat wrappers over a default shell
    ├── cv.ts                   # + item ids on sections (output otherwise identical)
    ├── utility.ts              # theme → `theme` effect; welcome → `welcome` effect
    ├── github.ts               # accepts AbortSignal
    ├── easter-eggs.ts          # sudo hire-me sequence; rm legacy forms
    ├── fs.ts                   # NEW ls, cd, pwd, cat, tree, read-only stubs
    ├── man.ts                  # NEW man + renderManPage
    └── resume.ts               # NEW resume

packages/shared/test/           # new *.test.ts per R17 + __snapshots__/legacy-output

apps/web/
├── components/
│   ├── CommandLine.tsx         # rewrite: completion, history, Ctrl+C/L, prompt with cwd
│   ├── Terminal.tsx            # prompt/chrome show cwd; echo uses prompt
│   ├── OutputRenderer.tsx      # + error, progress, lines
│   ├── SequencePlayer.tsx      # NEW frame playback, skippable, reduced motion
│   └── ChatRenderer.tsx        # Ctrl+C: stop stream / leave chat
├── hooks/
│   ├── useTerminal.ts          # owns Shell instance + AbortController; applies effects
│   └── useHistory.ts           # NEW localStorage-backed wrapper over shared history
└── e2e/shell.spec.ts           # NEW US1–US3 flows
```

**Structure decision**: The existing monorepo layout stays. All behavior goes into new
`shell/`, `vfs/` and `render/` folders in `packages/shared`, next to `commands/`. The web
changes are limited to input handling, effect application and rendering of the new
nodes. `apps/ssh` is not created here (Spec 003).

## Implementation Notes by Story

- **US1 (P1)**:
  1. Capture the legacy-output snapshot first, before any refactor.
  2. Change types and the registry. Adapt existing handlers with `ctx.args`.
  3. Build the tokenizer, parser, args, `toLines`, filters, shell, suggestions and
     unknown-input hook.
  4. Update `engine.ts` wrappers, completion and history.
  5. Update the web `CommandLine`, `useTerminal` and `OutputRenderer` (for `lines` and
     `error`).
  6. Add item ids to the `cv.ts` sections.
  7. Add `renderAnsi` and its golden tests.
- **US2 (P2)**: `itemIds`, then `buildFileSystem`, then `fs.ts` commands and read-only
  stubs, then `path`/`dir` completers, then the cwd in the prompt.
- **US3 (P3)**: `man.ts` (reads the registry), then `resume.ts` plus the web download
  effect, then the `sudo hire-me` sequence plus `SequencePlayer` (skip and reduced
  motion), then the `progress` node in `OutputRenderer`.

## Deviations from the Plan Input

| Input said | Plan does | Why |
|---|---|---|
| Output nodes `text, heading, list, table, link, ascii-art, error, progress` | Keeps the existing `text, section, list, table, ascii, link, divider` and adds `error`, `progress` and `lines` | FR-010 and SC-001 require existing output to stay the same. `section` already plays the heading role, and `ascii` is ascii-art (R1) |
| Three renderers: React DOM, Ink, ANSI | React DOM and ANSI now. Ink in Spec 003 | No SSH host or Ink dependency exists yet. The archived Ink renderer is ported when `apps/ssh` is created (R15) |
| Args schema | A plain-object `ArgSpec`, not zod | Keeps zod out of the client bundle, as Spec 001 decided (R3) |

## Complexity Tracking

No constitution violations to justify.
