# Design system

Source of truth is `apps/web/src/app/globals.css` (tokens) and `apps/web/src/components/ui` (primitives). Rules in `apps/web/CLAUDE.md` apply: rem only, tokens only, no inline SVG, one component per file.

- Type: Geist for headings and body, Geist Mono for ids, counts and timestamps. Page title `text-xl font-semibold`, section title `text-sm font-semibold`, metadata `text-xs` muted. No uppercase mono labels.
- Colour: zinc neutrals in both themes (`bg panel panel-2 sunken line line-strong`), one indigo accent (`brand`), semantic `ok warn danger info`, `ai` violet used only for AI-sourced content. No gradients, grid, glow or corner decorations.
- Shape: radius 0.375rem. Hairline borders. No hover lift or scale. No ping or blink animation.
- Layout: sidebar `w-52`, header `h-14`, content `max-w-[72rem]`, page padding `px-4 py-6 sm:px-6 sm:py-8`.
- Controls: buttons `h-9` (`sm` `h-8`), inputs `h-9`, chips `h-7`, badges `h-5`. Tabs are underline tabs.
- Tables: header `text-xs` muted, cells `px-3 py-2.5`, status as dot plus word.
- Status: dot plus text. Colour is never the only signal.

Shared components added or changed this program
- `StatusStrip` (replaces `StoryBanner` look): one line status with inline figures.
- `StorySteps`: quiet 3-step explanation shown only in empty states.
- `Drawer*`: inline composer at the top of the page, not an overlay.
- `ConfirmDialog`: inline confirm, same props.
- `CommandMenu`: global navigation.
- `UptimeBars`: keyboard-navigable day bars.

Dashboard: `DashboardKpis` (one bordered row), `AttentionPanel` (table), `SetupPath` (one line, hidden when complete).

Not yet built: shared chart component, sortable table header, column menu.
