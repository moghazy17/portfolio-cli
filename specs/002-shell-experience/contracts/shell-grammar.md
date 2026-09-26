# Contract: Shell Input Grammar

The input language accepted by `shell.run(line)` on every surface. The implementation is
`packages/shared/src/shell/tokenizer.ts` and `parser.ts`.

## Processing order

1. **Trim.** An empty line returns `{ output: [] }`, and nothing is added to history.
   The web UI adds to history, not the shell.
2. **Length check.** A line over 1,000 characters is rejected with
   `error: input too long (max 1000 characters)` and status `error`.
3. **First-word route.** Split off the first run of non-whitespace characters and
   lowercase it.
   - If it is not a registered name, alias or filter (hidden commands count), call
     `onUnknownCommand({ raw, word, suggestion? })`. Stop here; the line is never
     tokenized.
   - `suggestion` is present only if the line has exactly one word and the word is within
     the FR-012 limits of a visible command.
4. **Tokenize, then parse** (below). A parse error prints its message and sets status
   `error`. Nothing runs.
5. **Execute** the chain (see [engine-api.md](./engine-api.md)).

## Grammar

```
line      := chain
chain     := pipeline ( AND pipeline )*
pipeline  := stage ( PIPE stage )*          -- max 8 stages
stage     := WORD+                           -- first WORD is the command name (case-insensitive)
AND       := '&&'
PIPE      := '|'
WORD      := ( BARE | SQUOTED | DQUOTED | ESCAPE )+   -- adjacent pieces concatenate: a"b c"d → ab cd
BARE      := [^\s'"\\|&;<>`$]+ | '$' (not followed by '(')
SQUOTED   := "'" [^']* "'"                  -- fully literal
DQUOTED   := '"' ( [^"\\] | '\\' ["\\] | '\\' . )* '"'   -- \" and \\ unescape; other \x kept as \x
ESCAPE    := '\\' .                          -- outside quotes: next char literal
```

- Whitespace is space or tab. Newlines never occur, because the input is a single line.
- `*` and `?` are ordinary characters, since there is no globbing. `~` is ordinary for
  the tokenizer; path resolution expands it later.
- Command names are matched case-insensitively. Arguments keep their case, and each
  command decides whether it matches case-insensitively. All content filters and VFS
  paths do.

## Rejected operators

| Input | Message (status `error`) |
|---|---|
| `a \|\| b` | `syntax error: '\|\|' is not supported — use '&&' to run commands in sequence` |
| `a ; b` | `syntax error: ';' is not supported — use '&&' to run commands in sequence` |
| `a > f`, `a >> f`, `a < f` | `syntax error: redirection is not supported — the filesystem is read-only` |
| `a & ` | `syntax error: background jobs are not supported` |
| `` `x` ``, `$(x)` | `syntax error: command substitution is not supported` |
| `a \| ` or `\| b` or `a \| \| b` | `syntax error: missing command around '\|'` |
| `a && ` or `&& b` | `syntax error: missing command around '&&'` |
| `projects "rag` | `syntax error: unterminated " quote` |
| `projects 'rag` | `syntax error: unterminated ' quote` |

These operators are recognized only when they are outside quotes. `grep "a|b"` is a
literal pattern.

## Flags

Flags are parsed per command against its `ArgSpec`, after tokenizing:

- `-n 3`, `-n3` and `--lines=3` / `--lines 3` are equivalent when the flag takes a value.
- Short boolean flags can be grouped: `-iv` means `-i -v`.
- `--` ends flag parsing, so later tokens are positional (`grep -- -v` searches for `-v`).
- `head` and `tail` also accept `-N` as shorthand for `-n N`.
- An unknown flag prints `<cmd>: unknown option '<flag>'` followed by
  `usage: <synopsis>`, with status `error`.
- `--help` is accepted by every non-hidden command. It prints `usage: <synopsis>` and
  `See 'man <cmd>' for details.`
- Legacy commands that ignore flags receive every token they got before as positional
  arguments, except `--help`. `experience --help` is the only behavior change.

## Examples

| Input | Parsed |
|---|---|
| `projects "rag pipeline"` | 1 pipeline, 1 stage: `projects` with args `["rag pipeline"]` |
| `skills \| grep -i python \| sort` | 1 pipeline, stages `skills`, `grep -i python`, `sort` |
| `cd projects && ls` | 2 pipelines: `cd projects` and `ls` |
| `grep x` | error: `grep: expects piped input` |
| `projects \| about` | error: `about: cannot receive piped input (try grep, head, tail, wc, sort)` |
| `what's his stack?` | not tokenized. Goes to `onUnknownCommand` (first word `what's` is unknown) |
| `rm -rf /` | stage `rm` with args `["-rf", "/"]`; `rm` keeps the legacy easter egg for this form |
