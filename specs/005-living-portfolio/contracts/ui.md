# Contract: Web UI Behaviour

Testable UI rules for the terminal and the regular page. Selectors are the stable hooks Playwright
tests use.

## Regular page (`/gui`)

Sections, in order, each a `<section>` with an `<h2>` and `id`:

| id | Content (from shared content) | Component |
|---|---|---|
| `hero` (`<header>`, `<h1>`) | name, label/title, short pitch (`professionalSummary` first sentence), CV button, contact icons | `GuiHero` |
| `about` | professional summary, education | `GuiAbout` |
| `experience` | vertical timeline: company, role, dates, bullets | `GuiTimeline` |
| `projects` | card grid: name, tech stack badges, bullets, links (same targets as terminal) | `GuiProjects` |
| `skills` | categories with skill chips; bars when evidence is available | `GuiSkills` |
| `guestbook` | latest entries + sign form (US3) | `GuiGuestbook` |
| `contact` | email, LinkedIn, GitHub, CV download | `GuiContact` |

- Sticky top bar: name (links to `#hero`), section links (collapsed into a menu under 640 px), and a
  **"Terminal"** button (`data-testid="back-to-terminal"`) visible at every width.
- CV download (`data-testid="gui-cv"`) uses the same URL and filename as the `resume` command.
- Colours from `--gui-*` tokens; light and dark sets via `prefers-color-scheme`. Body text contrast
  ≥ 4.5:1, large text ≥ 3:1 in both.
- Layout works from 320 px wide with no horizontal scroll; tap targets ≥ 44 × 44 px.
- Keyboard: skip link to `#main`, visible focus rings, logical tab order; all interactive elements are
  native links/buttons.
- Motion: section/card entrance fade + 8 px rise, ≤ 400 ms, once, via `motion`'s `m` under
  `MotionConfig reducedMotion="user"`; nothing animates for reduced-motion users.
- A small live badge in the top bar: "N exploring now" (hidden when presence is unavailable).

## Terminal additions

| Element | Selector | Rule |
|---|---|---|
| GUI button | `data-testid="open-gui"` | Visible on first paint at 320 px and 1280 px without scrolling, in the terminal chrome/menu bar; label "Regular view" with an icon; more prominent (accent fill) until the visitor has used either view once, then outline style |
| Boot | `data-testid="boot"` | First plain visit only, ≤ 3 s, hint "press any key to skip"; any key/tap ends it; the key reaches the input |
| Typewriter | `data-reveal="typing"` on the animating block | Only outputs ≤ 40 lines; done in ≤ 1.5 s; keydown or new command completes it |
| Glitch | `.ascii-banner.glitch-reveal` | One-shot, < 1 s; any key press or tap removes the class at once |
| CRT | `[data-effect="crt"]` on the terminal container | Scanlines, vignette, glow; SVG barrel filter only ≥ 768 px; overlays `pointer-events:none`, `aria-hidden` |
| Screensaver | `data-testid="screensaver"` (canvas) | After 60 s idle; removed on the first input; Enter only dismisses; never while streaming, sequencing, hidden or reduced motion |
| Skill bars | `[role="progressbar"]` with `aria-valuetext="N repos"` | Fill animates once (≤ 600 ms) when `reveal` and motion allowed |

Reduced motion (`prefers-reduced-motion: reduce`): no boot, no typing, no glitch, no screensaver, bars
at final width, CRT static. Playwright runs one project with `reducedMotion: 'reduce'`.

## View switching

- `gui` / `startx` / GUI button → client navigation to `/gui`, cookie `view=gui`.
- "Terminal" button → cookie `view=terminal`, client navigation to `/`; the terminal restores its
  previous log, cwd and input history from the in-tab snapshot (no welcome replay, no boot).
- Opening `/` with cookie `view=gui` → lands on `/gui`. Opening a deep link → terminal, runs it.

## Guestbook form on `/gui`

- Fields: name (`maxlength` 24), message (`maxlength` 140, live counter), submit button.
- Turnstile loads on first focus of either field; submit is disabled until the token is ready
  (with a fallback message after 10 s).
- Errors use the shared reason messages and are announced via `aria-live="polite"`; typed text is
  kept on every failure.
- On success the new entry appears at the top of the list and the form resets.
