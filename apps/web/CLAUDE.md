# Pramaan code rules

- Units: use rem. Use Tailwind classes first. If no class exists, use an arbitrary value in rem. Never px.
- SVGs: every SVG is a file in `src/assets/svg/`, imported as a React component. No inline `<svg>` in components. Icons come from lucide-react.
- Components: one component per file, kebab-case file name, named export, props typed with an `interface`.
- No comments in code.
- Colors and radii come from the theme tokens in `src/app/globals.css`. Do not hard-code colors.
- Format with Prettier (`pnpm format`) before finishing.
