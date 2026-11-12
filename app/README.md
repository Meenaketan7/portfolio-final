# Portfolio frontend

This SvelteKit app contains the portfolio's frontend foundation. The home page is starter content, and several public and private pages are still placeholders.

The frontend uses SvelteKit 3, Svelte 5, Vite 8, and supported TypeScript 6. Framework configuration lives in `vite.config.ts`; `#lib` package imports resolve to the existing `src/lib/` folder.

For installation, commands, languages, and UI tooling, see the [portfolio setup guide](../BOILERPLATE.md). Read [SEO.md](./SEO.md) when you add a public page. The app builds a Node server, and published pages need a real runtime `ORIGIN`.

## API and state setup

`src/routes/app-provider.svelte` composes the API and store providers. `src/lib/hooks/api/api-provider.svelte` creates a new TanStack Query client per rendered app instance, and `src/lib/hooks/store/store-provider.svelte` owns UI context. Server requests do not share a query cache or mutable UI store. Queries start in the browser; for SSR content, fetch it in a SvelteKit `load` function and pass it as `initialData` to `createQuery`.

API configuration, the request client, and mutation error handling live in `src/config/api/`. Environment definitions live in `src/config/env/env-config.ts`. SvelteKit still discovers `src/env.ts`, so that file re-exports the definitions. Likewise, `src/hooks.ts` and `src/hooks.server.ts` remain small SvelteKit entrypoints while the Paraglide logic lives in `src/lib/hooks/i18n/`.

Pass `locale` to `apiRequest` only when an API response depends on the public page's language. The request client sets `Accept-Language` from that explicit locale (`pt-br` becomes `pt-BR`); generic API calls and all-language sitemap discovery omit the option. The same-origin proxy forwards the request header and Phoenix's `Content-Language` and `Vary` response headers.

Imports from `src/config/` use the `#config/*` package alias declared in `package.json`, with explicit `.js` extensions. Vite and TypeScript resolve it through the package imports map; `tsconfig.json` and `vite.config.ts` need no duplicate alias entries.

The browser calls the same-origin `/api/v1/...` path. `src/routes/api/[...path]/+server.ts` forwards it to Phoenix, including cookies and authorization headers. Copy `.env.example` to `.env.local` and set `PHOENIX_API_ORIGIN` to the private Phoenix origin. `API_BASE_PATH` defaults to `/api/v1`; it must stay under `/api` and match the Phoenix route prefix. The proxy returns 503 until the origin is configured, and Phoenix API routes must exist before service calls succeed. Keep secrets in server-only environment variables.

API service folders live in `src/lib/hooks/api/`. The `user/` folder shows query keys, options, mutations, and a resource path placeholder. Replace its path and generic response/input types when the Phoenix contract exists. Create another folder with:

```sh
bun run create-api admin
# shorthand: bun run create-api:admin
```

The generator refuses an existing folder and never overwrites its files. Import a generated service directly from `#lib/hooks/api/<name>/index.js`. In a component, use `createQuery(() => userQueries.detail<User>(id))` or `createMutation(() => userMutations.create<User, Input>())`; keep the returned query object intact so its reactive properties update. During SSR, pass the SvelteKit `fetch` function to an API service and use `initialData` on the page query. Mutations should invalidate related query keys after success.

Temporary UI state is in `src/lib/hooks/store/ui/` and disappears on reload. `createSessionStore` is available for other nonpersistent state; child components can use `getUiContext()` during initialization. When a real preference needs persistence, create it with `createPersistentStore`, validate saved data, and call `start()` from `onMount` in its owner component. That hydrates browser storage after SSR and avoids hydration differences. Keep auth credentials in HTTP-only cookies, not browser storage. Theme persistence stays with `mode-watcher`, and public page language follows Paraglide's URL mapping.

The global progress bar covers SvelteKit navigation, first-time active TanStack queries, active mutations, and UI work registered with `getUiContext().beginTask()`. Call its returned finish function in `finally` when an async UI task ends. The bar does not block the page or wait on background refetches or paused offline work. Required server-rendered screen data belongs in an awaited SvelteKit `load` function; individual query sections should show their own pending, paused/offline, and error states.

`NetworkGate` shows a nonblocking offline notice while keeping already loaded content visible. Components can read `getNetworkContext()` to adapt controls that need a connection. TanStack's default online mode pauses queries and mutations while offline, then resumes them on reconnect. Direct API fetch failures become `ApiNetworkError`; a browser offline signal is only a hint, so requests are not globally cancelled. TanStack Query Devtools load only during development and are excluded from the production client bundle.

## Route access

`src/routes/middlewares/access.server.ts` runs from `src/hooks.server.ts` on server requests. `(public)` pages are open; `(private)` requires a signed-in user; `(private)/(user)` and `(private)/(admin)` require their matching role. Route group names do not appear in URLs. The API proxy remains outside these page guards, so Phoenix must authorize its own API endpoints.

No authentication endpoint exists yet. The guard therefore returns 401 for protected pages until a server session check verifies a user and sets `event.locals.user` before `handleAccess` runs. Never grant access from a client store or an unverified cookie. A wrong role returns 403. The shared `(private)/+layout.server.ts` reads the path so client navigation makes a server request and runs the guard. The shared layout also marks private pages `noindex`. The current 401 and 403 responses are plain text; connect a login flow and dedicated error presentation when authentication is implemented.

## Tests

All frontend tests live under `tests/`, grouped by feature. The current folders include `api/`, `content/`, `seo/`, `routing/`, `store/`, `config/`, `scripts/`, and `components/`. Put each new test in the matching folder rather than beside its source file. Run the full suite with `bun run test`; component tests use Playwright Chromium through Vitest.
