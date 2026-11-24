# Effect

The frontend uses [Effect](https://effect.website/docs/v4/getting-started/why-effect) 4 (the `effect` package) for asynchronous work that can fail in more than one way. Effect puts the expected failures in the type (`Effect<Success, Error>`), so callers see which errors can happen and handle each one by name instead of guessing what a rejected promise holds.

The installed package ships version-matched guides: `node_modules/effect/AGENTS.md` and `node_modules/effect/ai-docs/`. Prefer them over older v3 examples on the web; several APIs changed in v4 (`Effect.catch` replaces `catchAll`, `Context.Service` replaces `Context.Tag`).

## Where Effect is used

| File                                                                                                                                     | What it does                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/config/api/request.ts`                                                                                                              | `apiRequestEffect` calls Phoenix and fails with `ApiError` or `ApiNetworkError`. `apiRequest` runs it as a Promise for TanStack Query and SvelteKit `load`.                                                                             |
| `src/routes/api/[...path]/+server.ts`                                                                                                    | The Phoenix proxy. An unreachable Phoenix, or a response that cannot be passed through, is `PhoenixUnavailable`, answered as a 502.                                                                                                     |
| `src/lib/hooks/api/content/contract.ts`                                                                                                  | The published content contract as `Schema` definitions. `parsePublishedRecord`, `parsePublishedList` and `parseDiscoveryPage` decode Phoenix payloads and return `null` when they are invalid; `types.ts` re-exports the derived types. |
| `src/lib/hooks/api/content/public-content.server.ts`                                                                                     | Content loads. Failures are `ApiError`, `ApiNetworkError`, `InvalidCursor`, `InvalidContent` and `MovedContent`; `runContentLoad` turns them into SvelteKit errors and the 308 redirect.                                                |
| `src/routes/sitemap.xml/+server.ts`                                                                                                      | Pages through content discovery. Broken data or limits are `DiscoveryFailed`, and any discovery failure answers 503.                                                                                                                    |
| `tests/api/request.spec.ts`, `tests/seo/sitemap-route.spec.ts`, `tests/content/public-content.spec.ts`, `tests/content/contract.spec.ts` | Typed failures, recovery by tag, defects, the HTTP answers each failure produces, and what the contract keeps or rejects.                                                                                                               |

## When to use Effect

Use Effect for:

- calls to Phoenix and other network requests,
- server code (`+server.ts`, `+page.server.ts`, `*.server.ts`) that combines several steps that can fail, such as fetching, validating and paging,
- retries, timeouts and other scheduling, with `Effect.retry`, `Schedule` and `Effect.timeout`.

Keep plain TypeScript for:

- Svelte components, runes and stores,
- synchronous helpers such as URL, SEO, sitemap and content-path builders,
- environment validation in `src/config/env/` (SvelteKit's `defineEnvVars` runs it),
- hooks that only route, redirect or check access (`handle`, `reroute`, `access.server.ts`),
- scripts in `scripts/`. Their tests copy each script into the system temporary folder, where no package can be imported.

## Rules

### Errors

1. Define each expected failure as a tagged error, with a one-line comment saying when it happens:

   ```ts
   /** Phoenix answered with data that does not match the published content contract. */
   class InvalidContent extends Data.TaggedError('InvalidContent') {}
   ```

   Add a separate error only when a caller handles it differently. Put the data the handler needs in its fields (`status`, `location`, `cause`).

2. Fail with `return yield* new MyError(...)`. Do not `throw` an expected failure inside Effect code.
3. Handle failures by tag with `Effect.catchTag` or `Effect.catchTags`. Use `Effect.catch` only when every typed error gets the same treatment.
4. Programming errors and cancellations are defects, not typed errors: `Effect.die(new TypeError(...))` for an invalid argument, and a cancelled request (`AbortError`) passes through unchanged. Do not catch defects with `Effect.catchCause` or `Effect.catchDefect` unless the comment there explains why every failure gets the same answer, as in the sitemap route.

### Promises

5. Wrap a promise that can reject with `Effect.tryPromise({ try, catch })`, and map the rejection to a tagged error in `catch`. To let an `AbortError` through as a defect, rethrow it from `catch`, as `apiRequestEffect` does.
6. Use `Effect.promise` only for promises that cannot reject, for example `response.json().catch(() => null)`.
7. Pass the caller's `AbortSignal` straight to `fetch`. Use a zero-argument `try` thunk unless the code needs Effect's own interruption signal.

### Functions and execution

8. Write reusable functions as `Effect.fnUntraced(function* (...) { ... })`; it keeps generic type parameters such as `apiRequestEffect<T>`. Use `Effect.gen` for one-off programs inside a function. `yield*` effects; do not `await` inside a generator.
9. Run effects only at a framework boundary: a TanStack `queryFn` or `mutationFn`, a `load` function, or a `+server.ts` handler. Use `Effect.runPromise`. In Effect 4 it rejects with the original error or defect, so `instanceof ApiError`, `showRequestError` and SvelteKit's `error()` and `redirect()` keep working.
10. TanStack Query keeps using the Promise API: `queryOptions` and `mutationOptions` call `apiRequest`, and `bun run create-api` generates them that way.
11. In a `load` function, run the program with `Effect.result` and turn each failure into SvelteKit's `error()` or `redirect()` after it finishes, as `runContentLoad` does. Do not throw them from inside Effect code.

### Browser bundle

12. Code that can reach the browser (`src/lib/`, `src/config/api/`, components) imports only core modules: `Effect`, `Data`, `Predicate`, `Result`, `Option`, `Cause` and `Exit`. Use `Schema` only in server modules; it adds about 15 KB gzipped.
13. Mark top-level Effect calls in browser-reachable modules with `/* @__PURE__ */`, such as `extends /* @__PURE__ */ Data.TaggedError(...)` and `= /* @__PURE__ */ Effect.fnUntraced(...)`. Otherwise the bundler keeps them, and Effect ships on every page that imports the `#lib` barrel, even pages that never call the API. After a change, run `bun run build` and check that a page without API calls has no Effect code.
14. Use named imports from `'effect'` (`import { Data, Effect } from 'effect'`).

### Data and validation

15. Validate untrusted data in server modules with `Schema`, as `contract.ts` does. Inside Effect code, use `Schema.decodeUnknownEffect` so a validation failure stays a typed error. In browser code, read unknown values with `Predicate` helpers (`Predicate.isObject`, `Predicate.isString`) instead of hand-written type guards.
16. Change the content contract in one place: edit the `Schema` definitions in `contract.ts`, and the types in `types.ts` follow. Decoding drops fields the contract does not list, so add a field to the schema before a page can use it. Rules that span several fields (such as "posts need an author") go in a `.check(Schema.makeFilter(...))` on the struct; rules that depend on the request (the expected kind and language) stay in the `parse*` functions.
17. Do not use `effect/unstable/*` modules such as the HTTP client; their API can still change in minor releases.

### Services

18. The app does not use `Context.Service`, `Layer` or `ManagedRuntime` yet; dependencies such as `fetcher` are plain parameters. Add a service only when several effects share a dependency that tests need to replace, such as an authenticated API client.

### Tests

19. Test an effect by executing it. `Effect.runPromise(Effect.flip(effect))` returns the typed error, so you can check its `_tag` and class. Check defects with `rejects.toBe(...)`.
20. Keep tests in `tests/<area>/`, like the other frontend tests.

## Tooling

- `effect` is a runtime dependency in `package.json`, next to TanStack Query. adapter-node does not bundle `dependencies`, so production needs the app's `node_modules`.
- `oxlint.config.ts` allows `_tag` in `eslint/no-underscore-dangle`, because `_tag` tells Effect's tagged errors and data types apart.
- The Effect language service (`@effect/tsgo`) is not installed. It targets the TypeScript 7 native compiler, and this app stays on TypeScript 6 because SvelteKit and `svelte-check` require it.
