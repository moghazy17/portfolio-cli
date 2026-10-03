# Design

Scope: the regular page at `/gui` (`app/gui/gui.css`, `components/desk/*`). The terminal at `/` keeps
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

Terminal text colours live in `deskTheme` (`components/desk/DeskTerminal.tsx`): fg `#dfe5ea`, prompt
green `#7bd88f`, links `#6cb6ff`, dimmed `#9aa5b0`; all clear 4.5:1 on `#1f252a`.

## Type

- UI and prose: Archivo (self-hosted via `next/font`, `--font-be`), 400/500/600/700.
- Window tab titles 20px/700; résumé name 24–28px/700 (the page `h1`); body 15–16px; Tracker
  headers 14px/600; muted metadata 14px.
- Terminal and chips: JetBrains Mono (`--font-mono`), 16px (17px on the free-form desktop).
- Numbers in tables use `tabular-nums` (`.be-num`).

## Named rules

1. **Every section is a `BeWindow`.** Yellow trapezoid tab (46px, rising 18px above the frame) over a
   full-width bevelled title strip; collapse and max boxes sit inside the strip at the right. No
   close box: closing would hide portfolio content.
2. **Focus is the only depth signal.** The focused window gets the bright tab and the deep shadow;
   others get the idle tab and a shallow shadow. Clicking or opening a window raises it.
3. **Lists are Tracker lists.** Column header row, 1px rules between columns and rows, item icon at
   left, selection in `--select`. Detail appears below the row (experience) or by disclosure
   (projects), never in a modal.
4. **Icons are the shaded raster set** in `public/desk/*.webp` (generated, provenance in sidecars).
   Never substitute line icons or emoji for desktop or menu icons.
5. **One motion gesture:** the BeOS zoom rectangle travels from the clicked icon or menu item to the
   window (`DesktopContext.zoomRect`, 260 ms, expo-out). No entrance animations; content is always
   visible. Reduced motion removes it.
6. **The terminal is always one click away:** front window on the first view, docked tab bottom-left
   once it scrolls away (≥768px), and the Deskbar's Full terminal button / the terminal's zoom box
   open the full-screen terminal.
7. **Hidden marks:** windows may carry one secret in their resize grip (`mark` prop), which runs an
   easter-egg command in the terminal window. At most one per window.

## Layout

- ≥1100px: free-form desk. Icons column fixed at left, Deskbar fixed at top-right, scenes on a
  12-column grid with deliberate offsets and one overlap (terminal over the Projects window's empty
  lower padding). Windows drag by their tab with a fine pointer.
- <1100px: windows stack in one column (max 760px), terminal first. The Deskbar becomes a top bar
  with presence, Full terminal and a menu; <768px adds a five-icon dock at the bottom.

## Not canonized

The résumé sheet's small uppercase section labels (`.be-paper-rule`) are CV document styling inside
the paper, not a page-level eyebrow pattern; do not reuse them above headings elsewhere.
