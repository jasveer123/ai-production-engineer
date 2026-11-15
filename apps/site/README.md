# Pramaan marketing and documentation website

A standalone Next.js site in `sre/pramaan-site`, connected to the product in `../site-engineer`.

## What's included

- An AI SRE-first landing page with the actual Pramaan logo, zinc/indigo identity, and a persistent day/night switch.
- A layered incident workspace with scroll-driven perspective, interactive log/trace/patch views, a floating AI finding, an original optical sculpture, source-category integration panels, feature illustrations and smooth anchor navigation. Reduced-motion preferences are respected. The AI product page retains the four-stage conversation demo.
- Seven product pages: monitoring, incident response, telemetry, errors, AI investigation, status pages and RUM.
- Ten integration guides generated from the product's current integration catalogue, including every available setup method, snippet, required access, collection scope and troubleshooting list.
- Thirteen additional product/setup/connection guides.
- Searchable documentation and integration catalogues, collapsible guide groups, mobile docs navigation, active section tracking, code copy and source-reference downloads.
- Actual product frames cropped to the workspace content area. The homepage provides an optional live workspace disclosure. Workflow diagrams and example patches are explicitly labelled as illustrations; no fabricated production telemetry is presented as real.
- Responsive navigation, keyboard focus, reduced-motion support, metadata and static export.

## Run

```sh
pnpm install
pnpm dev
```

Open http://localhost:3100. In this workspace, the ignored `node_modules` link reuses the existing product's installed web dependencies. On another machine, install normally.

```sh
pnpm build
pnpm start
```

The production site is exported to `out/`. The included start command serves it through Python 3 on localhost:3100. Any static host can serve `out/`. Trailing slashes are enabled so nested documentation pages work with static hosting.

## Product connection

Configure `.env.local` before building:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3100
```

The main buttons link to the product's existing `/sign-up` and `/login` routes. Product pages link to their real workspace routes. The original application and API run separately.

Product frames load the real application in an iframe and use the visitor's own session. Visitors without a session may see sign-in; they never receive the owner's cookies or credentials. These are live views, not static screenshots. Embedded views follow the website palette through `?embed=1&theme=dark|light`; the product accepts this override only when embedded, without changing the visitor’s saved workspace theme. The application must be reachable at the configured address and allow embedding from the marketing origin. Browser restrictions or production frame policies may require replacing live frames with approved screenshots in a public launch. A transparent link covers the frame so marketing visitors open the actual product rather than accidentally editing their workspace inside a preview.

## Keep integration docs attached to the product

```sh
pnpm sync:docs
pnpm build
```

`scripts/sync-product-docs.cjs` reads the owned product catalogue, evaluates each method using placeholder settings, and writes `data/integrations.json`. It also copies four source reference documents into `public/reference/`. The generator does not read environment files, credentials or workspace tokens. The committed snapshot makes the site independently buildable when the product checkout isn't present.

The catalogues are sourced from:

- `../site-engineer/apps/web/src/features/integrations/catalog/`
- `../site-engineer/packages/sdk-node/README.md`
- `../site-engineer/packages/sdk-python/README.md`
- `../site-engineer/packages/collector/README.md`
- `../site-engineer/docs/architecture/024-one-click-integration-setup.md`

Product explanations in `data/products.ts` and `data/guides.ts` are authored against the repository implementation. They describe configuration dependencies and current limits; they do not certify production readiness or third-party provider interoperability.

## Visual and content provenance

The logo is the existing product mark from `apps/web/src/assets/svg/logo-mark.svg`, with its color classes resolved to the product's light-theme tokens for standalone use. The marketing layout and supporting copy are original. Integration documentation is the user's own product content; it is intentionally reused and synced rather than paraphrased into an incompatible second source. Lucide icons retain the upstream ISC license. No competitor theme, proprietary screenshot, commercial stock asset or third-party testimonial is used. The first version's generated hero artwork remains outside this website in the original generation folder, but is not served or referenced here.

## Checks

Production build and TypeScript compilation passed for all generated routes. Browser review covers live product rendering and navigation, integration filtering, source-derived docs, code copying and mobile overflow. These checks concern the website; the separate SRE platform has its own operational validation requirements.
