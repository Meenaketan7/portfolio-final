# SvelteKit + Phoenix boilerplate guide

This guide describes the reusable `boiler-plate` branch. The SvelteKit frontend is in `app/`, and the API-only Phoenix backend with two SQLite repositories is in `server/`. The repository has a root Bun package for Git hooks and a separate Bun package in `app/`; it is not configured as a Bun workspace. The starter does not include the personal `resume/` directory from `main`.

[BACKEND_PLAN.md](./BACKEND_PLAN.md) is an optional roadmap for a content-focused application, including authentication, deployment modes, and Docker. Some foundation work exists; the planned product features and deployment topology are not implemented.

## Run the frontend

Node 24 and Bun were used during setup. Install Bun using the [official instructions](https://bun.com/docs/installation) and Node using your preferred version manager. For example, with Volta:

```sh
volta install node@24
node --version
bun --version
```

Install both packages from the repository root. The root install enables Husky; the app install supplies the frontend dependencies.

```sh
bun install
cd app
bun install
bun run dev
```

Open the local address printed by Vite. The frontend runs without Phoenix for now. From `app/`, use `bun run build` for a production build and `bun run preview` to inspect that build. The current SvelteKit adapter is `adapter-auto`; the intended self-hosted SSR deployment still needs an adapter decision.

## Run the backend

Elixir 1.19 and Erlang/OTP 28 were used during setup. From `server/`, install dependencies, create the local databases, run migrations, and start Phoenix:

```sh
mix setup
mix phx.server
```

The server listens on port 4000 by default. Its root URL and business API paths return 404 because no routes are defined for them yet. Development and test SQLite databases are stored in the automatically created, Git-ignored `server/data/` directory.

The backend has separate Identity and Content Repo modules. `SERVER_ROLE=all` starts both; `SERVER_ROLE=identity` or `SERVER_ROLE=content` starts only the selected Repo. A role guard Plug exists but is not mounted in the router. These settings do not yet provide separate services or role-specific API routes. Run `mix precommit` from `server/` to check formatting, compile, run Credo, and run tests; `mix quality` adds the dependency audit, Dialyzer, and Sobelow. If your Hex installation lacks `mix hex.audit`, update it with `mix local.hex` before running `mix quality`.

## Frontend setup already present

| Area | Current implementation |
| --- | --- |
| Framework | SvelteKit 3, Svelte 5 runes, server-side rendering by default, strict TypeScript 6, Bun. |
| Styling | Tailwind CSS 4, typography plugin, shadcn-svelte neutral light/dark tokens, Inter Variable, and `tw-animate-css` in `app/src/themes/global.css`. |
| Components | shadcn-svelte `Button` and `Sonner` components live under `app/src/lib/components/ui/`; `cn` lives under `app/src/lib/utils/`. |
| Aliases | `app/package.json` defines native `#lib` and `#lib/*` imports for `app/src/lib/`. `app/components.json` maps shadcn components, UI, utils, and hooks into `#lib/...`; source imports include file extensions or `/index.js` for barrels. |
| Theme | Global `ModeWatcher` plus a light/dark/system switcher using `mode-watcher`. |
| Languages | Paraglide URL/cookie/preferred-language handling with English as the fallback, plus Spanish, Brazilian Portuguese, German, French, and Japanese. Messages are in `app/src/lib/messages/`. Server hooks set the HTML language and direction. |
| Global UI | Root layout mounts the theme and language switchers, Sonner toaster, favicon, and a thin progress bar for initial mount and navigation. |
| Errors | Root `+error.svelte` displays a localized shared error screen and triggers a toast. Separate `/404`, `/500`, and `/default` display pages exist. `app/src/error.html` is the last-resort fallback. |
| Quality | Oxfmt, Oxlint, `svelte-check`, Vitest browser/server projects, Husky, and Conventional Commit validation. |

The stable dependency upgrade on 2026-11-09 moves SvelteKit configuration into `app/vite.config.ts`, as required by SvelteKit 3. It preserves the existing source folders, adapter choice, runes setting, theme, and six locales. `app/tsconfig.json` extends `$app/tsconfig`; TypeScript stays on 6.0.3 because the current SvelteKit and Svelte Check peer requirements support TypeScript 6. Paraglide 3 explicitly uses `message-modules` output in the same ignored `src/lib/paraglide/` directory. See the [SvelteKit 3 migration guide](https://svelte.dev/docs/kit/migrating-to-sveltekit-3) for the framework changes.

The app temporarily overrides Typography's pinned `postcss-selector-parser` to the [6.1.5 security backport](https://github.com/postcss/postcss-selector-parser/releases/tag/6.1.5); remove that override when Typography adopts a patched release. `source-map-js` is patched in the lockfile. `bun audit` may still report the low-severity deepmerge advisory: its [canonical CVE record](https://raw.githubusercontent.com/CVEProject/cvelistV5/main/cves/2026/93xxx/CVE-2026-93753.json) was rejected on 2026-11-02, while npm's audit metadata still lists it. Keep the plugin's supported deepmerge version rather than downgrading it to silence this stale report.

The root page is `app/src/routes/(public)/+page.svelte` and serves `/`; it still contains starter content. `/about`, `/contact`, `/home`, and `/dashboard` have empty page files. These URLs are currently reachable while `robots.txt` allows crawling, so they need indexing decisions before deployment. Route groups such as `(public)` and `(private)` do not appear in URLs, and `(private)` does **not** implement authentication. The `/404`, `/500`, and `/default` pages are ordinary routes that render their screen; real route failures use `+error.svelte` and their actual HTTP status.

`app/src/lib/hooks/store/ui/index.ts` defines a typed UI context helper, but there is no mounted provider or application state implementation yet. TanStack Query and Zustand are not installed, and the frontend has no Phoenix API integration or direct database access.

## Commands

Run the following from `app/` unless a different directory is shown.

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the Vite development server. |
| `bun run build` | Build the SvelteKit app. |
| `bun run preview` | Preview the built app locally. |
| `bun run i18n:compile` | Generate Paraglide runtime/types from `project.inlang` and the message files. |
| `bun run check` | Compile Paraglide, sync SvelteKit types, then run `svelte-check`. |
| `bun run check:watch` | Run the type/Svelte check in watch mode after initial generation. |
| `bun run lint` | Run Oxlint with warnings denied. |
| `bun run format` | Write Oxfmt formatting across the app. |
| `bun run format:check` | Check app formatting without changing files. |
| `bun run test:unit` | Start Vitest in watch mode. |
| `bun run test` | Run Vitest once; the current script invokes `npm` internally. |

After editing translations in `app/src/lib/messages/{locale}.json`, run `bun run i18n:compile` or `bun run check`. Vite also has the Paraglide plugin for development and builds. Generated `app/src/lib/paraglide/` is ignored by Git; do not edit it by hand.

To add another shadcn-svelte component using the existing alias configuration, run this from `app/` and replace `dialog` with the component name:

```sh
bunx shadcn-svelte add dialog
```

The browser Vitest project uses Playwright Chromium. If its browser executable is missing, install it from `app/` with `bunx playwright install chromium`.

Oxfmt reads `app/oxfmt.config.ts` for Svelte formatting, Tailwind class sorting, tabs, and single quotes. Oxlint reads `app/oxlint.config.ts`; unused variables, `any`, and `console` calls other than `warn`/`error` fail linting in supported source files. `bun run lint` also treats warnings as failures. From `app/`, verify before a commit:

```sh
bun run format:check
bun run lint
bun run check
bun run test
bun run build
```

The root Husky hooks run only when staged changes include `app/`. The pre-commit hook runs `format:check`, `lint`, and `check` from `app/`; it **does not autoformat**. Run `bun run format` first when formatting needs fixing, then review and stage the result. The commit-message hook requires a Conventional Commit message, for example:

```sh
git commit -m "feat(app): add home page"
```

The original `sv`-generated README recorded this recipe for the initial Svelte/Tailwind/Vitest scaffold; the target directory below is shown as this repo's `app/`. It does not recreate the later shadcn, Paraglide, theme, error, or tooling customizations; use the lockfiles and `bun install` to run this repository instead.

```sh
bun x sv@0.17.1 create --template minimal --types ts --add tailwindcss="plugins:typography" vitest="usages:unit,component" --install bun app
```

## Optional SEO and publishing roadmap

For a content-driven project, shared/content SEO is currently limited to the `SeoData` type in `app/src/lib/seo/types.ts` and a permissive `app/static/robots.txt`; error display pages already set titles and `noindex`. There is no shared SEO head, canonical or `hreflang` output, social preview image, structured data, sitemap, blog route, or API-driven content. The empty pages are not ready for indexing. If publishing posts, one publish action should update the article HTML, metadata, language links, and discovery files together.

- [ ] Define Phoenix/SQLite content records for posts and, if needed, editable site pages. Store a stable post ID and per-locale slug, title, excerpt, body, publication state, author, image, `publishedAt`, and meaningful `modifiedAt`. Allow page-specific SEO title/description/image overrides; validate required content before publishing. Record old slugs for redirects.
- [ ] Define a public API contract that returns published content and SEO fields together, plus the locale-to-slug map for translations. Keep drafts and private data out of public responses. The SvelteKit frontend should fetch its public content from Phoenix; SQLite remains private to Phoenix on the server.
- [ ] Render each dynamic public page through SvelteKit `+page.server.ts`, awaiting the API response before rendering. Return a real 404 for missing or unpublished posts. Render the primary body, title, and description in the initial SSR HTML; do not depend on `onMount` or a client-only query for indexable content. Keep runtime-updated posts out of prerendering.
- [ ] Create a shared SEO component/layout contract using `page.data.seo`. Emit one unique localized `<title>` and description, a self-referencing absolute canonical URL, Open Graph/social tags, and `noindex` only where appropriate. Set a single production HTTPS origin when deployment is chosen. Decide whether `/` or `/en` is the canonical English URL and align redirects, canonicals, and the sitemap with that decision.
- [ ] Emit reciprocal `hreflang` links only for published translations with genuinely translated article bodies. Use the API's translated slug map when slugs differ; translating only the interface is insufficient. Keep the current locale's canonical URL in its own language.
- [ ] Add truthful `BlogPosting` JSON-LD to post pages, with visible headline, author, dates, and image. Add breadcrumb markup only where the page has corresponding navigation; consider `Person`/profile markup for a real About page. Add a default social image and per-post images.
- [ ] Generate `app/src/routes/sitemap.xml/+server.ts` from published, indexable canonical URLs, including localized pages. Use `<lastmod>` only for significant, recorded content changes. Add an absolute `Sitemap:` URL to `robots.txt`; consider an RSS/Atom feed for readers.
- [ ] Keep draft, private, error, and empty placeholder pages out of the sitemap. Use a crawlable `noindex` response for reachable pages that should not appear in search; route groups alone are not access control. Return real 404/410 status for missing/deleted content and permanent redirects for changed slugs. Do not treat the ordinary `/404` display route as the response to a missing post.
- [ ] Make posts discoverable through the blog index, categories/tags if useful, and ordinary descriptive links. Add semantic headings, author/date information, descriptive image alt text, responsive images, and good Core Web Vitals. Cache public SSR/API responses only when their content is independent of user cookies, and refresh the cache on publish or edit.
- [ ] For an always-on single-server deployment, evaluate `@sveltejs/adapter-node` for SvelteKit beside Phoenix behind one HTTPS origin; persist and back up the SQLite file on the server. Validate the production origin and response headers. After deployment, verify the domain in Google Search Console and Bing Webmaster Tools, submit the sitemap, and inspect representative localized posts, status codes, rendered HTML, structured data, and performance.

Useful primary references: [SvelteKit SEO](https://svelte.dev/docs/kit/seo), [server data loading](https://svelte.dev/docs/kit/load), [Node deployment](https://svelte.dev/docs/kit/adapter-node), [Google's multilingual guidance](https://developers.google.com/search/docs/specialty/international/localized-versions), [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), and [Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article). A sitemap and metadata aid discovery and presentation, but do not guarantee indexing or rankings; original, useful content remains essential.

## Customize before using this starter

- Replace the starter home page and empty public pages with the new project's content; decide which routes may be indexed before deployment.
- Rename the root package `portfolio-tooling` and replace placeholder `Portfolio` titles in `app/src/error.html` and `app/src/lib/components/screen-components/error/error-screen.svelte`.
- Replace the favicon and choose the new site's canonical domain, social image, and SEO policy.
- Complete the UI context/provider and add client-side API state tooling only if a feature needs it.
- Add API routes/contracts, content schemas and migrations, authentication, and protection for private routes if the new project needs them. Phoenix and SQLite are already installed.
- Choose a self-hosted SvelteKit adapter and deployment setup before production; the current `adapter-auto` build is not a deployable server bundle by itself.
- Simplify the frontend `test` script if the project should use Bun without invoking npm.
