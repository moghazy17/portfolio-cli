# Research: Shell Experience

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-27

Technical Context had no open `NEEDS CLARIFICATION` items. The spec clarifications (grep
prefixing, one file per item, suggestion limits) settle the behavioral questions. This file
records each design decision and the alternatives that were rejected.

Baseline observed in the code (2026-09-27):

- `executeCommand(input)` splits on whitespace and looks up `parts[0]`. The registry alias
  `'rm -rf /'` therefore never matches: every `rm …` reaches `rmCommand()` through the
  name `rm`.
- `getCompletions(partial)` does command-name prefix matching only. It includes hidden
  commands and aliases, so `pro` is ambiguous (`projects`, `proj`) and Tab does nothing.
- `CommandLine.tsx` already has Up/Down (no draft restore, no dedupe, no persistence), Tab
  on a unique match, and Ctrl+L, which submits `clear` and so adds `clear` to history.
- Theme switching is a side effect in `useTerminal.ts`, which re-parses the input string
  (`parts[0] === 'theme'`). `welcome`/`home`/`banner` are also intercepted there by name.
- `WelcomeScreen` still contains arrow-key menu code, but `showMenu={false}`. The live
  "menu mode" is the always-visible menu bar built from `getMenuItems()`.
- `content.cv = { available, path: '/cv/latest.pdf' }` already exists, and
  `apps/web/scripts/copy-cv.mjs` copies the PDF into `public/cv/`.
- `no-hardcoded-content.test.ts` fails the build if the owner's first name, full name,
  employers, project names and similar strings appear in `packages/shared/src` or
  `apps/web/{app,components,hooks,lib}`. New prompts, man pages and email templates must
  build these strings from `content`.
- Ink and the SSH app do not exist on `main`. The old Ink UI is on branch
  `archive/cli` (`apps/cli/src/OutputRenderer.tsx`).

---

## R1 — Output model: extend the current union, don't replace it

**Decision**: Keep the seven existing `CommandOutput` variants and add three:

- `error`: `{ type: 'error', content }`.
- `progress`: `{ type: 'progress', label, value: 0..1 }`.
- `lines`: filtered pipe output, a list of styled lines that each carry an optional
  item prefix.

Add an optional `item?: string` identifier to `section`, which is how grep learns an
item's name. The user's node names map onto existing variants: *heading* is `section`
(which carries a title) or bold `text`, and *ascii-art* is `ascii`.

**Rationale**: FR-010 and SC-001 require existing output to stay the same. A rename would
touch every command and renderer and still end up with the same shapes. Adding variants
keeps old snapshots valid.

**Alternatives rejected**: A fresh node vocabulary (`heading`, `ascii-art`), which is
churn with no user-visible gain. Raw ANSI strings, which the constitution (Principle II)
forbids.

## R2 — Tokenizer and parser: hand-written, no dependency

**Decision**: A small hand-written tokenizer and parser in `packages/shared/src/shell/`
with this grammar (full contract in [contracts/shell-grammar.md](./contracts/shell-grammar.md)):

```
line      := chain
chain     := pipeline ( '&&' pipeline )*
pipeline  := command ( '|' command )*
command   := WORD WORD*
WORD      := ( bare | '…' | "…" | \x )+
```

- Single quotes are literal, and double quotes allow `\"` and `\\`. A backslash outside
  quotes escapes the next character.
- `||`, `;`, `>`, `>>`, `<`, `&`, `$(`, and backticks are recognized only so they can be
  rejected with a friendly message (`syntax error: ';' is not supported here — try '&&'`).
- `*` and `?` inside words are literal, since there is no globbing. Bare `?` is still the
  `help` alias.

**Rationale**: The grammar is tiny, and we need exact control over the error messages and
over the pre-parse unknown-word route (R6). A hand-written tokenizer is about 150 lines
and is fully unit-testable.

**Alternatives rejected**: `shell-quote`/`shlex`-style packages. They add a dependency to
the client bundle, cover operators we must reject anyway, and give generic errors.

## R3 — Registry: metadata, argument schema and supported surfaces

**Decision**: Extend `CommandDefinition` with:

- `kind: 'command' | 'filter'`.
- `args?: ArgSpec`. This declares positional arguments (each with an optional
  `complete` source) and flags (`short`, `long`, `value?`, `description`).
- `surfaces?: Surface[]`, where `Surface = 'web' | 'ssh' | 'curl'` and the default is all.
- `man: ManPage`, holding `summary`, `description` and `examples[]`. `synopsis` and
  `options` are derived from `args`.
- `menu?: boolean`, which replaces the hardcoded exclusion list in `getMenuItems()`.

The engine parses flags against `ArgSpec` before calling the handler. Unknown flags give
`<cmd>: unknown option '--x'` plus the usage line. `--help` on any command prints its
synopsis and a pointer to `man <cmd>`.

The handler signature becomes `execute(ctx: CommandContext)`. The context holds `args`
(raw positional arguments, as today), `flags`, `session`, `surface`, `origin` and
`signal`. Existing handlers get a one-line adapter: `execute: (ctx) =>
projectsCommand(ctx.args)`.

**Rationale**: One declaration drives `help`, `man`, completion, menu items and flag
parsing, so these cannot drift apart (FR-023, SC-005). The argument schema is a plain
object literal, not zod, because Spec 001 deliberately keeps zod out of the client
bundle (Principle VII).

**Alternatives rejected**: A zod schema per command, which puts ~50 KB on the critical
path. Free-form handler-side parsing, which gives inconsistent errors and no completion
metadata.

## R4 — Sessions and the engine entry point

**Decision**: Add `createShell(options) → Shell` to the shared package. The options are
`surface`, `origin`, `onUnknownCommand?` and `initialCwd?`. The shell exposes:

- `run(line, { signal? })`, which returns a `ShellResult`.
- `complete(line, cursor)`, which returns a `Completion`.
- The prompt data `{ user, host, cwdDisplay }`.

A shell owns one `ShellSession`, `{ cwd, lastStatus }`. History is not part of the
session; it is a separate pure helper (R12), because the UI owns persistence.

`executeCommand(input)` and `getCompletions(partial)` stay exported as thin wrappers over
a default web shell, so existing call sites and tests keep compiling.

**Rationale**: SSH (Spec 003) will run one shell per connection, and curl will run one
shell per request. A shell object gives each of them isolated `cwd` state without globals.

## R5 — Command side effects become explicit result fields

**Decision**: `CommandResult` keeps `output`, `clear`, `mode` and `openUrl`, and gains:

- `status?: 'ok' | 'error'` (default `'ok'`), which drives `&&`.
- `theme?: string`, which replaces the input re-parsing in `useTerminal`.
- `welcome?: true`, which replaces the name check in `useTerminal`.
- `download?: { url, filename }` (R10).
- `sequence?: SequenceStep[]` (R11).

When a command runs as the producer of a pipe, the shell drops every side effect except
`status`. The pipe keeps only the text. `welcome` still works through the menu bar and by
typing it.

**Rationale**: The surfaces must be able to apply effects without guessing from the
input. It also fixes a real bug: today, `theme dracula | wc` would switch the theme
because the hook sees `theme` in the input.

## R6 — Unknown input: resolve the first word before a full parse

**Decision**: The shell resolves the first whitespace-delimited word before tokenizing
the full line.

- If that word is not a known command, alias or filter, the raw line goes straight to
  `onUnknownCommand({ raw, word, suggestion }, ctx)`, where `suggestion` is set only for
  single-word input (R7). No tokenizer or parse errors are shown.
- If the word is known, the full parse and execute path runs.
- Unknown commands later in a chain or pipe (`ls && foo`) give a normal
  `foo: command not found` with a suggestion, and do not go to the hook. The hook is for
  whole-line natural language.

The default handler prints ``command not found: <word>``, plus ``did you mean `<x>`?``
when a suggestion exists, plus ``Type `help` for commands or `chat` to ask the AI.`` Its
status is `error`.

**Rationale**: Natural-language questions contain apostrophes (`what's his stack?`). A
tokenizer would reject these as unbalanced quotes before the AI hook could see them. That
would break Spec 004's plan to swap in an AI handler with no parser change (FR-013,
SC-009).

## R7 — Typo suggestions: restricted Damerau-Levenshtein

**Decision**: Use optimal-string-alignment distance, where insert, delete, substitute and
swapping two adjacent letters each count as one edit. It runs against the names and
aliases of visible commands and filters, case-insensitively. The limits come from the
clarification: 1 edit when the candidate is 4 characters or fewer, 2 edits otherwise. An
alias match is reported as its canonical command. Ties go to the command listed first in
`help`. Hidden commands are never candidates.

**Rationale**: FR-012 counts a swap as one edit, and plain Levenshtein would count it as
two. The algorithm is about 25 lines with no dependency.

## R8 — Pipes: flatten structured output to styled lines

**Decision**: A pure function `toLines(output): Line[]`, where
`Line = { text, style?, item? }`, is the single definition of an output's text form. Its
rules:

| Node | Lines |
|---|---|
| `text` / `error` | split on `\n`; style carried (`error` becomes the error color) |
| `section` | title line (accent, bold), then children; `item` is inherited by every child line |
| `list` | one line per item: `▸ item`, or `1. item` if ordered |
| `table` | a header line, then one line per row; columns padded to the widest cell, joined with two spaces |
| `ascii` | split on `\n` |
| `link` | `text: url` |
| `divider` | dropped (not a content line) |
| `progress` | `label  NN%` |
| `lines` | as is |

The filters take `Line[]` and return `Line[]`:

- `grep` supports `-i`, `-v`, `-c` and `-h`. The pattern is a literal substring, not a
  regular expression, so user input never reaches `RegExp` and there is no ReDoS risk.
  Each match is prefixed `item: ` when `item` is set and `-h` is absent.
- `head` and `tail` take `-n N` (default 10; also `-N`).
- `wc` takes `-l`, `-w` and `-c`; with no flag it prints all three.
- `sort` takes `-r` and `-u`, using a locale-insensitive, case-sensitive code-point order
  like `LC_ALL=C`.

The result is one `{ type: 'lines' }` node, so each line keeps its original style
(FR-009).

**Item ids** (clarification 1 and FR-009a):

- Commands set `item` on the sections they already emit. Projects use `slug`. Experience
  uses `<work.slug>-<slugify(position)>`. Certifications use `slugify(name)`, and skills
  use `slugify(category)`.
- One helper, `itemIds(content)`, generates these ids with collision suffixes (`-2`, in
  content order). The VFS and the commands both use it, so the prefix always equals the
  file name.

**Alternatives rejected**:

- Regular-expression grep. It carries ReDoS risk from visitor input and gives visitors
  little benefit. A plain `.` or `|` in a pattern would surprise them less as a literal.
- Pipes over rendered HTML or ANSI text. That would couple the filters to a renderer and
  break Principle II.

## R9 — Virtual filesystem: derived at runtime from `content`

**Decision**: `buildFileSystem(content)` builds an immutable tree the first time it is
used and caches it.

```
/                       (shown as ~)
├── about.md            → professional summary
├── resume.pdf          → binary marker (cat explains; `resume` delivers)
├── projects/<slug>.md
├── experience/<company>-<role>.md
└── certifications/<name>.md
```

- File nodes hold `render(): CommandOutput[]`. For a project, this is the same section
  that `projects <slug>` prints, followed by the write-up body when
  `content.writeups[slug]` exists. The Markdown is shown as text lines: headings bold,
  list markers kept, no HTML.
- Paths are resolved case-insensitively and support `.`, `..`, `~`, `/` and
  trailing slashes. `..` at the root stays at the root.
- `pwd` prints `/` or `/projects`. The prompt shows `~` or `~/projects`, and `/` and `~`
  are the same folder (FR-015).
- The commands are `ls [-a] [-l] [path…]`, `cd [path]`, `pwd`, `cat <path…>` and
  `tree [path]`.
  - `ls -l` adds a type/size column and is cheap to add. `-a` shows `.` and `..`.
  - `cd` with no argument goes to the root.
  - `cat` on a folder gives `cat: projects: Is a directory`. `cd` into a file gives
    `cd: about.md: Not a directory`. `ls` on a file prints the file name.

**Rationale**: The content is already in the bundle (Spec 001 R-generated module), so
deriving the tree from it at runtime adds no build step, and it updates whenever content
does (FR-016, SC-006). The tree is tiny (about 15 nodes).

**Alternatives rejected**: Generating the VFS into `generated.ts` at build time, which
adds a second artifact to keep in sync and brings no speed-up at this size.

## R10 — `resume` across surfaces

**Decision**: The handler reads `content.cv`.

- If `!available`, it prints `resume: CV not published yet` with status `error`.
- On the `web` surface it returns `download: { url: '/cv/latest.pdf', filename }`, plus a
  confirmation line and a link. `filename` is derived from `basics.name`, for example
  `Name-Surname-CV.pdf`.
- On `ssh` and `curl` it returns only a link to `new URL(content.cv.path, ctx.origin)`.

The web host sets `origin = window.location.origin`. SSH and curl (Spec 003) pass their
public origin.

The web applies `download` with a temporary `<a download>` element. If that throws or
download is unsupported, it falls back to `window.open`. `cat resume.pdf` prints
`resume.pdf: PDF document — run \`resume\` to download it` and never shows binary.

**Rationale**: Taking the origin from the host avoids a hardcoded domain in content or
code. The existing `/cv/latest.pdf` public path is reused unchanged, as the user's plan
input asked.

## R11 — Animated extras without blocking input

**Decision**: `CommandResult.sequence?: Array<{ delayMs, output }>` describes the
animated frames, and `output` always holds the final state.

- The web plays the frames with timers, keeps the input enabled, and appends the final
  output.
- Ctrl+C, a new submission, or `prefers-reduced-motion: reduce` skips straight to the
  final output (FR-027, FR-028).
- curl ignores the frames and prints only the final output. SSH/Ink will play them
  (Spec 003).

For `sudo hire-me`, the frames are the fake `[sudo] password for visitor:` prompt with
masked characters, then three `progress` steps ("verifying credentials", "checking
coffee supply", "granting access"), then `ACCESS GRANTED`. The total time is at most
3.5 s (under the 5 s limit in FR-024).

The final output is the name, email, LinkedIn, and a `mailto:` link with
`subject=Hiring inquiry via <origin host>` and a short greeting body, URL-encoded and
built from `content` (no hardcoded name).

`sudo hire …` (any word starting with `hire`) maps to the same result. Other `sudo`
input keeps the "Permission denied" joke, with the hint changed to `sudo hire-me`.

**Rationale**: The renderer owns timing, so the engine stays synchronous and pure, and
tests can assert on the frames and the final output without fake timers.

## R12 — History: a pure helper, persisted by the web

**Decision**: `packages/shared/src/shell/history.ts` provides pure functions:
`push(state, line)` (cap 100, skip blanks and consecutive duplicates), `up(state, draft)`
and `down(state)` (restores the draft past the newest entry). The web stores entries in
`localStorage['portfolio.history.v1']`, wrapped in try/catch and falling back to memory.
Chat-mode messages are not added to shell history. The current folder is not persisted,
so each reload starts at `~`.

**Rationale**: SSH needs the same behavior per connection without `localStorage`.

## R13 — Completion

**Decision**: `shell.complete(line, cursor)` returns
`{ start, end, candidates, replacement? }`.

- **Word position**: the first word of a pipeline segment completes to visible command
  names. After `|` it completes to filter names only. Aliases are matched, but candidates
  are grouped by canonical command. If every match resolves to one command, the canonical
  name is used, so `pro` becomes `projects ` (acceptance scenario 1).
- **Argument position**: the command's `ArgSpec` completer is used. The sources are:
  - `projects`: slugs and names
  - `experience`: work slugs
  - `skills`: category names
  - `themes`
  - `open-targets`
  - `commands` (for `man`: visible commands plus the shell and filter commands)
  - `path` and `dir` (VFS entries relative to `cwd`, with `/` appended to folders)
- **Replacement**: a unique match inserts the candidate plus a space (no space after a
  folder). Several matches insert the longest common prefix. Candidates that contain
  spaces are double-quoted.
- **Hidden commands** never appear (FR-003).

The web's double-Tab listing is UI state. On the second consecutive Tab with more than
one candidate, it prints the candidates as a `lines` block above a re-echoed prompt, the
way bash does.

## R14 — `man` pages

**Decision**: `renderManPage(def)` builds sections titled `NAME`, `SYNOPSIS`,
`DESCRIPTION`, `OPTIONS` (from `args.flags`, omitted if empty), `EXAMPLES` and `ALIASES`
(omitted if empty). Synopsis tokens are generated from `ArgSpec` as `[path]`,
`<pattern>` and `[-n N]`.

- `man` with no argument prints `What manual page do you want?` and
  `For example, try 'man projects'.`
- Unknown or hidden names print `No manual entry for <name>`.
- `man man` works.

A unit test asserts that every visible registry entry has a non-empty `man.description`
and at least one example (SC-005).

## R15 — Renderers

**Decision**:

- **Web (React DOM)**: extend `OutputRenderer.tsx` with `error`, `progress` (a text bar
  such as `████░░░░ 50%` with `role="progressbar"` and `aria-valuenow`) and `lines`
  (`item:` prefix dimmed). Add a `SequencePlayer` component.
- **ANSI string** (`packages/shared/src/render/ansi.ts`): `renderAnsi(output, { color,
  width, theme })`. It is pure and dependency-free, uses 24-bit color from the theme with
  a `color: false` mode, and is built on `toLines()`. It is written and tested here, with
  golden tests, so the curl route in Spec 003 only has to call it.
- **Ink (SSH)**: deferred to Spec 003, which creates `apps/ssh` and the Ink dependency.
  This spec guarantees that the structured nodes and `renderAnsi` cover every node type.
  Spec 003 ports the archived `apps/cli/src/OutputRenderer.tsx` (branch `archive/cli`) to
  the new node set.

**Rationale**: The user's input lists three renderers. An Ink renderer with no host app
would be dead code, with an untested React and Ink dependency tree in
`packages/shared`. That goes against Principle III, and the code would sit unused for a
spec. The ANSI renderer does have a consumer in this spec: the tests use it as the
canonical text rendering for the SC-001 legacy comparison.

**Alternatives rejected**: Shipping `@ahmed-moghazy/shared/ink` now with `ink` as a peer
dependency. There is no consumer and no integration test, and it doubles the React
surface of the shared package.

## R16 — Web key handling

**Decision**: Rewrite `CommandLine.tsx` around the shared helpers:

| Key | Behavior |
|---|---|
| Tab | Complete once; list candidates on a second consecutive Tab |
| Up / Down | Browse history, restoring the draft |
| Ctrl+C | Only when no text is selected (so copying still works). Aborts a running command through its `AbortController`, skips a playing sequence, or echoes `input^C` and clears the line |
| Ctrl+L | Clears the output but keeps the input and history. No longer submits `clear` |

The `ctrlKey` modifier is used on every OS. Cmd+C on macOS stays copy.

In chat mode, `ChatRenderer` maps Ctrl+C to stopping the in-flight stream, or leaving
chat if nothing is streaming. Menu bar buttons call the same `run()` path.

The prompt becomes `visitor@portfolio:<cwdDisplay>$`, and the window chrome shows the
same path. No owner name is used, which keeps `no-hardcoded-content` green.

**Cancellation**: `run()` receives an `AbortSignal`. `github` passes it to `fetch`. The
shell checks `signal.aborted` after every `await` and returns `{ output: [], cancelled:
true }`, so no late output is printed (FR-005).

## R17 — Test strategy

- **Vitest** (`packages/shared/test/`):
  - `shell-tokenizer`, `shell-parser`, `suggest`, `completion`, `history`, `filters`,
    `pipes` (end-to-end `run()`), `vfs`, `vfs-commands`, `man`, `resume`, `sudo-hire-me`,
    `read-only`, `ansi-render`, `item-ids`.
  - `legacy-output`: a snapshot of every existing command and alias with representative
    arguments. It is captured before the refactor (task 1) and must stay identical
    (SC-001).
  - `registry-coverage`: every visible command has man metadata (SC-005), and every
    content item is reachable by `ls` and `cat` (SC-006).
- **Playwright** (`apps/web/e2e/shell.spec.ts`):
  - The four headline flows (SC-002).
  - Tab completion, Up/Down with draft restore, Ctrl+C on a line and during
    `sudo hire-me`, Ctrl+L keeping the input.
  - Reduced motion (`page.emulateMedia({ reducedMotion: 'reduce' })`).
  - `resume` triggers a download event.
- **Latency** (SC-004): the Playwright tests assert that completion and history update
  within 100 ms of the key press. The engine runs synchronously, so this is a regression
  guard rather than a benchmark.
