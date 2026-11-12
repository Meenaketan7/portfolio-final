# Portfolio boilerplate

This document records the current frontend setup, the commands needed to run it, and the planned SEO and backend work. The SvelteKit app is in `app/`, and the Phoenix/SQLite backend scaffold is in `server/`. The repository has a root Bun package for Git hooks and a separate Bun package in `app/`; it is not configured as a Bun workspace.

Follow [the backend and Docker implementation plan](./BACKEND_PLAN.md) for the agreed architecture, deployment modes, quality gates, environments, and implementation checklist. Those planned features are not yet implemented.

## Run the frontend

Node 24 and Bun were used during setup. The commands below assume Bun and Volta are already installed. In particular, the TypeScript Oxfmt config failed to load with Node 22.14 and worked after updating Node through Volta:

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

Open the local address printed by Vite. The placeholder pages run without Phoenix; blog and project pages need the planned API. From `app/`, use `bun run build` for the Node server and `bun run preview` to inspect it. Set a real HTTPS `ORIGIN` before publishing pages.

## Frontend setup already present

| Area | Current implementation |
| --- | --- |
| Framework | SvelteKit 3, Svelte 5 runes, server-side rendering by default, strict TypeScript 6, Bun. |
| Styling | Tailwind CSS 4, typography plugin, shadcn-svelte neutral light/dark tokens, Inter Variable, and `tw-animate-css` in `app/src/themes/global.css`. |
| Components | shadcn-svelte `Button` and `Sonner` components live under `app/src/lib/components/ui/`; `cn` lives under `app/src/lib/utils/`. |
| Aliases | `app/package.json` defines native `#lib`, `#lib/*`, and `#config/*` imports for `app/src/lib/` and `app/src/config/`. `app/components.json` maps shadcn components, UI, utils, and hooks into `#lib/...`; source imports include file extensions or `/index.js` for barrels. |
| Theme | Global `ModeWatcher` plus a light/dark/system switcher using `mode-watcher`. |
| Languages | Paraglide uses stable URLs for English, Spanish, Brazilian Portuguese, German, French, and Japanese. Messages are in `app/src/lib/messages/`. Server hooks set the HTML language and direction; content requests send the URL language in `Accept-Language`. |
| Global UI | Root layout mounts the theme and language switchers, Sonner toaster, favicon, and a nonblocking offline notice. A thin progress bar tracks navigation, initial active queries, mutations, and registered UI work. |
| Errors | Root `+error.svelte` displays a localized shared error screen and triggers a toast. Separate `/404`, `/500`, and `/default` display pages exist. `app/src/error.html` is the last-resort fallback. |
| Quality | Oxfmt, Oxlint, `svelte-check`, Vitest browser/server projects, development-only TanStack Query Devtools, Husky, and Conventional Commit validation. |

The stable dependency upgrade on 2026-11-09 moves SvelteKit configuration into `app/vite.config.ts`, as required by SvelteKit 3. It preserves the existing source folders, adapter choice, runes setting, theme, and six locales. `app/tsconfig.json` extends `$app/tsconfig`; TypeScript stays on 6.0.3 because the current SvelteKit and Svelte Check peer requirements support TypeScript 6. Paraglide 3 explicitly uses `message-modules` output in the same ignored `src/lib/paraglide/` directory. See the [SvelteKit 3 migration guide](https://svelte.dev/docs/kit/migrating-to-sveltekit-3) for the framework changes.

The app temporarily overrides Typography's pinned `postcss-selector-parser` to the [6.1.5 security backport](https://github.com/postcss/postcss-selector-parser/releases/tag/6.1.5); remove that override when Typography adopts a patched release. `source-map-js` is patched in the lockfile. `bun audit` may still report the low-severity deepmerge advisory: its [canonical CVE record](https://raw.githubusercontent.com/CVEProject/cvelistV5/main/cves/2026/93xxx/CVE-2026-93753.json) was rejected on 2026-11-02, while npm's audit metadata still lists it. Keep the plugin's supported deepmerge version rather than downgrading it to silence this stale report.

The root page is `app/src/routes/(public)/+page.svelte` and serves `/`; it still contains starter content. `/about`, `/contact`, `/home`, and `/dashboard` have empty page files, so they need indexing decisions before deployment. Route groups such as `(public)` and `(private)` do not appear in URLs. The server access guard returns 401 for private routes until a verified user session is connected; it does not provide authentication itself. The `/404`, `/500`, and `/default` pages are ordinary routes that render their screen; real route failures use `+error.svelte` and their actual HTTP status.

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
git commit -m "feat(app): add portfolio page"
```

The original `sv`-generated README recorded this recipe for the initial Svelte/Tailwind/Vitest scaffold; the target directory below is shown as this repo's `app/`. It does not recreate the later shadcn, Paraglide, theme, error, or tooling customizations; use the lockfiles and `bun install` to run this repository instead.

```sh
bun x sv@0.17.1 create --template minimal --types ts --add tailwindcss="plugins:typography" vitest="usages:unit,component" --install bun app
```

## SEO and publishing

The portfolio app now renders page titles, descriptions, canonical links, social tags, and language links on the server. It has routes for posts, projects, other content, a sitemap, and `robots.txt`. The current home, About, and Contact pages remain `noindex` until they have real content. The blog and project routes need the Phoenix content API before they can serve published work.

Read [app/SEO.md](app/SEO.md) when adding a page. The Phoenix content and publishing work is still planned in [BACKEND_PLAN.md](BACKEND_PLAN.md). Metadata and a sitemap help search engines understand a page, but they do not guarantee indexing or rankings.

## Other pending work

- Replace the starter home page and empty public pages with real content.
- Replace the sample `user/` API resource path and types when the backend contract exists; remove it if the portfolio does not need it.
- Add Phoenix domain APIs, migrations for application data, authentication, and actual protection for private routes. The Phoenix scaffold and separate SQLite repositories are already present.
- Replace the Svelte favicon and placeholder `Portfolio` branding with final site assets and copy.
