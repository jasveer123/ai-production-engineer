# Design system

Source of truth is `apps/web/src/app/globals.css` (tokens) and `apps/web/src/components/ui` (primitives). Rules in `apps/web/CLAUDE.md` apply: rem only, tokens only, no inline SVG, one component per file.

- Type: heading font via `font-heading`, body default, `font-mono` for ids, counts, timestamps. Section labels use `Eyebrow`.
- Colour: neutrals (`bg`, `panel`, `sunken`, `line`), one accent (`brand`), semantic `ok warn danger info`, `ai` reserved for AI-sourced content only.
- Layout: sidebar `w-56`, header `h-14`, content `max-w-[72rem]`, page padding `px-4 py-6 sm:px-6 sm:py-8`.
- Status: dot plus text. Colour is never the only signal.

Shared components added or changed this program
- `StatusStrip` (replaces `StoryBanner` look): one line status with inline figures.
- `StorySteps`: quiet 3-step explanation shown only in empty states.
- `Drawer*`: inline composer at the top of the page, not an overlay.
- `ConfirmDialog`: inline confirm, same props.
- `CommandMenu`: global navigation.
- `UptimeBars`: keyboard-navigable day bars.

Not yet built: shared chart component, sortable table header, column menu.
