# Contract: New and Changed Commands

This is the user-facing behavior. Messages are exact unless marked *(example)*. In the
synopsis column, `<x>` means required and `[x]` means optional.

## Filters (only valid after `|`)

| Command | Synopsis | Behavior |
|---|---|---|
| `grep` | `grep [-i] [-v] [-c] [-h] <pattern>` | Literal substring match on each line. `-i` ignores case, `-v` inverts the match, `-c` prints the count, `-h` hides the `item: ` prefix. No match gives empty output and status `error`. A missing pattern prints `usage: grep [-i] [-v] [-c] [-h] <pattern>` |
| `head` | `head [-n N]` | First N lines (default 10). `-N` also works. N must be an integer ≥ 0, otherwise `head: invalid number of lines: 'x'` |
| `tail` | `tail [-n N]` | Last N lines. Same rules as `head` |
| `wc` | `wc [-l] [-w] [-c]` | Counts lines, words and characters, in the order `l w c`, right-aligned in 7-character columns like GNU `wc`. With no flag, all three |
| `sort` | `sort [-r] [-u]` | Code-point order. `-r` reverses, `-u` removes duplicates. Styles travel with their lines |

The input to a filter is the unprefixed `Line.text`. A `grep` match on a line that has an
`item` prints `<item>: <text>`, with the item dimmed on the web.

## Filesystem

| Command | Synopsis | Behavior |
|---|---|---|
| `pwd` | `pwd` | Prints `/` or `/projects` and so on |
| `cd` | `cd [path]` | No argument, `~` or `/` goes to the root. Errors: `cd: no such file or directory: <p>` and `cd: not a directory: <p>`. More than one argument gives `cd: too many arguments` |
| `ls` | `ls [-a] [-l] [path…]` | Folders first, then files, alphabetical. Folders end with `/` and are styled `primary`. `-l` prints `d`/`-`, size and name. `-a` adds `./` and `../`. With several paths, each gets a `path:` header. Errors: `ls: cannot access '<p>': No such file or directory` |
| `cat` | `cat <path…>` | Prints the file's structured output. Several files are concatenated. `cat` on a folder gives `cat: <p>: Is a directory`, and on a missing file `cat: <p>: No such file or directory`. `cat resume.pdf` prints `resume.pdf: PDF document — run 'resume' to download it`. No argument gives `usage: cat <path…>` |
| `tree` | `tree [path]` | Draws the tree with `├──`, `└──` and `│`, then prints `N directories, M files` |

Every path argument completes from the VFS. `cd` completes folders only.

### Write attempts (read-only)

`mkdir`, `touch`, `mv`, `cp`, `rmdir`, `nano`, `vim`, `vi` and `chmod`, plus `rm` with any
argument other than the legacy forms, print this *(example)*:

```
<cmd>: read-only file system — this portfolio is look-but-don't-touch 🙂
```

The status is `error`. These commands are hidden: they don't appear in `help`, `man` or
completion.

Legacy `rm` forms keep their current easter-egg output exactly:

- no argument
- `-rf /` or `-fr /` or `-rf /*` or `-rf ~` in any order of the `r` and `f` flags

## Extras

| Command | Synopsis | Behavior |
|---|---|---|
| `man` | `man <command>` | Manual page (NAME, SYNOPSIS, DESCRIPTION, OPTIONS, EXAMPLES, ALIASES). An alias resolves to the canonical page. No argument prints `What manual page do you want?` and `For example, try 'man projects'.` Unknown or hidden names print `No manual entry for <name>` |
| `resume` | `resume` | **web**: returns a `download` effect for `/cv/latest.pdf` as `<First>-<Last>-CV.pdf` and prints `Downloading resume… ` plus a link. **ssh/curl**: prints `Resume (PDF): <origin>/cv/latest.pdf`. When the CV is unavailable: `resume: CV not published yet` with status `error`. Aliases: `cv` |
| `sudo hire-me` | `sudo hire-me` | Frames: `[sudo] password for visitor: ********`, then `verifying credentials` 0→100%, `checking coffee supply` 0→100%, `granting access` 0→100%, then `ACCESS GRANTED`. Total ≤ 3.5 s. The final output (always shown, even when skipped) is `Welcome aboard. Here's how to reach <First>:`, the name, email, a LinkedIn link, and the link `Send an email` (`mailto:<email>?subject=<enc(Hiring inquiry via <host>)>&body=<enc(Hi <First>,\n\n…)>`). `sudo hire`, `sudo hire <anything>` and `sudo hire-<anything>` give the same result |
| `sudo <other>` | | Current output, with the hint changed to `Hint: try "sudo hire-me"` |
| `whoami` | | Unchanged |

`sudo`, `rm` and the write commands stay hidden. `man`, `resume`, the filesystem commands
and the filters are visible, so they appear in `help` and completion. `resume` and `man`
are not added to the menu bar, which keeps the menu bar unchanged (FR-011).

## Changed messages

| Situation | Before | After |
|---|---|---|
| Unknown single word, close to a command | `Command not found: "projcts". Type "help" for available commands.` | `command not found: projcts` · ``did you mean `projects`?`` · ``Type `help` for commands or `chat` to ask the AI.`` |
| Unknown input, no suggestion | same as above | `command not found: <word>` · ``Type `help` for commands or `chat` to ask the AI.`` |
| `help` | lists existing commands | also lists `ls`, `cd`, `pwd`, `cat`, `tree`, `man`, `resume`, and a "Pipes: grep, head, tail, wc, sort" row. The tip line changes to `Tip: Tab completes, ↑/↓ browse history, pipes work: projects \| grep rag` |
| Prompt | `$` | `visitor@portfolio:~/projects$` (the path changes with `cd`) |
