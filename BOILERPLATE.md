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

Open the local address printed by Vite. The placeholder home page runs without Phoenix; API-backed content routes require its planned public content endpoints. From `app/`, use `bun run build` for a production Node SSR build and `bun run preview` to inspect that build. The app uses `@sveltejs/adapter-node`; set a real runtime `ORIGIN` and deploy it beside Phoenix behind one HTTPS origin.

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
| Aliases | `app/package.json` defines native `#lib`, `#lib/*`, and `#config/*` imports for `app/src/lib/` and `app/src/config/`. `app/components.json` maps shadcn components, UI, utils, and hooks into `#lib/...`; source imports include file extensions or `/index.js` for barrels. |
| Theme | Global `ModeWatcher` plus a light/dark/system switcher using `mode-watcher`. |
| Languages | Paraglide uses stable public URLs for English, Spanish, Brazilian Portuguese, German, French, and Japanese. Messages are in `app/src/lib/messages/`. Server hooks set the HTML language and direction; content API requests send the URL language in `Accept-Language`, while `/api/*` is excluded from locale routing. |
| Global UI | Root layout mounts the theme and language switchers, Sonner toaster, and a nonblocking offline notice. A thin progress bar tracks navigation, initial active queries, mutations, and registered UI work. |
| Errors | Root `+error.svelte` displays a localized shared error screen and triggers a toast. Separate `/404`, `/500`, and `/default` display pages exist. `app/src/error.html` is the last-resort fallback. |
| Quality | Oxfmt, Oxlint, `svelte-check`, Vitest browser/server projects, development-only TanStack Query Devtools, Husky, and Conventional Commit validation. |

The stable dependency upgrade on 2026-11-09 moves SvelteKit configuration into `app/vite.config.ts`, as required by SvelteKit 3. It preserves the existing source folders, adapter choice, runes setting, theme, and six locales. `app/tsconfig.json` extends `$app/tsconfig`; TypeScript stays on 6.0.3 because the current SvelteKit and Svelte Check peer requirements support TypeScript 6. Paraglide 3 explicitly uses `message-modules` output in the same ignored `src/lib/paraglide/` directory. See the [SvelteKit 3 migration guide](https://svelte.dev/docs/kit/migrating-to-sveltekit-3) for the framework changes.

The app temporarily overrides Typography's pinned `postcss-selector-parser` to the [6.1.5 security backport](https://github.com/postcss/postcss-selector-parser/releases/tag/6.1.5); remove that override when Typography adopts a patched release. `source-map-js` is patched in the lockfile. `bun audit` may still report the low-severity deepmerge advisory: its [canonical CVE record](https://raw.githubusercontent.com/CVEProject/cvelistV5/main/cves/2026/93xxx/CVE-2026-93753.json) was rejected on 2026-11-02, while npm's audit metadata still lists it. Keep the plugin's supported deepmerge version rather than downgrading it to silence this stale report.

The root page is `app/src/routes/(public)/+page.svelte` and serves `/`; it still contains starter content. `/about`, `/contact`, `/home`, and `/dashboard` have empty page files, so they need indexing decisions before deployment. Route groups such as `(public)` and `(private)` do not appear in URLs. The server access guard returns 401 for private pages until a verified user session is connected; it does not provide authentication itself. The `/404`, `/500`, and `/default` pages are ordinary routes that render their screen; real route failures use `+error.svelte` and their actual HTTP status.

`app/src/routes/app-provider.svelte` mounts TanStack Query and the typed UI store. The same-origin API proxy forwards `/api/...` to Phoenix when `PHOENIX_API_ORIGIN` is configured. Phoenix owns its SQLite database; authentication and API authorization remain backend work. See [app/README.md](./app/README.md) for state, loading, and offline behavior.

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
| `bun run test` | Run all tests once with Vitest. |

After editing translations in `app/src/lib/messages/{locale}.json`, run `bun run i18n:compile` or `bun run check`. Vite also has the Paraglide plugin for development and builds. Generated `app/src/lib/paraglide/` is ignored by Git; do not edit it by hand.

To add another shadcn-svelte component using the existing alias configuration, run this from `app/` and replace `dialog` with the component name:

```sh
bunx shadcn-svelte add dialog
```

The browser Vitest project uses Playwright Chromium. If its browser executable is missing, install it from `app/` with `bunx playwright install chromium`.

Keep frontend tests in `app/tests/` and group them by feature. The current folders include `api/`, `content/`, `seo/`, `routing/`, `store/`, `config/`, `scripts/`, and `components/`. Browser component tests use `.svelte.spec.ts`; the remaining tests run in Node.

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

## SEO and publishing

The frontend now renders page titles, descriptions, canonical links, social tags, and language links on the server. It also has routes for blogs, projects, other content, a sitemap, and `robots.txt`. Placeholder pages stay `noindex`, and content routes need a Phoenix API before they can show real posts. See [app/SEO.md](app/SEO.md) when adding a page. The Phoenix content and publishing work is still planned in [BACKEND_PLAN.md](BACKEND_PLAN.md). A sitemap does not guarantee indexing or rankings.

## Customize before using this starter

- Replace the starter home page and empty public pages with the new project's content; decide which routes may be indexed before deployment.
- Rename the root package `portfolio-tooling` for the new project.
- Replace the favicon and choose the new site's canonical domain, social image, and SEO policy.
- Replace the sample `user/` API resource path and types when your backend contract exists; remove it if your project does not need users.
- Add API routes/contracts, content schemas and migrations, and authentication if the new project needs them. Phoenix and SQLite are already installed; the frontend guard must be connected to verified server sessions before private pages are usable.
- Set the real HTTPS `ORIGIN`, supply Phoenix's public content API, and finish the production reverse-proxy and SQLite backup setup before launch.
