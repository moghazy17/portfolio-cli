# Design

Scope: the desktop at `/` (`app/(desk)/gui.css`, `components/desk/*`). The terminal at `/terminal` keeps
its own themeable palettes in `packages/shared/src/theme.ts` and is not governed by this file.

## World: Be Desktop

A late-1990s BeOS desktop. The page is a desk; every section is a window. The live terminal (a real
shell with the AI assistant) is the front window. The approved comp is `.impeccable/mocks/comp-1.png`
(seed `fd421411`); `comp-2.png` and `comp-3.png` show the second view and mobile.

## Tokens (`.gui-root` custom properties)

| Token | Value | Role |
|---|---|---|
| `--gui-bg` / `--desk` | `#2a69a7` (night: `#163a61`) | The desk. Flat, no pattern. |
| `--chrome` | `#d6d5d6` | Window frames, title strips, Deskbar, dock |
| `--chrome-hi` / `--chrome-lo` / `--edge` | `#f7f7f8` / `#8d8d93` / `#55555b` | Bevel highlight, bevel shadow, 1px outer edge |
| `--tab` / `--tab-hi` / `--tab-lo` | `#fece02` / `#ffe46b` / `#e9bc00` | Focused window tab gradient |
| `--tab-idle` / `--tab-idle-lo` | `#efe0a2` / `#e2cf7c` | Unfocused window tab |
| `--list` / `--list-head` / `--rule` | `#ebecee` / `#deddde` / `#cfcfd3` | Window bodies, Tracker headers, row rules |
| `--select` / `--hover` | `#a7c4f7` / `#dde6f6` | Selected row, hovered row |
| `--paper` | `#ffffff` | The résumé sheet only |
| `--ink` / `--ink-muted` / `--link` | `#1b1f25` / `#4b525c` / `#1449a8` | Text on light surfaces (all ≥ 4.5:1 on `--list`) |
| `--focus` | `#0b1830` | Focus ring on light surfaces; yellow `--tab` inside the terminal |
| `--term` / `--chip` / `--chip-edge` | `#1f252a` / `#2c3845` / `#475a6e` | Terminal body, terminal chips |

The terminal window renders the real terminal (`components/Terminal.tsx`, windowed) in the visitor's
chosen terminal theme (`packages/shared/src/theme.ts`), applied to the window only; the page never
follows the terminal theme.

## Type

- UI and prose: Archivo (self-hosted via `next/font`, `--font-be`), 400/500/600/700.
- Window tab titles 20px/700; résumé name 24–28px/700 (the page `h1`); body 15–16px; Tracker
  headers 14px/600; muted metadata 14px.
- Terminal and chips: JetBrains Mono (`--font-mono`), 16px (17px on the free-form desktop).
- Numbers in tables use `tabular-nums` (`.be-num`).

## Named rules

1. **Every section is a `BeWindow`.** Yellow trapezoid tab (46px, rising 18px above the frame) over a
   full-width bevelled title strip. The close box sits at the left of the tab and the zoom box at the
   right of the strip. Close means minimize: the window goes into its Deskbar entry and is never
   destroyed (its HTML stays for search engines). There is no collapsed title-strip state.
2. **Focus is the only depth signal.** The focused window gets the bright tab and the deep shadow;
   others get the idle tab and a shallow shadow. Clicking or opening a window raises it.
3. **Lists are Tracker lists.** Column header row, 1px rules between columns and rows, item icon at
   left, selection in `--select`. Detail appears below the row (experience) or by disclosure
   (projects), never in a modal.
4. **Icons are the shaded raster set** in `public/desk/*.webp` (generated, provenance in sidecars).
   Never substitute line icons or emoji for desktop or menu icons.
5. **Motion is the window manager talking.** Every movement explains a state change, is quick
   (120–260 ms, ease-out in, ease-in out), and only animates transform, opacity and shadow:
   boot icons lighting up once per session (skippable), the zoom rectangle plus a grow-in when a
   window opens, a shrink into the Deskbar entry (which blinks) on minimize, a smooth max/restore,
   tab and shadow crossfades on focus, a lift while dragging, list rows that expand, a 2px icon lift
   with the dark BeOS label selection, a ticking clock colon and a rolling presence count. Two eggs
   get one-shot effects: a web strand for `spidey`, garnet and blue confetti for `visca`.
   `prefers-reduced-motion: reduce` turns all of it off; state changes then happen instantly.
6. **The terminal is always one click away:** it is the only open window on load, the Deskbar lists
   it first, the docked tab brings it back on the scrolling stack (768–1099px), and the Deskbar's
   Full terminal button opens the full-screen terminal with the same session. The window and `/`
   share one shell, history, theme and log; the zoom box grows the window in place.
7. **Hidden marks:** windows may carry one secret in their resize grip (`mark` prop), which runs an
   easter-egg command in the terminal window. At most one per window; today only Résumé
   (`sudo hire-me`) and Guestbook (`spidey`). Eggs are pure fandom, never work jokes.
8. **The Deskbar is the window list.** Every window has an entry with its icon: the front window
   selected, open ones normal, minimized ones dimmed. Clicking restores a minimized window, minimizes
   the front one, or raises any other.
9. **The desk does not scroll (≥1100px).** It fills the screen; windows open at their own spot or the
   next cascade slot, their height is capped to the screen and long content scrolls inside. Nothing
   is remembered: a reload shows the terminal alone. `/#<window>` opens that window.
10. **Sound and cursors belong to the mouse.** With a fine pointer, the desktop uses the pixel BeOS cursor
    set (`public/desk/cursors/`, built by `scripts/build-cursors.mjs`, `app/(desk)/cursors.css`) and a
    quiet synthesized click on mouse-down plus a softer release on buttons (`hooks/useClickSound.ts`).
    Sound is on by default and the Deskbar speaker toggle mutes it (remembered). No keyboard sounds;
    touch gets neither.

## Layout

- ≥1100px: a fixed `100dvh` desk. Icons in two columns at left, the Deskbar at top-right, windows
  absolutely placed (`--x/--y` once placed, otherwise their own `--x0/--y0` spot; the terminal starts
  centred and large). Windows drag by their tab with a fine pointer; minimized windows are hidden.
- <1100px: windows stack in one column (max 760px), terminal first, all of them shown and scrolling;
  no close, zoom or collapse controls. The Deskbar becomes a top bar with presence, Full terminal and
  a menu holding the window list; <768px adds a five-icon dock at the bottom.

## Not canonized

The résumé sheet's small uppercase section labels (`.be-paper-rule`) are CV document styling inside
the paper, not a page-level eyebrow pattern; do not reuse them above headings elsewhere.
