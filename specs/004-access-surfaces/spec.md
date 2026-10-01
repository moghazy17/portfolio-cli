# Feature Specification: Access Surfaces (Deep Links, curl; SSH deferred)

**Feature Branch**: `004-access-surfaces`  
**Created**: 2026-10-01  
**Status**: Draft — US1 and US2 in scope; US3 (SSH) deferred to a later spec  
**Input**: User description: "The portfolio is reachable in three ways, all showing the same content. US1 (P1) shareable deep links that run a command and keep the address bar in sync, but never act on the visitor's behalf; US2 (P2) curl returns colored, readable text for any command with a no-color option and never reaches the AI assistant; US3 (P1) `ssh term.moghazy.me` gives the full interactive terminal with no credentials, adapts to resizes, stays current without redeploying, and contains abuse with idle/maximum session limits, concurrency caps and per-visitor AI allowance."

## Clarifications

### Session 2026-10-01

- Q: Should browsers and curl share one link format (command paths plus a full-command-line query parameter), or differ? → A: One shared format. Browsers and curl both accept command paths (`/projects`, `/skills/llm`) and a query parameter for full command lines; the address bar uses the path form when the command can be written that way, otherwise the query form.
- Q: What happens with a non-interactive SSH command (`ssh term.moghazy.me projects`)? → A: Run it once, print curl-style output (colored with a terminal, plain without), then close; unknown input gets "not found" and never reaches the AI; it counts toward the session caps.
- Q: Should questions typed for the AI assistant be written to the address bar? → A: No. The address bar keeps showing the last command; links carrying a question are still accepted and only prefill the prompt.
- Q: What is the curl rate limit? → A: 60 requests per minute per client address.
- Q: What usage is recorded for the new surfaces? → A: Anonymous daily totals per surface (SSH sessions started and their durations, limit hits, curl requests, deep links opened) in the existing private usage report; no visitor addresses stored.
- Q: Should SSH ship in this feature? → A: No. SSH (US3) is deferred to a later spec because always-on hosting costs money (the cheapest managed option is ~$4/month; free options need a self-managed server). This feature ships deep links and curl, which run on the existing site at no extra cost. The SSH story, requirements and success criteria are kept under "Deferred: SSH terminal" for the later spec.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Shareable deep links (Priority: P1)

A visitor (or Ahmed himself) wants to send someone straight to a specific view, for example "his RAG projects". They share a link; the recipient opens it and the web terminal loads and immediately shows the result of that command, exactly as if they had typed it. As the visitor keeps exploring, the address bar keeps reflecting the last command they ran, so whatever is on screen can be shared by copying the address. A link is only ever a way to *show* something: it never opens other sites, starts downloads, or asks the AI assistant a question on the visitor's behalf. If the link carries a question for the assistant, the question is placed at the prompt and waits for the visitor to send it.

**Why this priority**: Links are how a portfolio actually travels — in CVs, messages and posts. Pointing a recruiter at the exact relevant view is the highest-value, lowest-friction improvement, and it is the foundation the address-bar sharing builds on.

**Independent Test**: Open a link that names a command and confirm its output appears without typing; run more commands and confirm the address updates; open links that would open a site, start a download, or ask the AI, and confirm none of those happen.

**Acceptance Scenarios**:

1. **Given** a link that names the command `projects | grep -i rag`, **When** a visitor opens it, **Then** the terminal shows the normal welcome followed by that command at the prompt line and its output, with no typing required.
2. **Given** a visitor on the terminal, **When** they run `skills`, **Then** the address bar changes to a link that reproduces `skills`, without adding a new back-button entry for every command.
3. **Given** a link that names `open github` (or any command that would open another site), **When** a visitor opens it, **Then** the command's text output is shown but no other site or tab is opened.
4. **Given** a link that names `resume` (or any command that would start a download), **When** a visitor opens it, **Then** the command's text output is shown but no download starts.
5. **Given** a link that carries a question such as "what RAG work has he done?", **When** a visitor opens it, **Then** the question appears in the prompt input, nothing is sent to the assistant, and pressing Enter sends it exactly as if typed.
6. **Given** a link with a command that is longer than the allowed length or otherwise malformed, **When** a visitor opens it, **Then** the terminal loads normally with nothing run and a short notice that the link could not be used.
7. **Given** a visitor runs `clear`, **When** the screen clears, **Then** the address bar returns to the plain site address.

---

### User Story 2 - curl from your own terminal (Priority: P2)

A developer runs `curl moghazy.me` or `curl moghazy.me/projects` in their own terminal and gets colored, nicely laid-out text for the same content the website shows. They can ask for any command by path or by passing a full command line, and they can turn colors off when piping into a file or another tool. Browsers visiting the same addresses still get the normal web terminal. curl only ever returns content; it never sends anything to the AI assistant.

**Why this priority**: A delightful touch for the technical audience and a strong signal of craft, but fewer visitors use it than links or the web terminal, and it is non-interactive, so it ranks below the two P1 stories.

**Independent Test**: Run curl against the root, a few command paths, a full command line and an unknown command, with and without the no-color option, and check the text; then open the same addresses in a browser and confirm the web terminal loads.

**Acceptance Scenarios**:

1. **Given** a text client, **When** it requests the site root, **Then** it receives a colored welcome with a short guide listing example paths and pointing to the web terminal.
2. **Given** a text client, **When** it requests `/projects` (or `/skills`, `/experience`, any other visible command), **Then** it receives that command's output as colored, readable text whose content matches the web terminal.
3. **Given** a text client, **When** it requests a full command line (for example one containing arguments or a pipe), **Then** it receives the output of that exact command line.
4. **Given** the client asks for no colors (by an explicit option in the address), **When** it requests any command, **Then** the output contains no color or styling codes and is otherwise identical.
5. **Given** a text client, **When** it requests something that is not a command (including a natural-language question), **Then** it receives a "not found" message with a suggestion where one exists, a failure status, and nothing is sent to the AI assistant.
6. **Given** a command that only makes sense interactively (chat mode, themes, menu), **When** it is requested over curl, **Then** the client gets a short message explaining it is available in the web terminal, with its address.
7. **Given** a regular web browser, **When** it visits any of these addresses, **Then** it receives the normal web terminal, not plain text, and the addressed command runs as a deep link (so `/projects` shows the same content in a browser and in curl).

---

### Edge Cases

- A deep link naming an interactive command (`chat`, `theme`, `welcome`, `sudo hire-me`): mode and theme changes are shown as they would be when typed, but any outward action at the end of a sequence (such as a pre-filled email link) is shown as text, not triggered; a linked theme lasts only for the current visit.
- A deep link naming a hidden or easter-egg command runs it like typed input; a destructive-looking joke (`rm -rf /`) only shows its joke output.
- A deep link that is a typo of a command (`/projct` or `/?cmd=projct`) opens the terminal and shows the usual "did you mean" message; it does not prefill the AI prompt.
- A browser address that is not a command at all (`/whatever/else`) opens the terminal and is handled exactly like the same text typed at the prompt: a single word with no close match, or several words, goes into the prompt unsent (FR-005). Such pages are marked so search engines don't index them.
- A deep link and a visitor's saved command history both exist: the link runs in addition to, not instead of, the saved history.
- Rapid commands in the web terminal update the address bar to the last one without flooding the browser's back history.
- Assistant questions typed in the web terminal do not change the address bar; it keeps showing the last command run, so a visitor's questions never end up in browser history or shared links.
- curl with a path containing URL-encoded spaces, quotes or pipes is decoded into the intended command line.
- curl clients making too many requests receive a readable "slow down" message and a rate-limit status rather than an error page.
- curl requests to the site's machine-readable endpoints (content API, chat) keep their current behaviour and are not turned into terminal text.

## Requirements *(mandatory)*

### Functional Requirements

**Shared**

- **FR-001**: The web terminal and curl output (and, once shipped, the SSH terminal) MUST present the same portfolio content, produced by the same command logic, differing only in presentation.
- **FR-002**: Each command MUST either work on a surface or tell the visitor clearly where it is available instead.

**Deep links (US1)**

- **FR-003**: The web terminal MUST accept a command line in the page address, in the address format defined in FR-012, and run it on load through the same path as typed input, showing its output after the welcome.
- **FR-004**: Commands run from a link MUST NOT open other sites or tabs, start downloads, or trigger any outward action; their text output MUST still be shown.
- **FR-005**: When a linked command line would be answered by the AI assistant, the system MUST place it in the prompt input unsent; nothing reaches the assistant until the visitor sends it.
- **FR-006**: Linked command lines MUST be limited to 200 characters; longer or undecodable links MUST load the terminal with nothing run and a short notice.
- **FR-007**: After each command the visitor runs in the web terminal, the address bar MUST be updated to a link that reproduces it, replacing (not adding to) the browser's back-history entry; the path form MUST be used when the command line can be expressed as a path, and the query form otherwise (e.g. pipes, quotes); `clear` MUST reset it to the plain site address.
- **FR-008**: Questions sent to the AI assistant (in place or in chat mode) MUST NOT be written to the address bar; it keeps showing the last command run.
- **FR-009**: A theme set by a link MUST last only for the current visit (the terminal does not save theme choices today, and this feature MUST NOT start saving them).

**curl (US2)**

- **FR-010**: Requests from text clients MUST receive plain-text terminal output; all other clients MUST receive the normal web terminal at the same addresses, including addresses that are not commands (which are then handled as deep links per FR-003–FR-005 and marked not to be indexed).
- **FR-011**: The site root MUST return the welcome plus a short guide to available paths and the web terminal address.
- **FR-012**: Site addresses MUST map to command lines in one format shared by browsers (FR-003) and text clients: each visible command is reachable by a path named after it, with each further path segment passed as one argument (`/projects`, `/skills/llm`), and any full command line (including pipes) is accepted via a query parameter (`/?cmd=…`). Filters (`grep`, `head`, `tail`, `wc`, `sort`) only make sense after a pipe, so they have no path form and are reached through the query form.
- **FR-013**: Output MUST be colored by default and MUST contain no color or styling codes when the client asks for no color, via an explicit option in the address (`nocolor` or `no_color`, with or without a value). (A client's `NO_COLOR` environment variable is never sent to a server, so it cannot be honoured directly.)
- **FR-014**: Unknown input over curl MUST return the standard "not found" output (with suggestions) and a not-found status, and MUST NEVER be sent to the AI assistant.
- **FR-015**: Interactive-only commands over curl MUST return a short message pointing to the web terminal.
- **FR-016**: curl requests MUST be rate-limited to 60 requests per minute per client address, returning a readable message and a rate-limit status when exceeded; existing machine-readable endpoints MUST be unaffected.

**Usage visibility**

- **FR-027**: The system MUST record anonymous daily totals per surface — curl requests, curl rate-limit hits, and deep links opened — and MUST show them in the existing private usage report. (SSH totals — sessions, durations, limit hits — are added when SSH ships.)
- **FR-028**: These records MUST NOT contain visitor addresses or the contents of commands or questions.

### Key Entities

- **Deep link**: a site address carrying one command line (or a question) to show on load, as a command path or a query parameter; the same address works in browsers and curl; bounded in length; never carries authority to act.
- **Text client**: a command-line HTTP client such as curl, Wget or HTTPie, recognised by the name it reports for itself (its user agent). The spec uses "text client" for all of them and "curl" as the everyday example.
- **Surface**: one way of reaching the portfolio — web, curl or (later) SSH — each with its own presentation and its own list of supported commands.
- **Surface usage totals**: anonymous per-day, per-surface counters (requests, limit hits, deep links opened); no addresses or content.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Opening a deep link shows the linked command's output within 2 seconds of the page becoming interactive, with zero keystrokes.
- **SC-002**: In automated tests, 0 deep links open another site, start a download, or send a question to the assistant.
- **SC-003**: Copying the address bar after any command and opening it in a fresh browser reproduces the same output in 100% of tested commands.
- **SC-004**: Every visible command returns readable text over curl; with no-color requested, output contains 0 color or styling codes.
- **SC-005**: 100% of browser requests to the site's pages still receive the web terminal.
- **SC-011**: The private usage report shows the previous day's curl and deep-link totals, and a scan of the stored usage totals finds 0 visitor addresses. (The rate limiter's own short-lived keys are outside this check.)

## Assumptions

- The web terminal, the existing command logic and per-command surface support, the existing colored-text renderer, the content API, and the assistant (with its per-visitor and daily limits) from earlier specs are reused as-is; this feature adds deep links and curl around them.
- Deep links are opened in command mode; the normal welcome is shown before the linked output.
- Any command line, including pipes and hidden commands, can be deep-linked; only outward effects are suppressed.
- A text client is recognised by the name it reports for itself; clients that disguise themselves as browsers get the web terminal.
- curl output is not hard-wrapped by the site; long lines wrap in the visitor's own terminal. Existing layouts (lists, tables, sections) are kept as they are.
- The stated numeric limits (200-character links, 60 curl requests per minute) are defaults Ahmed can tune.
- No new infrastructure or paid service is added: deep links and curl run on the existing site and its existing datastore.

## Deferred: SSH terminal

Not built in this feature (see Clarifications). Kept here so the later SSH spec can start from it. The requirement and criterion IDs are preserved so they are never reused.

### User Story 3 (deferred) - SSH terminal (Priority: P1)

Anyone can type `ssh term.moghazy.me` — no password, no key setup — and land in the full interactive portfolio terminal: the same welcome, menu mode, command mode, themes, history and completion as the web, and the AI assistant answering typed questions in place and in chat mode, exactly as on the web. Resizing the window re-flows the screen, including wrapping assistant answers to the new width. The content is always current: when the portfolio content changes, SSH visitors see it without the SSH service being redeployed. The service protects itself: idle sessions close automatically, sessions have a maximum length, the number of simultaneous sessions overall and per address is capped, and AI questions asked over SSH count against that SSH visitor's own allowance, not a shared one.

**Why this priority**: "ssh term.moghazy.me" is the headline of the portfolio's terminal identity and replaces the retired npm CLI; it is the most memorable and most shareable way in. It is P1 alongside deep links.

**Independent Test**: Connect with a stock SSH client, use menu mode, command mode, a theme change, a typed question and chat mode; resize the window mid-answer; update content on the site and reconnect after the freshness window; then exercise each limit (idle, maximum length, per-address cap, overall cap, AI allowance).

**Acceptance Scenarios**:

1. **Given** a visitor with any standard SSH client and no prior setup, **When** they run `ssh term.moghazy.me`, **Then** they are connected without being asked for a password or key and see the same welcome as the web terminal.
2. **Given** a connected visitor, **When** they use menu mode, command mode, `theme <name>`, history and tab completion, **Then** each behaves as it does on the web.
3. **Given** a connected visitor, **When** they type a question that is not a command, **Then** the assistant answers in place with the same command output, answer text and sources line as the web would show; and in chat mode the conversation works the same way.
4. **Given** an answer or a wide table on screen, **When** the visitor resizes their window, **Then** the screen re-draws to the new size and text wraps to the new width without broken or overlapping lines.
5. **Given** the portfolio content has been updated on the site, **When** a visitor connects (or runs a command) after the freshness window has passed, **Then** they see the updated content, with no redeploy of the SSH service.
6. **Given** a session with no input for the idle limit, **When** the limit is reached, **Then** the visitor sees a short goodbye message and the session closes; a warning appears shortly before.
7. **Given** a session that reaches the maximum session length, **When** the limit is reached, **Then** the visitor sees a short message inviting them to reconnect and the session closes.
8. **Given** an address already holding the maximum number of sessions, or the service at its overall session cap, **When** another connection arrives, **Then** it receives a short, friendly "too many sessions, try again later" message and is closed without affecting existing sessions.
9. **Given** an SSH visitor who has used up their AI allowance, **When** they ask another question, **Then** they receive the same "limit reached" notice the web shows, while other SSH visitors can still ask questions.
10. **Given** a visitor reconnects after the service has been redeployed, **When** their SSH client checks the server's identity, **Then** it matches the previous one and no "host key changed" warning appears.
11. **Given** a visitor runs `ssh term.moghazy.me projects`, **When** the command completes, **Then** they see the same output curl would give for `/projects` and the connection closes; `ssh term.moghazy.me "what RAG work has he done?"` gets "not found" and nothing is sent to the assistant.

### Deferred edge cases

- SSH clients that request a non-interactive single command (`ssh term.moghazy.me projects`) get that command's output, as curl would, and the connection closes; a non-interactive request with no command gets the welcome and guide, then closes.
- A non-interactive SSH command that is a question or unknown input gets "not found" and is never sent to the AI.
- SSH windows smaller than a usable minimum show a "please enlarge your window" notice instead of a garbled layout, and recover when enlarged.
- SSH clients without color support still get readable output.
- If the site's content source is unreachable, the SSH terminal keeps serving the last content it had (or the content it shipped with) rather than failing.
- If the AI assistant is unavailable, SSH visitors get the same notice as web visitors and the rest of the terminal keeps working.
- Ctrl+C during an SSH assistant answer cancels it, as on the web; Ctrl+D or `exit` ends the session cleanly.

### Deferred requirements

- **FR-017**: The SSH terminal MUST accept connections at `term.moghazy.me` on the standard SSH port without requiring a password or key.
- **FR-018**: The SSH terminal MUST offer the same interactive experience as the web terminal: welcome, menu mode, command mode, themes, history, completion, cancellation, in-place assistant answers and chat mode, with the same answer content, command headers and sources line.
- **FR-019**: The SSH terminal MUST re-draw and re-wrap all visible output, including assistant answers, to the window's current size whenever the window is resized.
- **FR-020**: The SSH terminal MUST reflect content updates made on the site within 5 minutes, without being redeployed, and MUST keep serving its last known content if the site cannot be reached.
- **FR-021**: The SSH server's identity MUST stay the same across redeploys so returning visitors never see a "host key changed" warning.
- **FR-022**: Sessions MUST close after 10 minutes without input (with a warning one minute before) and after 30 minutes total, each with a short explanatory message.
- **FR-023**: The service MUST cap simultaneous sessions at 50 overall and 3 per client address; connections over a cap MUST receive a short message and be closed without affecting existing sessions.
- **FR-024**: AI questions asked over SSH MUST count against that SSH visitor's own allowance (the same per-visitor limit as the web), not against the SSH service as a whole, and MUST also count toward the site-wide daily cap.
- **FR-025**: Non-interactive SSH requests carrying a command MUST run it once and return the same output curl would (colored when the client has a terminal, plain otherwise), then close; unknown input MUST get "not found" and MUST NEVER reach the AI; such requests MUST count toward the session caps (FR-023).
- **FR-026**: The SSH surface MUST have an automated smoke test that connects, runs a command, checks its output, and asks a question against a stand-in assistant, verifying the visitor's identity is passed on for the allowance.

### Deferred entities

- **SSH session**: one interactive connection, with a client address, window size, start time, last-input time, current mode/theme, and conversation with the assistant.
- **Content snapshot**: the portfolio content the SSH terminal currently serves, with when it was last refreshed from the site.

### Deferred success criteria

- **SC-006**: A first-time visitor goes from typing `ssh term.moghazy.me` to seeing the welcome in under 5 seconds, answering no prompts beyond the standard first-connection fingerprint confirmation.
- **SC-007**: After a resize, the SSH screen is fully re-drawn at the new width within 1 second, with no lines wider than the window.
- **SC-008**: A content change on the site is visible over SSH within 5 minutes, with no SSH redeploy.
- **SC-009**: In tests, each limit (idle, maximum length, per-address cap, overall cap, AI allowance) triggers at its stated value, and exceeding one visitor's AI allowance leaves other SSH visitors unaffected.
- **SC-010**: The same typed question asked on the web and over SSH produces the same command headers and sources line.

### Deferred assumptions

- SSH visitors are identified for limits by their connection address; visitors sharing an address share caps.
- AI limits for SSH reuse the web's values (15 questions per visitor per hour, site-wide daily cap); no new AI limits are introduced.
- The SSH service runs separately from the website and reaches the site's content and assistant over the network; the stated numeric limits (10/30 minutes, 50/3 sessions, 5-minute freshness, 200-character links, 60 curl requests per minute) are defaults Ahmed can tune.
- A lighter SSH boot/typing animation, presence and the guestbook belong to a later spec.
