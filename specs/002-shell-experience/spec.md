# Feature Specification: Shell Experience

**Feature Branch**: `003-shell-experience`  
**Created**: 2026-09-27  
**Status**: Draft  
**Input**: User description: "Visitors use the terminal like a real shell with discoverable, playful extras. User Story 1 (P1) — Real shell behavior: tab autocomplete for commands and arguments, up/down history, Ctrl+C to cancel, Ctrl+L to clear, quoted arguments and flags, and pipes into grep, head, tail, wc and sort. All existing commands, aliases, menu mode and themes keep working. Unknown commands print a helpful message and suggest the closest command; unknown input can later be handed to the AI assistant through a pluggable hook. User Story 2 (P2) — Browsable filesystem: ls, cd, pwd, cat and tree work over folders for projects, experience and certifications, with about.md and resume.pdf at the root. User Story 3 (P3) — Extras: man pages for every command; resume (web downloads the PDF, SSH and curl print the link); sudo hire-me (a playful sequence ending with contact details and a pre-filled email link); whoami stays. Easter eggs never block normal use."

## Clarifications

### Session 2026-09-27

- Q: What does `grep` match against when a command's output groups several lines per item? → A: Line-based matching. When a matching line belongs to an item (project, role, certification, skill category), it is prefixed with that item's identifier (like `grep -H` labels matches with the file name). Items are not kept whole. `head`, `tail`, `sort` and `wc` also work on lines.
- Q: How is each project, experience role and certification represented in the filesystem? → A: As one Markdown file per item: `projects/<slug>.md`, `experience/<company>-<role>.md`, `certifications/<name>.md`. There are no per-item folders.
- Q: How close must a mistyped command be to get a "did you mean" suggestion? → A: Within 1 edit for command names of 4 characters or fewer, and within 2 edits for longer names. Suggestions apply only to single-word input. Multi-word input never gets a suggestion and goes straight to the unknown-input handler.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Real shell behavior (Priority: P1)

A visitor who is used to a real terminal types into the portfolio and it behaves the way their fingers expect. Tab completes command names and their arguments (project names, experience entries, skill categories, theme names, and later file paths). Up and Down walk through previous commands. Ctrl+C abandons the current line or stops output that is still printing. Ctrl+L clears the screen. Arguments can be quoted (`projects "rag pipeline"`) and flags are understood (`experience --help`). Output from any command can be piped through `grep`, `head`, `tail`, `wc` and `sort`, and pipes can be chained (`skills | grep -i python | sort`). If the visitor mistypes a command, they are told it was not found and are offered the closest real command ("did you mean `projects`?"). Everything that works today, including every command and alias, menu mode, themes and AI chat, keeps working unchanged.

**Why this priority**: This is the foundation the other stories build on. The filesystem commands and the extras depend on the parser, pipes and completion. It is also the change a technical visitor notices first: a terminal that doesn't behave like one feels like a gimmick.

**Independent Test**: Open the web terminal and, using only the existing commands, verify tab completion, history, Ctrl+C, Ctrl+L, quoted arguments, each pipe filter and the typo suggestion. Then run the full existing command list and confirm the output is unchanged.

**Acceptance Scenarios**:

1. **Given** an empty prompt, **When** the visitor types `pro` and presses Tab, **Then** the line completes to `projects `.
2. **Given** a prefix that matches several commands, **When** the visitor presses Tab twice, **Then** all matching candidates are listed below the prompt and the typed line is kept.
3. **Given** the visitor has typed `projects ` followed by the first letters of a project name, **When** they press Tab, **Then** the project name is completed (quoted if it contains spaces).
4. **Given** the visitor has run three commands, **When** they press Up three times and then Down once, **Then** the prompt shows the second-most-recent command. Pressing Down past the newest entry restores whatever they had typed before browsing.
5. **Given** a partially typed line, **When** the visitor presses Ctrl+C, **Then** the line is abandoned, echoed with a `^C` marker, and a fresh prompt appears.
6. **Given** a command whose output is still streaming or printing, **When** the visitor presses Ctrl+C, **Then** the output stops and the prompt returns.
7. **Given** a screen full of output, **When** the visitor presses Ctrl+L, **Then** the screen clears, the current line is kept, and command history is preserved.
8. **Given** the command `projects "multi word name"`, **When** it runs, **Then** the command receives `multi word name` as a single argument.
9. **Given** `skills | grep -i python`, **When** it runs, **Then** only the lines of skills output that contain "python" (case-insensitive) are shown. Each line is prefixed with its skill category.
9a. **Given** `projects | grep rag`, **When** it runs, **Then** each matching line is shown with the project it belongs to as a prefix (for example `rag-pipeline: Stack: …, RAG`), so the visitor can tell which projects matched.
10. **Given** `projects | head -n 3`, `projects | tail -n 2`, `projects | wc -l` and `skills | sort`, **When** each runs, **Then** each shows the first 3 lines, the last 2 lines, the line count, and the lines in sorted order respectively.
11. **Given** a chained pipe `experience | grep -i data | wc -l`, **When** it runs, **Then** the filters apply left to right.
12. **Given** the unknown command `projcts`, **When** it runs, **Then** the terminal reports that the command was not found and suggests `projects`.
13. **Given** unknown input that is not close to any command, or that has more than one word (for example `who are you`), **When** it runs, **Then** it is passed to the unknown-input handler. By default that handler prints the not-found message and a pointer to `help` and `chat`. A later feature can swap in a handler that sends the input to the AI assistant, with no change to the command system.
14. **Given** any command or alias that exists today (for example `exp`, `certs`, `theme dracula`, `chat`), **When** it runs, **Then** its behavior and output match the current release.
15. **Given** menu mode or the mobile command buttons, **When** the visitor selects an item, **Then** it runs exactly as it does today.

---

### User Story 2 - Browsable filesystem (Priority: P2)

A visitor can explore the portfolio as a folder tree. `ls` at the root shows `about.md`, `resume.pdf` and folders for `projects/`, `experience/` and `certifications/`. `cd projects` moves into that folder and the prompt shows the new location. `ls` lists one entry per project, `cat` on an entry prints that project's write-up, `pwd` shows the current path, and `tree` shows the whole structure at a glance. Paths work the usual way: relative, absolute, `..`, `~` and `/`. Tab completion covers file and folder names. The filesystem works together with pipes (`cat about.md | grep -i python`).

**Why this priority**: It is the most recognizable "this is a real shell" moment and a natural way to browse content. It depends on the parser and completion from Story 1, but it adds no new content.

**Independent Test**: Run `tree`, `cd projects && ls`, `cat <project>`, `cd ..`, `pwd`, `cat about.md` and `cat resume.pdf`, and confirm each shows the right content and each bad path gives a clear error.

**Acceptance Scenarios**:

1. **Given** the visitor is at the root (`~`), **When** they run `ls`, **Then** they see `about.md`, `resume.pdf`, `projects/`, `experience/` and `certifications/`, with folders visually distinct from files.
2. **Given** the root, **When** the visitor runs `cd projects` then `ls`, **Then** the prompt shows `~/projects` and there is one entry per project in the portfolio content.
3. **Given** the visitor is in `~/projects`, **When** they run `cat` on a project entry, **Then** they see that project's details and, where one exists, its full write-up.
4. **Given** any location, **When** the visitor runs `cat ~/experience/<entry>`, **Then** they see that role's details (company, title, dates, highlights).
5. **Given** any location, **When** the visitor runs `pwd`, **Then** the absolute path of the current folder is printed.
6. **Given** any location, **When** the visitor runs `tree` (or `tree <folder>`), **Then** they see an indented tree of every folder and file under that point.
7. **Given** `cd nowhere`, `cat missing.md` or `cd about.md`, **When** each runs, **Then** each prints a short error in the familiar shell form ("No such file or directory" / "Not a directory") and the current location does not change.
8. **Given** `cat resume.pdf`, **When** it runs, **Then** the terminal does not dump binary content. It explains that this is a PDF and points to the `resume` command or offers the download.
9. **Given** `cd` with no argument, `cd ~` or `cd /`, **When** each runs, **Then** the visitor returns to the root.
10. **Given** `cat about.md | grep -i data`, **When** it runs, **Then** only matching lines of the about text are shown.
11. **Given** the portfolio content is updated (a new project is added), **When** the site is rebuilt, **Then** the new project appears in `ls projects` without any hand edits to the filesystem.

---

### User Story 3 - Discoverable extras (Priority: P3)

Visitors who poke around are rewarded. `man <command>` shows a proper manual page (name, synopsis, description, options, examples, aliases) for every command, including the new shell and filesystem commands. `resume` gets them the CV: on the web the PDF downloads, and on text-only surfaces (SSH, curl) the command prints a direct link. `sudo hire-me` plays a short, playful fake "privilege escalation" sequence that ends with contact details and a ready-to-send email link with the subject and a greeting already filled in. `whoami` keeps working. None of the easter eggs can trap the visitor or stop them from typing the next command.

**Why this priority**: It adds delight and helps recruiters convert, but the portfolio is fully usable without it. `man` and `resume` also depend on the command metadata and filesystem from Stories 1 and 2.

**Independent Test**: Run `man projects`, `man ls`, `man man`, `resume`, `sudo hire-me` and `whoami` on the web. Press Ctrl+C and type a new command during the `sudo hire-me` sequence. Check that each output is correct and that input is never blocked.

**Acceptance Scenarios**:

1. **Given** any command listed in `help`, plus the shell and filesystem commands, **When** the visitor runs `man <command>`, **Then** a manual page with name, synopsis, description, options (if any), examples and aliases is shown.
2. **Given** an alias such as `man exp`, **When** it runs, **Then** the manual page for `experience` is shown.
3. **Given** `man` on an unknown or hidden command, **When** it runs, **Then** it prints "No manual entry for <name>". Hidden easter eggs are not revealed.
4. **Given** `man` with no argument, **When** it runs, **Then** it prints a short usage hint ("What manual page do you want?" plus an example).
5. **Given** the web terminal, **When** the visitor runs `resume`, **Then** the current CV PDF downloads (or opens in a new tab if the browser blocks the download) and a confirmation line with the link is printed.
6. **Given** a text-only surface (SSH or curl), **When** `resume` runs, **Then** a direct, absolute link to the current CV PDF is printed and nothing else is attempted.
7. **Given** `sudo hire-me`, **When** it runs, **Then** a short playful sequence (fake password prompt, progress steps, "access granted") plays in 5 seconds or less. It ends with the name, email, LinkedIn and a pre-filled email link (subject and opening line already written).
8. **Given** the `sudo hire-me` sequence is playing, **When** the visitor presses Ctrl+C or starts typing, **Then** the sequence ends at once, the contact details are still printed, and the prompt is usable.
9. **Given** the existing `sudo hire ahmed` phrasing and plain `sudo <anything>`, **When** they run, **Then** `sudo hire ...` gives the same hire-me result and other `sudo` input keeps its current "permission denied" joke, with a hint that points to `sudo hire-me`.
10. **Given** `whoami`, **When** it runs, **Then** it behaves as it does today.
11. **Given** reduced-motion preferences, **When** any animated extra runs, **Then** it shows its final output at once with no animation.

---

### Edge Cases

- Unbalanced quotes (`projects "rag`): the command does not run. A short parse error explains the unmatched quote.
- Empty pipe segments (`projects |`, `| grep x`, `projects || wc`): a clear syntax error; nothing runs.
- Piping into something that isn't a filter (`projects | about`): an error says which commands can receive piped input.
- Piping output that has no text lines (for example `theme dracula | wc -l`, or a link-only result): filters work on the text form of the output. Commands whose effect isn't text (theme change, clear, chat mode, opening a URL) still take effect only when they are not piped. If piped, their side effects are suppressed and only the text is filtered.
- `grep` with no pattern, or invalid numbers for `head -n`/`tail -n`: a usage message; nothing crashes.
- Very long history: only the most recent 100 entries are kept; consecutive duplicates are stored once; blank lines are never stored.
- History and current location across page reloads: history persists in the visitor's browser. The current folder resets to `~` on reload.
- Tab with no matches: nothing changes (optionally a subtle bell or no-op). Tab on an empty line lists visible commands only, never hidden easter eggs.
- Commands that take a second or more (for example `github` fetching live data) can be cancelled with Ctrl+C and do not print late output after cancellation.
- Ctrl+C while in AI chat mode keeps its current meaning: cancel the in-flight answer, or leave chat. It does not break the chat flow.
- Case: command names are case-insensitive as today. File and folder names match case-insensitively so mobile auto-capitalization doesn't cause failures.
- Project or company names with spaces, slashes or special characters get safe, predictable file names that are still readable.
- A `cd` into a file, `cat` on a folder, or `ls` on a file behave the way a Unix shell does (error, error, and prints the file name respectively).
- Mobile: touch visitors without a Tab key or Ctrl can still use the mobile command buttons and menu mode, and nothing in this feature removes them.
- The `rm -rf /` alias and other existing easter eggs keep working and are not confused with filesystem commands. The filesystem is read-only, so any write attempt (`rm`, `mkdir`, `touch`, `mv`) gets a playful "read-only" refusal.

## Requirements *(mandatory)*

### Functional Requirements

**Shell behavior (Story 1)**

- **FR-001**: The terminal MUST complete command names and aliases on Tab when the prefix is unique, and list all candidates on a second Tab when it is ambiguous.
- **FR-002**: The terminal MUST complete arguments on Tab for commands that take a known set of values: project names, experience entries, skill categories, theme names, `open` targets, `man` topics, and file/folder paths once Story 2 is present.
- **FR-003**: Hidden (easter-egg) commands MUST NOT appear in completion candidates or in `help`.
- **FR-004**: The terminal MUST keep a command history navigable with Up/Down. It holds at most 100 entries, skips blanks and consecutive duplicates, persists across reloads in the same browser, and restores the in-progress line when the visitor navigates past the newest entry.
- **FR-005**: Ctrl+C MUST abandon the current input line and show a `^C` marker, and MUST stop any running or animating command without printing its late output.
- **FR-006**: Ctrl+L MUST clear the visible output without clearing history or the current input line.
- **FR-007**: The input parser MUST support single- and double-quoted arguments, backslash-escaped characters, short and long flags (`-n 3`, `--help`), and report unbalanced quotes as a parse error.
- **FR-008**: The terminal MUST support pipes (`|`), including chained pipes, whose right-hand side is one of these filters:
  - `grep <pattern>` with at least `-i` (ignore case), `-v` (invert) and `-c` (count)
  - `head [-n N]` and `tail [-n N]`, default 10
  - `wc` with at least `-l`, `-w`, `-c`; with no flag it prints lines, words and characters
  - `sort` with at least `-r` (reverse) and `-u` (unique)
- **FR-009**: Filters MUST work on the plain-text lines of the upstream command's output, and the filtered result MUST keep the current theme's styling where possible.
- **FR-009a**: Every output line that belongs to an item (project, experience role, certification, skill category) MUST carry that item's identifier. For projects, roles and certifications this is the filesystem file name without `.md`; for skill categories it is the lowercase, hyphenated category name. `grep` MUST prefix each matching line with that identifier (`<item>: <line>`). Lines that belong to no item (headers, dividers) are printed without a prefix. `grep -h` MUST turn the prefix off. `head`, `tail`, `sort` and `wc` work on unprefixed lines.
- **FR-010**: Every command and alias that exists at the start of this feature MUST keep its name, arguments and output. The only exception is `sudo`, which is extended as FR-024 describes.
- **FR-011**: Menu mode, mobile command buttons, theme switching and AI chat mode MUST keep working unchanged.
- **FR-012**: When the unknown input is a single word, the terminal MUST suggest the closest visible command or alias in its not-found message. A suggestion is made only if the word is within 1 edit (insert, delete, substitute or swap two adjacent letters) of a candidate name of 4 characters or fewer, or within 2 edits of a longer name. If two candidates are equally close, the visible command that comes first in `help` order wins. Hidden commands are never suggested. Multi-word input never gets a suggestion.
- **FR-013**: All unknown input MUST go through one replaceable unknown-input handler. The default handler prints the not-found message (with a suggestion when FR-012 applies) and mentions `help` and `chat`. A later feature MUST be able to replace the handler, for example to send the input to the AI assistant, without changes to the parser or other commands.
- **FR-014**: `help` MUST list the new shell, filesystem and extra commands alongside the existing ones.

**Filesystem (Story 2)**

- **FR-015**: The portfolio MUST expose a read-only virtual filesystem whose root (`~`, also `/`) contains `about.md`, `resume.pdf`, `projects/`, `experience/` and `certifications/`.
- **FR-016**: The filesystem MUST be generated from the portfolio content, with exactly one Markdown file per item and no per-item folders: `projects/<slug>.md` (the project's existing content slug), `experience/<company>-<role>.md` and `certifications/<name>.md`. Names are lowercase and hyphenated. If two items would get the same name, the later one gets a numeric suffix (`-2`) so every name is unique and stays the same between builds. Content changes MUST show up without manual filesystem edits.
- **FR-017**: `ls [path]`, `cd [path]`, `pwd`, `cat <path>` and `tree [path]` MUST behave like their Unix counterparts over this filesystem. They support relative paths, absolute paths, `.`, `..` and `~`.
- **FR-018**: The prompt MUST show the current location (for example `visitor@moghazy:~/projects$`).
- **FR-019**: `cat` on a project MUST show that project's details plus its full write-up when one exists. `cat` on `about.md` MUST show the professional summary.
- **FR-020**: `cat resume.pdf` MUST NOT print binary content. It MUST point the visitor to `resume` or the download link instead.
- **FR-021**: Path errors MUST use familiar shell wording ("No such file or directory", "Not a directory", "Is a directory") and leave the current location unchanged.
- **FR-022**: Write-style commands (`rm`, `mkdir`, `touch`, `mv`, `cp`, and similar) MUST respond with a playful read-only refusal. The existing `rm -rf /` easter egg MUST keep its current response.

**Extras (Story 3)**

- **FR-023**: `man <command>` MUST show a manual page for every visible command, including shell, filesystem and filter commands. Each page has name, synopsis, description, options, examples and aliases, and is produced from the same metadata that drives `help` and completion so it cannot drift. Aliases resolve to their command's page. Hidden commands and unknown names give "No manual entry for <name>".
- **FR-024**: `sudo hire-me` MUST play a short playful sequence, 5 seconds or less, that ends with the owner's name, email, LinkedIn and a pre-filled email link (subject and opening line). `sudo hire ...` MUST give the same result. Any other `sudo` input keeps its current joke, with a hint updated to `sudo hire-me`.
- **FR-025**: `resume` MUST download the current CV PDF on the web, falling back to opening it if the download is blocked, and print a confirmation with the link. On text-only surfaces it MUST print an absolute link to the current CV.
- **FR-026**: `whoami` and every existing easter egg (`hello`, `neofetch`, `exit`, `rm -rf /`) MUST keep working.
- **FR-027**: No easter egg or animated sequence may block input. Ctrl+C or typing a new command MUST end it at once, and its essential final output (for example contact details) MUST still be shown.
- **FR-028**: Animated sequences MUST respect the visitor's reduced-motion preference by showing their final output at once.

**Cross-surface**

- **FR-029**: Parsing, pipes, the filesystem, `man` content and unknown-input handling MUST be defined once and behave the same on every surface: web now, SSH and curl later. Only key handling (Tab, Up/Down, Ctrl+C, Ctrl+L) and how the CV is delivered may differ by surface.

### Key Entities

- **Command**: A named capability visitors can run. It has a name, aliases, a short description, usage/synopsis, options, examples, a visible or hidden flag, the surfaces it supports, and an argument completer. It is the single source for `help`, `man`, completion and menu items.
- **Pipeline**: A parsed input line: one producing command followed by zero or more filter stages, each with its own arguments and flags.
- **Filter**: A text-processing command (`grep`, `head`, `tail`, `wc`, `sort`) that can only receive piped input and turns lines into lines.
- **Filesystem node**: A folder or file in the read-only portfolio tree. It has a name, path, kind (folder/file) and, for files, the content it shows. Each project, role or certification is a single `.md` file. That file's name (without `.md`) is also the item identifier used as the `grep` prefix. It comes from the portfolio content (projects, experience, certifications, about, resume).
- **Shell session**: One visitor's state: the current folder, command history, the active mode (command, menu or chat) and any running command that Ctrl+C can cancel.
- **Unknown-input handler**: A replaceable behavior that receives input matching no command, along with the closest suggestion if there is one, and decides what to show.
- **Manual page**: The formatted manual for a command, derived from that command's metadata.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the commands and aliases available before this feature give the same output after it. This is verified by automatically comparing each command's output before and after.
- **SC-002**: The four headline flows all work on the web without errors: `projects | grep rag`, `cd projects && ls` (or `cd projects` followed by `ls`), `man projects` and `sudo hire-me`.
- **SC-003**: Every single-word typo within the FR-012 limits (1 edit for names of 4 characters or fewer, 2 edits for longer names) gets a suggestion of the intended visible command. No multi-word input ever gets a suggestion.
- **SC-004**: Tab completion, history navigation, Ctrl+C and Ctrl+L respond with no perceptible delay (the visitor sees the result within 100 ms of the keypress).
- **SC-005**: Every visible command has a `man` page. None is missing and none is blank.
- **SC-006**: Every project, experience role and certification in the portfolio content can be reached through `ls`, and `cat` shows its content. An automated check covers 100% of entries.
- **SC-007**: No easter egg or animated sequence stops the visitor from running another command for more than 5 seconds, and all of them can be interrupted at once.
- **SC-008**: A visitor who has used a Unix shell can find and open a project write-up using only `ls`, `cd` and `cat`, without reading `help`, on the first try.
- **SC-009**: Swapping the unknown-input handler for a different one needs no changes to any existing command or to the parser.

## Assumptions

- This spec builds on the completed Content pipeline spec (001). All portfolio content, including project write-ups and the CV PDF, comes from the content files, and the filesystem is generated from them.
- The web terminal is the only live surface today. SSH and curl surfaces come in a later spec. This feature guarantees the shared behavior they will reuse, but it does not build those surfaces. On the web, `resume` behavior is fully testable. The text-only behavior is verified at the shared-command level.
- Some shell conveniences already exist on the web (basic history, Tab completion of command names, Ctrl+L). This feature brings them up to the behavior described here rather than adding them from scratch.
- The `&&` operator is supported only as far as needed for the documented `cd projects && ls` flow (run the second command if the first succeeded). General shell scripting (`;`, `||`, redirection `>`, variables, globbing, subshells) is out of scope.
- Filters work on text lines. Tables become one line per row, and lists become one line per item.
- History is stored only in the visitor's own browser; nothing is sent to a server.
- The pre-filled email uses the contact email from the portfolio content, with a friendly default subject such as "Hiring inquiry via moghazy.me".
- The current `sudo hire ahmed` result is kept as an alias of `sudo hire-me`, so no existing behavior is lost.
- Accessibility: all new output stays readable by screen readers the same way current output is. Animations respect reduced-motion (in line with the project's accessibility principle).
