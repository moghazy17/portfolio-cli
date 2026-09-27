---

description: "Task list for Spec 002: Shell Experience"
---

# Tasks: Shell Experience

**Input**: Design documents from `specs/002-shell-experience/`
**Prerequisites**: plan.md, spec.md, research.md (R1â€“R17), data-model.md, contracts/ (shell-grammar, engine-api, commands), quickstart.md

**Tests**: Required by Constitution Principle VIII. Engine logic gets Vitest tests in
`packages/shared/test/`, and web flows get Playwright tests in `apps/web/e2e/shell.spec.ts`.
Write each story's tests first and confirm they fail before implementing. The SSH smoke
test and AI evals are N/A (Spec 003 and Spec 004).

**Organization**: Tasks are grouped by user story, so each story can be implemented,
tested and merged on its own (Principle IX).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1, US2 or US3 from spec.md
- Paths are repo-relative. "Shared" means `packages/shared`.
- Never hardcode portfolio facts (the owner's name, employers, project names) in source.
  Build them from `content`, `cvData` or `profile`, because
  `packages/shared/test/no-hardcoded-content.test.ts` enforces this.

---

## Phase 1: Setup (baseline guard)

**Purpose**: Freeze today's behavior before any refactor, and create the folder skeleton.

- [X] T001 Create `packages/shared/test/legacy-output.test.ts`. For every entry in the *current* `commandRegistry`, call `executeCommand()` with each name and each alias (skip the multi-word alias `'rm -rf /'` and call `executeCommand('rm -rf /')` separately). Also call it with these argument cases: `experience <first work slug>`, `experience zzz`, `projects <first project slug>`, `projects zzz`, `skills <first category name lowercased>`, `skills zzz`, `theme`, `theme dracula`, `theme zzz`, `open`, `open github`, `open zzz`, `sudo`, `sudo hire ahmed`. Assert the output with `toMatchSnapshot()`, using a serializer that deletes any `item` key on `section` nodes. Skip `github` and `gh`, since they use the live network, and `hello`, `hi` and `hey`, since they pick a random greeting. For those, only assert the output node types. Run `npm test -w @ahmed-moghazy/shared` once to write `packages/shared/test/__snapshots__/legacy-output.test.ts.snap`, and commit the snapshot unchanged. Add a header comment listing the documented exceptions from `contracts/engine-api.md` (help, sudo hint, unknown-command text, rm with other paths, `--help`). Their snapshots are updated deliberately in the task that changes them.
- [X] T002 [P] Create empty module folders with an `index.ts` barrel each: `packages/shared/src/shell/index.ts`, `packages/shared/src/vfs/index.ts`, `packages/shared/src/render/index.ts`. Re-export all three from `packages/shared/src/index.ts`.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: The types, registry shape, item ids and text flattening that every story uses.

**âš ï¸ CRITICAL**: No user story work can start until this phase is complete.

- [X] T003 Extend `packages/shared/src/types.ts` exactly as `data-model.md` specifies. Add:
  - `ErrorOutput`, `ProgressOutput`, `LinesOutput` and `Line` in the `CommandOutput` union, and optional `item?: string` on `SectionOutput`.
  - `Surface`, `ArgSpec`, `FlagSpec`, `CompletionSource` and `ManPage`.
  - `CommandDefinition` fields `kind`, `menu`, `surfaces`, `args` and `man`, and change `execute` to `execute(ctx: CommandContext)`.
  - `CommandContext`, and the `CommandResult` fields `status`, `theme`, `welcome`, `download` and `sequence`.
  - `SequenceStep`, `ShellResult`, `ShellSession`, `UnknownInput`, `UnknownCommandHandler` and `VfsPath`.
  - Add placeholder `case` branches for `error`, `progress` and `lines` in `apps/web/components/OutputRenderer.tsx` (render `content`, `label` or line text as plain text) so the web keeps type-checking.
- [X] T004 [P] Write `packages/shared/test/item-ids.test.ts`. Cover:
  - Project ids equal the slugs.
  - Experience ids are `<work.slug>-<slugify(position)>`.
  - `slugify` strips diacritics and punctuation, caps at 60 characters, and falls back to `<kind>-<n>` when the result is empty.
  - Collisions get `-2` and `-3` in content order.
  - Ids are stable across two calls.
  - Arrays are parallel to the content arrays.

  Use hand-built `Content` fixtures, not the real content.
- [X] T005 [P] Write `packages/shared/test/lines.test.ts` covering every row of the R8 table in `research.md`:
  - `text` with `\n`; `error`.
  - `section` title line with bold and accent, and `item` inherited by children, including nested sections.
  - `list` ordered and unordered (`â–¸ `, `1. `).
  - `table` padded columns joined by two spaces.
  - `ascii`; `link` â†’ `text: url`; `divider` dropped; `progress` â†’ `label  NN%`; `lines` passthrough.
- [X] T006 Implement `packages/shared/src/content/items.ts` with `slugify()` and `itemIds(content)` returning `Record<'project'|'experience'|'certification'|'skill', string[]>`, as specified in data-model "Item identity". Export it from `packages/shared/src/content/index.ts`. T004 should now pass.
- [X] T007 Implement `packages/shared/src/shell/lines.ts` with `toLines(output: CommandOutput[]): Line[]` per R8, and export it from the shell barrel. T005 should now pass.
- [X] T008 Convert `packages/shared/src/commands/registry.ts` to the new `CommandDefinition` shape:
  - Every `execute` becomes `(ctx) => existingFn(ctx.args)` (or `() => existingFn()`).
  - Add `menu: true` to exactly `help`, `about`, `education`, `experience`, `projects`, `skills`, `certifications`, `contact`, `timeline`, `github` and `chat`.
  - Remove the `'rm -rf /'` alias.
  - `helpCommand` stays as is for now.

  Then update `packages/shared/src/commands/engine.ts`:
  - `executeCommand` builds a minimal `CommandContext`: `args` = whitespace split, `flags {}`, `argv` = args, `session {cwd:'/', lastStatus:'ok'}`, `surface 'web'`, `origin ''`, `signal: new AbortController().signal`, and `fs` cast as a placeholder until US2.
  - `getMenuItems()` filters on `c.menu && !c.hidden`. Its output must be unchanged, so assert this with an inline test in `legacy-output.test.ts`.

  T001 must stay green.
- [X] T009 Add item ids to the per-item sections in `packages/shared/src/commands/cv.ts` using `itemIds(content)`:
  - `experienceCommand`, `projectsCommand`, `certificationsCommand` and `skillsCommand` set `item` on each `SectionOutput`.
  - Map entries back to their content index so filtered output keeps the correct id.

  T001 must stay green, since its serializer strips `item`.
- [X] T010 Move side effects out of input parsing:
  - `themeCommand` in `packages/shared/src/commands/utility.ts` returns `theme: themeName` on success.
  - `welcomeCommand` returns `welcome: true`.
  - `clear` in `registry.ts` keeps `clear: true`.
  - In `apps/web/hooks/useTerminal.ts`, delete the `parts[0] === 'theme'` parsing and the `welcome/home/banner` name check. Apply `result.theme` (via `themes[result.theme]` â†’ `setTheme`) and `result.welcome` (show `WelcomeScreen`, reset history) instead.
  - Behavior must be unchanged: run `npm run test:e2e` smoke and T001.

**Checkpoint**: The registry has the new shape, item ids exist, `toLines` exists, and the legacy output is unchanged.

---

## Phase 3: User Story 1 â€” Real shell behavior (Priority: P1) ðŸŽ¯ MVP

**Goal**: Tab completion, history, Ctrl+C, Ctrl+L, quoted arguments and flags, pipes into
`grep`/`head`/`tail`/`wc`/`sort`, typo suggestions and a pluggable unknown-input hook. All
existing commands, the menu bar, themes and chat keep working.

**Independent Test**: Follow the quickstart "User Story 1" table on the web. Run
`npm test -- shell-tokenizer shell-parser args suggest completion history filters pipes unknown ansi-render legacy-output`
and `npm run test:e2e -- shell.spec.ts -g "US1"`.

### Tests for User Story 1 (write first, confirm they fail)

- [X] T011 [P] [US1] Write `packages/shared/test/shell-tokenizer.test.ts`. Cover:
  - Bare words; single quotes (literal); double quotes with `\"` and `\\`; a backslash escape outside quotes; adjacent pieces (`a"b c"d` â†’ `ab cd`).
  - `*` and `?` stay literal.
  - Operators `|` and `&&` recognized outside quotes; `grep "a|b"` stays literal.
  - Every rejected operator and message in the `contracts/shell-grammar.md` "Rejected operators" table, and unterminated `'` and `"`.
- [X] T012 [P] [US1] Write `packages/shared/test/shell-parser.test.ts`. Cover:
  - Chain, pipeline and stage structure for every row of the shell-grammar "Examples" table.
  - Empty stage around `|` and `&&`.
  - More than 8 stages â†’ error; a line over 1,000 characters â†’ `error: input too long (max 1000 characters)`.
  - A filter in the first position â†’ `grep: expects piped input`.
  - A non-filter after `|` â†’ `about: cannot receive piped input (try grep, head, tail, wc, sort)`.
- [X] T013 [P] [US1] Write `packages/shared/test/args.test.ts` for flag parsing against `ArgSpec`, per the shell-grammar "Flags" section. Cover:
  - `-n 3`, `-n3`, `--lines=3` and `--lines 3`.
  - Grouped `-iv`; `--` ends flags; `head -5` shorthand.
  - Unknown flag â†’ `<cmd>: unknown option '<flag>'` plus `usage: <synopsis>`.
  - `--help` â†’ usage plus `See 'man <cmd>' for details.`
  - A command with no `flags` declared receives every token as `args` (for example `projects -x` â†’ args `['-x']`).
  - `renderSynopsis()` output for `grep`, `head` and `ls`.
- [X] T014 [P] [US1] Write `packages/shared/test/suggest.test.ts`. Cover:
  - The OSA distance, where a swap counts as 1.
  - Short names (â‰¤ 4 characters) accept only distance 1: `hepl` â†’ `help`, `hlp` â†’ `help`, `hx` â†’ none.
  - Long names accept distance 2: `projcts` â†’ `projects`, `experiance` â†’ `experience`, `certs` alias match reported as `certifications`.
  - A tie resolves to the earlier `help` order.
  - Hidden commands are never suggested (`sudp` â†’ none, `neofech` â†’ none).
  - Multi-word input is never suggested.
- [X] T015 [P] [US1] Write `packages/shared/test/filters.test.ts` for each filter over `Line[]`:
  - `grep`: `-i`, `-v`, `-c` and `-h`; the `item: ` prefix appears only when an item is set; a literal pattern such as `grep "a.b"` does not match `axb`; no match â†’ status `error`; a missing pattern â†’ usage.
  - `head` and `tail`: default 10, `-n N`, `-N`, and an invalid number message.
  - `wc`: `-l`, `-w`, `-c`, and the no-flag format of 7-wide right-aligned columns.
  - `sort`: code-point order, `-r`, `-u`, with styles travelling with their lines.
- [X] T016 [P] [US1] Write `packages/shared/test/pipes.test.ts` using `createShell({ surface: 'web', origin: 'https://example.test' })`. Cover:
  - `skills | grep -i <a keyword from content>` returns a `lines` node whose lines are prefixed with the skill's item id.
  - `projects | grep <word from a project's stack>` prefixes with the project slug.
  - `projects | head -n 3`, `projects | tail -n 2`, `projects | wc -l` (equals `toLines(projects).length`), and `skills | sort`.
  - A chained `experience | grep -i <x> | wc -l`.
  - `theme dracula | wc -l` has no `theme` effect.
  - `a && b`: `b` is skipped when `a` fails, outputs are concatenated, and effects are merged.
  - An aborted signal returns `{ output: [], cancelled: true }`, including when aborted during an async handler (use a fake async command registered in the test).
  - A throwing handler â†’ `<cmd>: something went wrong`.
- [X] T017 [P] [US1] Write `packages/shared/test/unknown.test.ts`. Cover:
  - `projcts` â†’ `command not found: projcts`, ``did you mean `projects`?``, and ``Type `help` for commands or `chat` to ask the AI.``, with status `error`.
  - `who are you` and `what's his stack?` never produce a parse error and never get a suggestion.
  - A custom `onUnknownCommand` passed to `createShell` receives `{ raw, word, suggestion }` and its result is returned, with no change to any command (SC-009).
  - An unknown command later in a chain (`help && foo`) gives `foo: command not found` and does not call the hook.
- [X] T018 [P] [US1] Write `packages/shared/test/completion.test.ts` against `shell.complete(line, cursor)`. Cover:
  - `pro` â†’ replacement `projects ` (aliases grouped by canonical name).
  - `t` â†’ candidates `theme`, `timeline` (and later `tree`), with no filters and no hidden commands.
  - After `|`, only filters are offered.
  - Argument completion for `projects <prefix>`, `experience <prefix>`, `skills <prefix>` (quoted when it contains a space), `theme <prefix>` and `open <prefix>`.
  - Multiple matches â†’ longest common prefix.
  - No matches â†’ no replacement.
  - An empty line lists only visible commands.
- [X] T019 [P] [US1] Write `packages/shared/test/history.test.ts`. Cover:
  - `push` ignores blanks and consecutive duplicates, and caps at 100 by dropping the oldest.
  - `up` saves the draft on the first press and stops at the oldest entry.
  - `down` past the newest entry restores the draft.
  - Acceptance scenario 4: three commands, Up Ã—3, Down Ã—1 â†’ the second-most-recent command.
- [X] T020 [P] [US1] Write `packages/shared/test/ansi-render.test.ts`. Cover:
  - With `color: false`, the output equals the `toLines` join formula in `contracts/engine-api.md` for `about`, `projects` and `timeline`, stored as golden inline snapshots.
  - With `color: true`, spans get 24-bit SGR codes from the default theme, every span ends with `\x1b[0m`, and links are OSC 8 with the visible `text: url`.
- [X] T021 [P] [US1] Write `apps/web/e2e/shell.spec.ts` in a `describe('US1')` block. Cover:
  - `pro` + Tab â†’ the input value is `projects `.
  - `t` + Tab + Tab â†’ the candidates are listed and the input is kept.
  - Run 3 commands, then Up Ã—3 and Down Ã—1 â†’ the second most recent; type `abc`, Up, Down â†’ `abc`.
  - History persists after `page.reload()`.
  - `foo` + Ctrl+C â†’ the echo contains `foo^C` and the input is empty.
  - Ctrl+L with `abc` typed â†’ the output is cleared and the input is still `abc`.
  - `projects | grep <word>` shows prefixed lines; `projcts` shows ``did you mean `projects`?``.
  - `theme dracula` changes the CSS variable `--bg`, and the menu bar buttons still run their commands.
  - Measure keydown â†’ DOM update for Tab and ArrowUp, and assert < 100 ms (SC-004).

### Implementation for User Story 1

- [X] T022 [P] [US1] Implement `packages/shared/src/shell/tokenizer.ts` per `contracts/shell-grammar.md`. It is a character scanner producing `WORD`, `PIPE` and `AND` tokens with source spans, and returns typed `ParseError`s with the exact contract messages. T011 should now pass.
- [X] T023 [US1] Implement `packages/shared/src/shell/parser.ts`, which turns tokens into `Chain â†’ Pipeline[] â†’ Stage[]` (data-model "Pipeline"). Enforce the 1,000-character and 8-stage caps and the filter-position rules, resolving `kind` through a registry lookup function passed in. T012 should now pass. Depends on T022.
- [X] T024 [P] [US1] Implement `packages/shared/src/shell/args.ts` with:
  - `parseArgs(def, argv)` â†’ `{ args, flags } | { error }`, per the shell-grammar "Flags" section, including the passthrough when `def.args?.flags` is undefined.
  - `renderSynopsis(def)`: `<name> [-x] [--long N] <positional> [optionalâ€¦]`.
  - `helpUsage(def)` for `--help`.

  T013 should now pass.
- [X] T025 [P] [US1] Implement `packages/shared/src/shell/suggest.ts`: OSA distance, `suggestCommand(word)` over visible names and aliases (alias â†’ canonical), the â‰¤ 4 characters â†’ 1 / else â†’ 2 limits, and tie-break by registry order. T014 should now pass.
- [X] T026 [US1] Implement `packages/shared/src/shell/filters.ts` (the `grep`, `head`, `tail`, `wc` and `sort` functions over `Line[]`, per `contracts/commands.md`, with literal `includes`, never `RegExp`). Register the five filters in `packages/shared/src/commands/registry.ts` with `kind: 'filter'`, full `args.flags`, `description` and `man` (description plus two examples each). T015 should now pass. Depends on T024.
- [X] T027 [P] [US1] Implement `packages/shared/src/shell/unknown.ts` with `defaultUnknownCommandHandler`, using the exact messages in `contracts/commands.md` "Changed messages" and status `error`.
- [X] T028 [US1] Implement `packages/shared/src/shell/shell.ts` with `createShell(options)` per `contracts/engine-api.md`:
  - The first-word route to `onUnknownCommand`, then tokenize and parse, then run each pipeline.
  - Surface check, then `parseArgs`, then `execute(ctx)`.
  - Filter stages via `toLines`, with side effects dropped for piped producers.
  - `&&` short-circuit and effect merge.
  - `AbortSignal` checks after every `await`, giving `{ output: [], cancelled: true }`.
  - try/catch â†’ `<cmd>: something went wrong`, plus `console.error`.
  - `session.cwd` and `lastStatus` updates, and `prompt()`.

  Export it from the shell barrel. T016 and T017 should now pass. Depends on T023â€“T027.
- [X] T029 [US1] Rewrite `packages/shared/src/commands/engine.ts` as back-compat wrappers over a lazily created default shell (`surface 'web'`, `origin ''`):
  - `executeCommand(input)` â†’ `shell.run(input)`.
  - `getCompletions(partial)` returns visible command names matching the prefix (hidden removed).
  - `getMenuItems()` is unchanged.

  Update the T001 snapshot **only** for the documented exceptions: the unknown-command text and `--help`. Review the diff by hand. Depends on T028.
- [X] T030 [US1] Implement `packages/shared/src/shell/completion.ts`, exposed as `shell.complete(line, cursor)`:
  - Find the current stage and word from token spans, tolerating an unterminated quote.
  - In command position, offer visible command names grouped by canonical name (filters only after `|`).
  - In argument position, use the `CompletionSource` from the command's `ArgSpec`. Add sources to the existing commands in `registry.ts`: `projects` â†’ `'projects'`, `experience` â†’ `'experience'`, `skills` â†’ `'skills'`, `theme` â†’ `'themes'`, `open` â†’ `'open-targets'`. Leave the `path` and `dir` sources returning `[]` until US2.
  - Build the replacement from the unique match (plus a space) or the longest common prefix, quoting candidates that contain spaces.

  T018 should now pass. Depends on T028.
- [X] T031 [P] [US1] Implement `packages/shared/src/shell/history.ts` (`empty`, `push`, `up`, `down`, `HISTORY_LIMIT = 100`) per data-model "History". T019 should now pass.
- [X] T032 [P] [US1] Make `github` cancellable:
  - `fetchGitHubData(signal?: AbortSignal)` in `packages/shared/src/github.ts` passes the signal to every `fetch`.
  - `githubCommand(signal)` in `packages/shared/src/commands/github.ts`.
  - The registry passes `ctx.signal`.
- [X] T033 [US1] Update `helpCommand` in `packages/shared/src/commands/registry.ts` per `contracts/commands.md`:
  - List every visible `kind: 'command'` entry.
  - Add a `Pipes` row: `grep, head, tail, wc, sort`.
  - Change the tip to `Tip: Tab completes, â†‘/â†“ browse history, pipes work: projects | grep rag`.

  Update the `help` snapshot deliberately.
- [X] T034 [P] [US1] Implement `packages/shared/src/render/ansi.ts` with `renderAnsi(output, { color = true, width = 80, theme = themes[DEFAULT_THEME] })`, built on `toLines`: SGR 38;2 truecolor, bold, dim and italic, a reset after each span, OSC 8 links, and `color: false` â†’ plain text. Export it from the render barrel. T020 should now pass.
- [X] T035 [US1] Update `packages/shared/src/index.ts` and the barrels to export everything in the `contracts/engine-api.md` "Exports" block that exists after US1: `createShell`, `defaultUnknownCommandHandler`, `toLines`, `renderAnsi`, `suggestCommand`, `history`, `itemIds`, and the existing wrappers. Run `npm run typecheck`.
- [X] T036 [P] [US1] Create `apps/web/hooks/useHistory.ts` over the shared `history` helpers. It loads and saves `localStorage['portfolio.history.v1']` (a JSON string array) inside try/catch with an in-memory fallback, and exposes `push`, `up(current)` and `down()`.
- [X] T037 [US1] Refactor `apps/web/hooks/useTerminal.ts`:
  - Hold one `Shell` in a `useRef`, created with `createShell({ surface: 'web', origin: window.location.origin })` on mount.
  - Keep one `AbortController` per `run`, and expose `cancel()` (abort it and mark the run cancelled).
  - Apply the effects `clear`, `theme`, `welcome`, `openUrl` and `mode` from `ShellResult`. Ignore `cancelled` results.
  - Record the echoed input with the prompt string of the time (`visitor@portfolio:<cwd>$`) in each `HistoryEntry`. Add optional `prompt?: string` to `HistoryEntry` in `packages/shared/src/types.ts`.
  - Use `useHistory` instead of `commandHistoryList`, and only for command-mode input.
  - Expose `clearScreen()`, which empties the visible history without submitting `clear`.
- [X] T038 [US1] Rewrite `apps/web/components/CommandLine.tsx` per research R16:
  - **Tab** â†’ `shell.complete(input, caret)`. Apply the `replacement`. On a second consecutive Tab with more than one candidate, call an `onListCandidates(candidates)` prop that appends a `lines` block to the visible history, and keep the input.
  - **ArrowUp / ArrowDown** â†’ `useHistory` with draft restore.
  - **Ctrl+C** (`e.ctrlKey && e.key === 'c'`, only when `window.getSelection()?.toString()` is empty): if a command is running, call `cancel()`. Otherwise append an echo entry `input^C` and clear the input.
  - **Ctrl+L** â†’ `clearScreen()`, keeping the input.
  - The prompt label shows `visitor@portfolio:<cwd>$` from `shell.prompt()`.
  - Keep the existing input attributes (`enterKeyHint`, `autoCapitalize="off"`, `aria-label`).
- [X] T039 [US1] Update `apps/web/components/Terminal.tsx`:
  - Wire the new `CommandLine` props (`complete`, `cancel`, `clearScreen`, `onListCandidates`, `prompt`).
  - The history echo uses `entry.prompt ?? '$'`.
  - The window chrome title shows the current prompt instead of the static `ahmed@portfolio ~ $`.
  - The menu bar still calls `handleCommand(item.value)`.
- [X] T040 [P] [US1] Finish `error` and `lines` rendering in `apps/web/components/OutputRenderer.tsx`:
  - `error` uses the `theme.error` color.
  - `lines` renders one `<div>` per line, with its style (reuse the `text` style logic) and a dimmed `item: ` prefix `<span>` when `line.item` is set and `showItems !== false`.
- [X] T041 [P] [US1] Add Ctrl+C handling to `apps/web/components/ChatRenderer.tsx`. With no text selected: if a response is streaming, call `stop()` from the AI SDK hook; otherwise call `onExit()`. Keep typed `exit` working.
- [X] T042 [US1] Run `npm test`, `npm run typecheck` and `npm run test:e2e -- -g "US1"`. Go through every quickstart US1 row by hand in `npm run dev:web`. Confirm the T001 snapshot diff contains only the documented exceptions.

**Checkpoint**: US1 is shippable on its own (MVP), with the web terminal behaving like a real shell over the existing commands.

---

## Phase 4: User Story 2 â€” Browsable filesystem (Priority: P2)

**Goal**: `ls`, `cd`, `pwd`, `cat` and `tree` over a read-only tree with `about.md`,
`resume.pdf`, `projects/`, `experience/` and `certifications/`, derived from content. The
prompt shows the current folder, and paths complete on Tab.

**Independent Test**: Follow the quickstart "User Story 2" table. Run
`npm test -- vfs vfs-commands read-only registry-coverage` and
`npm run test:e2e -- shell.spec.ts -g "US2"`.

### Tests for User Story 2 (write first, confirm they fail)

- [X] T043 [P] [US2] Write `packages/shared/test/vfs.test.ts` for `buildFileSystem(content)` with a fixture `Content`. Cover:
  - The root lists `about.md`, `resume.pdf` (only when `cv.available`), `projects/`, `experience/` and `certifications/`, with folders first.
  - One `<id>.md` per item, and the names equal `itemIds`.
  - `resolve` handles `~`, `~/x`, `/`, `.`, `..` (clamped at the root), `//` and trailing `/`, is case-insensitive, and returns `ENOENT` or `ENOTDIR` without throwing.
  - `display('/projects')` is `~/projects`.
  - A project file's `render()` includes the write-up body when `writeups[slug]` exists, with Markdown headings rendered bold.
  - `resume.pdf` is `binary`.
- [X] T044 [P] [US2] Write `packages/shared/test/vfs-commands.test.ts` through `createShell`, using the exact messages in `contracts/commands.md`:
  - `pwd` at the root is `/`; `cd projects && pwd` is `/projects`, and `prompt().cwd` is `~/projects`.
  - `ls`; `ls -l`; `ls -a`; `ls projects experience` prints headers; `ls about.md` prints the name.
  - `cd` with no argument, `cd ~` and `cd /` go to the root; `cd nowhere` and `cd about.md` give errors and the cwd is unchanged; `cd a b` â†’ too many arguments.
  - `cat projects/<id>.md` equals the `projects <slug>` section plus the write-up; `cat` on a folder â†’ `Is a directory`; `cat missing.md` gives an error; `cat resume.pdf` gives the PDF notice; `cat` with no argument â†’ usage.
  - `tree` shows `â”œâ”€â”€`, `â””â”€â”€` and the `N directories, M files` footer.
  - `cat about.md | grep -i <word>` works.
  - Completion of `cat pro<Tab>` â†’ `projects/`, and `cd ~/exp<Tab>` â†’ `~/experience/` (folders only for `cd`).
- [X] T045 [P] [US2] Write `packages/shared/test/read-only.test.ts`. Cover:
  - `mkdir x`, `touch x`, `mv a b`, `cp a b`, `rmdir x`, `nano x`, `vim x`, `vi x`, `chmod x` and `rm about.md` â†’ `<cmd>: read-only file system â€” â€¦` with status `error`.
  - `rm`, `rm -rf /`, `rm -fr /`, `rm -rf /*` and `rm -rf ~` â†’ exactly the legacy `rmCommand()` output.
  - None of these appears in `help`, completion, suggestions or `man`.
- [X] T046 [P] [US2] Create `packages/shared/test/registry-coverage.test.ts` with its SC-006 part:
  - For the real `content`, every project, work entry and certificate is listed by `ls` in its folder, and `cat` on it returns non-empty output that contains its title.
  - Registry names and aliases are unique, lowercase and contain no whitespace.
- [X] T047 [P] [US2] Add a `describe('US2')` block to `apps/web/e2e/shell.spec.ts`. Cover:
  - `ls` shows the five root entries.
  - `cd projects` changes the visible prompt to `~/projects`, and `ls` lists `.md` files.
  - `cat <first>.md` shows the project title.
  - `cd nowhere` shows `no such file or directory`.
  - `tree` shows the footer.
  - After `page.reload()` the prompt is back to `~`.

### Implementation for User Story 2

- [X] T048 [P] [US2] Implement `packages/shared/src/vfs/path.ts` with `normalize(cwd, input)` â†’ an absolute `VfsPath` (`~` expansion, `.`, `..` clamped, repeated and trailing slash collapse) and `display(path)` (`/` â†’ `~`, `/x` â†’ `~/x`).
- [X] T049 [US2] Implement `packages/shared/src/vfs/build.ts` with `buildFileSystem(content)` per data-model "Virtual filesystem":
  - Node names come from `itemIds`.
  - `about.md` renders the `aboutCommand()` output.
  - Project, experience and certification files render the same `SectionOutput` their list command emits for that item (factor out per-item section builders in `packages/shared/src/commands/cv.ts` so both share them, keeping legacy output identical). Projects append `writeups[slug].body` as lines: `#` headings become bold `text`, and other lines become `text`.
  - `resume.pdf` is `binary: true` and exists only when `content.cv.available`.
  - `size` is computed from `toLines`.
  - `resolve()` returns `ENOENT` or `ENOTDIR`.
  - Memoize per `content` object, and export it from the vfs barrel.

  T043 should now pass. Depends on T048.
- [X] T050 [US2] Supply `fs` to every `CommandContext`: `createShell` in `packages/shared/src/shell/shell.ts` gets it lazily from `buildFileSystem(content)`, and the T008 placeholder in `engine.ts` is replaced.
- [X] T051 [US2] Implement `packages/shared/src/commands/fs.ts` with `pwd`, `cd`, `ls` (`-a`, `-l`, several paths), `cat` (several paths, binary notice) and `tree` (box drawing and footer), using the exact messages in `contracts/commands.md`. `cd` updates `ctx.session.cwd` only on success and returns status `error` on failure.

  Register all five in `packages/shared/src/commands/registry.ts`:
  - `description` and full `args`: positional `path` with `complete: 'path'`, and `'dir'` for `cd`.
  - `man` (description plus 2 or more examples each).
  - `menu` not set, so the menu bar stays unchanged.

  T044 should now pass. Depends on T049 and T050.
- [X] T052 [US2] Add the read-only stubs and legacy `rm` handling. In `packages/shared/src/commands/fs.ts`, add a `readOnlyCommand(name)` factory, and register `mkdir`, `touch`, `mv`, `cp`, `rmdir`, `nano`, `vim`, `vi` and `chmod` as `hidden: true`. In `packages/shared/src/commands/easter-eggs.ts`, `rmCommand(args)` returns the legacy output for no arguments or the legacy `-rf`/`-fr` forms targeting `/`, `/*` or `~`, and the read-only message otherwise. Update the registry to pass `ctx.args`. T045 should now pass.
- [X] T053 [US2] Implement the `path` and `dir` completion sources in `packages/shared/src/shell/completion.ts`: resolve the partial's directory part against `session.cwd`, list the children, append `/` to folders (with no trailing space after a folder), and keep a typed `~/` or `../` prefix. T044 completion cases should now pass.
- [X] T054 [US2] Update `apps/web/components/CommandLine.tsx` and `apps/web/components/Terminal.tsx` to re-read `shell.prompt()` after every `run`, so the prompt and window title show the current folder.
- [X] T055 [US2] Run `npm test`, `npm run typecheck` and `npm run test:e2e -- -g "US2"`, and go through every quickstart US2 row by hand. Then add a temporary project to `content/resume.yaml`, run `npm run content:generate`, and confirm it appears in `ls ~/projects`. Revert the temporary project afterwards.

**Checkpoint**: US1 and US2 both work on their own.

---

## Phase 5: User Story 3 â€” Discoverable extras (Priority: P3)

**Goal**: `man` pages for every visible command, `resume` (a web download, or a link on
text surfaces), a skippable `sudo hire-me` sequence ending in a pre-filled email link, and
an unchanged `whoami`. Easter eggs never block input.

**Independent Test**: Follow the quickstart "User Story 3" table. Run
`npm test -- man resume sudo-hire-me registry-coverage` and
`npm run test:e2e -- shell.spec.ts -g "US3"`.

### Tests for User Story 3 (write first, confirm they fail)

- [X] T056 [P] [US3] Write `packages/shared/test/man.test.ts`. Cover:
  - `man projects` has the sections NAME, SYNOPSIS, DESCRIPTION, EXAMPLES and ALIASES (with `proj`).
  - `man grep` has OPTIONS listing `-i`, `-v`, `-c` and `-h`.
  - `man exp` equals `man experience`; `man man` works.
  - `man` with no argument â†’ `What manual page do you want?` and `For example, try 'man projects'.`
  - `man sudo`, `man mkdir` and `man nope` â†’ `No manual entry for <name>`.
  - `man pro<Tab>` completes command names.
- [X] T057 [P] [US3] Write `packages/shared/test/resume.test.ts`:
  - On the `web` surface: the `download` effect url is `/cv/latest.pdf`, the filename is built from `basics.name` (for example `First-Last-CV.pdf`), and there is a confirmation line and a link.
  - On `curl` and `ssh` with origin `https://example.test`: output `Resume (PDF): https://example.test/cv/latest.pdf` and no `download`.
  - With `cv.available = false`, using a content fixture: `resume: CV not published yet` with status `error`.
  - The `cv` alias works.
  - `renderAnsi(..., { color: false })` for curl matches the quickstart example.
- [X] T058 [P] [US3] Write `packages/shared/test/sudo-hire-me.test.ts`:
  - `sudo hire-me` returns a `sequence` whose `delayMs` sum is â‰¤ 3500 and whose frames include the masked password line, three `progress` steps and `ACCESS GRANTED`.
  - The final `output` contains the owner's name, email, a LinkedIn link and a `mailto:` link whose `subject` decodes to `Hiring inquiry via example.test` (origin host) and whose body starts with `Hi <firstName>,`.
  - `sudo hire`, `sudo hire ahmed`-style (build the word from `profile.firstName.toLowerCase()`) and `sudo hire-x` give the same final output.
  - `sudo ls` keeps the permission-denied joke, and the hint is `Hint: try "sudo hire-me"`.
  - `sudo hire-me | wc -l` has no `sequence`.
  - `whoami` is unchanged against the T001 snapshot.
- [X] T059 [P] [US3] Add to `packages/shared/test/registry-coverage.test.ts` (the SC-005 part): every non-hidden registry entry has a non-empty `man.description` and at least one example, and `renderManPage` output for each is non-empty.
- [ ] T060 [P] [US3] Add a `describe('US3')` block to `apps/web/e2e/shell.spec.ts`. Cover:
  - `man projects` shows `SYNOPSIS`.
  - `resume` triggers `page.waitForEvent('download')` with a suggested filename ending in `-CV.pdf`.
  - `sudo hire-me` shows `ACCESS GRANTED`, then a `mailto:` link, within 5 s.
  - `sudo hire-me` followed immediately by Ctrl+C shows the contact details within 200 ms, and the input is focused and enabled.
  - `sudo hire-me` followed by typing `about` + Enter mid-animation: the sequence completes instantly, then the `about` output appears.
  - With `page.emulateMedia({ reducedMotion: 'reduce' })`, `sudo hire-me` renders the final output with no progress frames in the DOM.
  - `whoami` output is unchanged.

### Implementation for User Story 3

- [X] T061 [US3] Add `man` metadata (a `description` of 1â€“3 sentences and 1â€“3 `examples`) to every existing visible command in `packages/shared/src/commands/registry.ts`: help, about, education, experience, projects, skills, certifications, contact, open, timeline, theme, welcome, whoami, github, chat and clear. Build any owner-specific wording from `profile` or `cvData` inside a function, not from string literals, to keep `no-hardcoded-content` green.
- [X] T062 [US3] Implement `packages/shared/src/commands/man.ts`:
  - `renderManPage(def)`: sections as `SectionOutput`s titled `NAME` (`name â€” description`), `SYNOPSIS` (`renderSynopsis`), `DESCRIPTION`, `OPTIONS` (a table of flag and description, omitted if empty), `EXAMPLES` (a list) and `ALIASES` (omitted if empty).
  - `manCommand(ctx)`: resolve the name or alias; hidden or unknown names â†’ `No manual entry for <name>`; no argument gives the hint.

  Register `man` in `registry.ts` with `args` positional `command` (`complete: 'commands'`) and its own `man` metadata. Implement the `commands` completion source in `packages/shared/src/shell/completion.ts`. Export `renderManPage` from `packages/shared/src/index.ts`. T056 and T059 should now pass. Depends on T061.
- [X] T063 [P] [US3] Implement `packages/shared/src/commands/resume.ts` per research R10 and `contracts/commands.md`, reading `content.cv`, `ctx.surface` and `ctx.origin`. Register `resume` (alias `cv`, not in the menu) with `man`. T057 should now pass.
- [X] T064 [US3] Implement `sudo hire-me` in `packages/shared/src/commands/easter-eggs.ts`:
  - `sudoCommand(args, ctx)` routes any first argument starting with `hire` to `hireMeCommand(ctx)`, which returns the `sequence` frames and final `output` per `contracts/commands.md`. The `mailto:` is built with `encodeURIComponent`, and the host comes from `new URL(ctx.origin).host`, falling back to `site.title` when the origin is empty.
  - The permission-denied branch hint changes to `Hint: try "sudo hire-me"`.

  Update the `sudo` snapshot deliberately. T058 should now pass.
- [ ] T065 [P] [US3] Render `progress` in `apps/web/components/OutputRenderer.tsx` as a label plus a 20-cell `â–ˆ`/`â–‘` bar plus a percentage, wrapped in `role="progressbar"` with `aria-valuenow`, `aria-valuemin=0`, `aria-valuemax=100` and `aria-label={label}`.
- [ ] T066 [US3] Create `apps/web/components/SequencePlayer.tsx`:
  - Props: `steps`, `final`, `onDone`, and a `skipSignal` counter.
  - It plays the frames with `setTimeout`, showing only the current frame, then renders `final` through `OutputRenderer` and calls `onDone`.
  - If `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, it renders `final` immediately.
  - Timers are cleared on unmount and on skip.
- [ ] T067 [US3] Wire sequences and downloads into `apps/web/hooks/useTerminal.ts` and `apps/web/components/Terminal.tsx`:
  - A result with `sequence` becomes a history entry rendered by `SequencePlayer`.
  - Ctrl+C (`cancel()`) or a new `handleCommand` call while a sequence plays increments the skip signal first, so the final output is always shown before the next command's output.
  - The input is never disabled.
  - The `download` effect creates a temporary `<a href download=filename>`, clicks it and removes it. If that throws, it falls back to `window.open(url, '_blank', 'noopener,noreferrer')`.
- [ ] T068 [US3] Run `npm test`, `npm run typecheck` and `npm run test:e2e -- -g "US3"`, and go through every quickstart US3 row by hand, including the reduced-motion row in DevTools.

**Checkpoint**: All three stories work on their own and together.

---

## Phase 6: Polish & cross-cutting concerns

- [ ] T069 [P] Update `CLAUDE.md` "Command System" and "Web App Flow" sections:
  - `createShell`, the `shell/`, `vfs/` and `render/` folders, and the registry metadata (`kind`, `menu`, `args`, `man`, `surfaces`).
  - The effect fields and the `onUnknownCommand` hook.
  - The new web files (`SequencePlayer.tsx`, `useHistory.ts`).
  - Remove the note that the output union has "7 variants".
- [ ] T070 [P] Update `README.md` with a short "Try it" list of shell features: Tab, history, pipes, `ls`/`cd`/`cat`/`tree`, `man`, `resume`, and a hint that there are easter eggs.
- [ ] T071 [P] Check the bundle impact. Run `npm run build:web` and compare the First Load JS for `/` against `main` (Next build output). The shared engine should add â‰¤ 15 kB gzipped. Record the numbers in the PR description (Principle VII).
- [ ] T072 Accessibility pass on `apps/web/components/OutputRenderer.tsx`, `apps/web/components/CommandLine.tsx` and `apps/web/components/SequencePlayer.tsx`:
  - New output is inside the existing output region.
  - The candidate list and `^C` echoes are plain text.
  - The prompt label is associated with the input (`aria-label` includes the cwd).
  - Keyboard-only run-through of the quickstart succeeds.
- [ ] T073 Run the full gate: `npm run content:validate && npm run typecheck && npm test && npm run build:web && npm run test:e2e`. In the PR description, state the affected surfaces (web only; SSH and curl gain engine support without a host) and paste the final `legacy-output` snapshot diff summary. Only the documented exceptions may differ.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: T001 must land before any other code change. T002 is independent.
- **Foundational (Phase 2)**: depends on Setup and blocks every story. T003 comes first. T004/T005 can run in parallel, then T006/T007. T008 depends on T003. T009 depends on T006 and T008. T010 depends on T008.
- **US1 (Phase 3)**: depends on Foundational.
- **US2 (Phase 4)**: depends on Foundational and on US1's T028 (`createShell`) and T030 (the completion framework). It does not need the US1 web tasks, but the prompt update (T054) edits the files that T038 and T039 rewrote.
- **US3 (Phase 5)**: depends on Foundational and on US1's T024 (`renderSynopsis`), T028 and T030. It does not need US2. `man` for filesystem commands appears automatically once US2 lands, and T059 covers whatever is registered.
- **Polish (Phase 6)**: after the stories you intend to ship.

### Within each story

The tests are written first and fail. Then the pure shared modules, then the shell and
registry wiring, then the web integration, then the story's verification task.

### Parallel opportunities

- Phase 2: T004 âˆ¥ T005, then T006 âˆ¥ T007.
- US1 tests: T011â€“T021 all in parallel (separate files).
- US1 implementation: T022 âˆ¥ T024 âˆ¥ T025 âˆ¥ T027 âˆ¥ T031 âˆ¥ T032 âˆ¥ T034, then T023 and T026, then T028, then T029 âˆ¥ T030 âˆ¥ T033, and the web tasks T036 âˆ¥ T040 âˆ¥ T041, before T037, T038 and T039.
- US2 tests: T043â€“T047 in parallel. T048 runs in parallel with the tests.
- US3 tests: T056â€“T060 in parallel. T063 âˆ¥ T065 alongside T061 and T062.
- Once US1 is done, US2 and US3 can proceed in parallel. They touch `registry.ts` and `completion.ts` in separate entries and functions, so merge carefully.

## Parallel Example: User Story 1

```bash
# All US1 test files at once:
Task: "T011 shell-tokenizer.test.ts"   Task: "T012 shell-parser.test.ts"   Task: "T013 args.test.ts"
Task: "T014 suggest.test.ts"           Task: "T015 filters.test.ts"        Task: "T016 pipes.test.ts"
Task: "T017 unknown.test.ts"           Task: "T018 completion.test.ts"     Task: "T019 history.test.ts"
Task: "T020 ansi-render.test.ts"       Task: "T021 e2e shell.spec.ts US1"

# Independent pure modules:
Task: "T022 tokenizer.ts"  Task: "T024 args.ts"  Task: "T025 suggest.ts"  Task: "T027 unknown.ts"
Task: "T031 history.ts"    Task: "T032 github signal"  Task: "T034 render/ansi.ts"
```

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1: freeze the legacy output (T001). This is non-negotiable before refactoring.
2. Phase 2: the foundational types, registry shape, item ids and `toLines`.
3. Phase 3: US1. Stop and validate with the quickstart US1 table and the snapshot diff.
4. Open a PR and merge. Visitors get a real shell over the existing commands.

### Incremental delivery

1. US1 is the MVP: completion, history, keys, pipes and suggestions.
2. Add US2, the filesystem (`cd projects && ls`). Open a PR and merge.
3. Add US3, the extras (`man`, `resume`, `sudo hire-me`). Open a PR and merge.
4. Polish. Spec 003 then plugs SSH and curl into `createShell` and `renderAnsi`, and
   Spec 004 swaps in the AI through `onUnknownCommand`.

## Notes

- The [P] marker means different files with no unfinished dependency. Tasks that touch
  `registry.ts` or `completion.ts` are sequential within a story.
- Every snapshot update to `legacy-output` must be one of the documented exceptions, and
  each is called out in the task that causes it (T029, T033, T052, T064).
- Commit after each task or logical group. Stop at any checkpoint to validate the story
  on its own.
