# Portfolio backend and Docker roadmap

The portfolio backend shares the reusable Phoenix foundation. It has quality tooling and CI, validated runtime configuration, separate Identity and Content SQLite repositories, documented liveness and readiness endpoints, shared API error contracts, development OpenAPI and Scalar routes, and versioned domain routers with service role guards. Business endpoints, authentication, backend language selection, the service launcher, and Docker remain planned.

## Current backend checkpoint (2026-11-20)

- Milestones 1 and 2 are complete. Development exposes the role-aware OpenAPI document at `/dev/openapi.json` and Scalar at `/dev/api`. The document includes liveness and readiness for all roles, exact 200/503 examples, and four shared response schemas. Production routing omits the documentation URLs.
- Runtime configuration validates the selected repositories, mode and role, HTTP options, production hostname, pool size, and inline or file-based secret. The bind address accepts standard IPv4 and IPv6 literals. The combined role rejects database paths that normalize to the same file, share an inode, or overlap SQLite journal, WAL, or shared-memory files. Persistent volumes, permissions, and cross-container storage isolation still need deployment checks.
- `Server.Health.ready?/0` checks the selected repositories with `SELECT 1` and a one-second timeout per query. The controller owns HTTP status, JSON, and `Cache-Control: no-store`. Development HTTP requests and production release smoke checks exercised `all`, `identity`, and `content`.
- The root router checks service roles before negotiating JSON. Disabled domains return the shared 404 response. HTTP code and tests are organized by feature, with shared errors under `ServerWeb.Errors`.
- Errors retain `errors.detail` and add stable codes and safe messages. A valid UTF-8 request ID is copied from the response header into JSON. Only a 422 with a changeset adds field errors, including nested records and list positions. Business controllers must set the HTTP status and pass the changeset. Request validation and correlation across services belong to later milestones.
- The OpenAPI tests cover schema references, actual health and error bodies, mounted paths, and role filtering. Scalar's browser build is pinned to `1.81.0` and needs CDN access. Its specification and request client use the local backend, as verified in Brave. The page uses a script nonce and a content security policy.
- The shipping review passed `mix quality` with 123 tests, zero Dialyzer errors or skips, and no dependency advisories or Sobelow findings. The lockfile uses Plug 1.20.4 and IDNA 8.0.0 for the November 2026 advisories, with Swoosh 1.30.0 for IDNA 8 compatibility.
- The frontend has a same-origin Phoenix proxy, TanStack Query, a server-side page access guard, and network/loading UI. Identity and Content business routes and verified sessions are still pending.
- Next is milestone 3. Start with the six-language registry, then add header selection, request isolation, and reviewed Gettext catalogs. Compare the backend registry with the frontend locale settings. There are 19 remaining milestones.

### Working rules and progress updates

- The assistant writes and runs the relevant tests, including frontend checks when an integration changes. Keep implementation guidance to one coherent change at a time unless the user explicitly asks for a larger change.
- Include the remaining milestone count in each progress report and guided next step. A partial change does not reduce the count until that milestone's acceptance evidence is complete.
- Before recommending or implementing a change, inspect the affected code and verify version-sensitive behavior against official documentation. Proceed only with at least 90% confidence; otherwise record the uncertainty and required evidence.
- After each verified change, update this checkpoint and the affected numbered milestone. Record the changed behavior, relevant checks and results, remaining limitations, and the next unfinished task. A documentation change alone does not complete an implementation milestone.
- Use focused checks first, then the required `mix precommit` gate for backend implementation changes. Run additional role, language, security, or deployment checks when the changed behavior needs them. Fix failures before moving on; do not use repeated identical test runs as proof of production readiness.
- Preserve the current folders, frontend contracts, branch purposes, and existing behavior. Add dependencies only when the implementation needs them. Keep multilingual support, deployment modes, and production readiness marked as planned until their acceptance checks pass.

## 1. Foundation and research findings

Extend the existing Phoenix scaffold, keeping `app/` and `server/` in the monorepo.

| Reference reviewed | What to adopt |
| --- | --- |
| [Official Phoenix releases](https://phoenix.hexdocs.pm/releases.html) | OTP releases, centralized runtime configuration, supervision, container builds |
| [Mirego boilerplate](https://github.com/mirego/elixir-boilerplate) | Quality checks, security scanning, health checks |
| [Plausible](https://github.com/plausible/analytics) | Production testing, operational visibility, explicit application boundaries |
| [Supabase Realtime](https://github.com/supabase/realtime/blob/main/ARCHITECTURE.md) | Supervision, service responsibilities, failure handling |

These are representative sources; there is no universally best boilerplate. Their larger dependency stacks will stay outside this project.

The proposed scope is admin authentication, minimal localized pages, posts, and projects, both backend deployment modes, frontend login/SSR integration, and Docker environments. A full CMS interface, uploads, public registration, and scheduled publishing remain future features.

## 2. Backend structure and deployment modes

Keep one Phoenix codebase and backend image, with three startup roles:

| Configuration | Running backend | Database ownership |
| --- | --- | --- |
| `MICROSERVICES=false` | One container, `SERVER_ROLE=all` | Identity and Content each own a separate SQLite database |
| `MICROSERVICES=true` | Separate `identity` and `content` containers | Each container mounts only its own database |

The services share a build and release version. They have separate processes, storage, and API boundaries.

- Identity owns administrators, passwords, sessions, and access decisions.
- Content owns pages, posts, projects, translations, publication state, and SEO fields.
- Content calls Identity through one interface: a local implementation in monolith mode and an HTTP implementation in service mode.
- Cross-service calls use Req, fixed upstream addresses, explicit deadlines, and authenticated caller credentials.
- Public content reads work independently of Identity. Protected operations fail closed when authentication cannot be verified.
- Parse configuration strictly at startup. Reject invalid roles, malformed booleans, missing secrets, and inconsistent service settings.
- Changing modes requires a controlled restart. The launcher stops the previous topology and preserves database volumes.

The current layout groups HTTP code by feature:

```text
server/
  lib/
    server/
      health.ex        # database readiness without HTTP concerns
      identity/        # Identity repository; future schemas and sessions
      content/         # Content repository; future schemas and publishing
    server_web/
      router.ex        # feature mounts and role guards
      api_spec.ex      # role-aware OpenAPI composition
      api_docs/        # development router, Scalar controller, and HEEx view
      api/
        health/        # router, controller, HealthResponse
        identity/      # router; future controllers and API schemas
        content/       # router; future controllers and API schemas
      errors/          # ErrorJSON, ErrorResponse, FieldError, FieldErrors
      plugs/           # authentication, limits, role guards
  test/
    server/            # application readiness and runtime configuration
    server_web/
      api/health/      # health controller and schema contracts
      api_docs/        # served specification and Scalar page contracts
      errors/          # renderer and shared schema contracts
      api_spec_test.exs
      router_test.exs
      plugs/
    support/           # SQL sandbox and test-only fixtures
  priv/
    identity_repo/migrations/
    content_repo/migrations/
```

For the API routing preference, use explicit Phoenix routes in domain-specific routers. Phoenix supports forwarding to smaller routers, which avoids a large central routing file. Do not introduce custom filesystem scanning. [Phoenix routing](https://phoenix.hexdocs.pm/Phoenix.Router.html#forward/4)

Controllers handle HTTP concerns; contexts handle business operations; repositories handle persistence, following [Phoenix contexts](https://phoenix.hexdocs.pm/1.8.15/contexts.html). Future context entrypoints, database schemas, and local/HTTP clients belong under `server/`; API schemas belong to their HTTP feature. Add folders only when they contain actual files.

## 3. APIs, authentication, and frontend integration

### API contract

- Version backend endpoints under `/api/v1`.
- Identity provides login, session inspection, logout, and a restricted internal session-validation operation.
- Content provides published-content listing and lookup, plus protected create, update, delete, publish, and unpublish operations.
- Add separate liveness and readiness endpoints.
- Use OpenApiSpex for documented request/response contracts and response validation in tests. Generate frontend TypeScript types from the exported specification. [OpenApiSpex](https://open-api-spex.hexdocs.pm/readme.html)
- The root specification uses the relative server URL `/` and registers concrete schema values such as `ErrorResponse.schema()` before resolving references. It explicitly collects documented operations from the known Health, Identity, and Content routers with their mounted prefixes. Health is collected for every role; domain operations are collected only for their permitted roles. The library does not traverse forwards, and collection must not scan the filesystem.
- Scalar API Reference is available at `/dev/api`, reading the generated document from `/dev/openapi.json`. Both routes are mounted inside development-only routing. The HTML/JavaScript integration pins `@scalar/api-reference@1.81.0` on jsDelivr, uses a script nonce, disables remote fonts, and sends API calls directly to the current backend origin. Separate-role HTTP checks, production route exclusion, and actual Brave client requests are verified. The UI requires CDN access; the JSON specification has no browser-asset dependency. [Scalar HTML integration](https://scalar.com/products/api-references/integrations/html-js), [configuration](https://scalar.com/products/api-references/configuration).
- Standardize validation errors and request IDs, with appropriate `400`, `401`, `403`, `404`, `422`, `429`, and `503` responses.
- Keep the existing error envelope when adding OpenApiSpex request validation. Its default validation renderer has a different shape; introduce and test a safe custom error renderer before enabling that plug on business endpoints. Never expose raw validation inputs through schema errors.

### Backend language support (planned)

Use the same six languages as the frontend, with English as the base language. Keep one explicit backend locale registry, proposed as `Server.Locales`, and use it for header validation, content locale validation, and Gettext mapping. A compatibility check must compare the registry with the frontend settings so adding or removing a supported language cannot silently break the API contract.

| Language | Frontend and content locale ID | HTTP language tag | Gettext catalog |
| --- | --- | --- | --- |
| English | `en` | `en` | `en` |
| Spanish | `es` | `es` | `es` |
| Brazilian Portuguese | `pt-br` | `pt-BR` | `pt_BR` |
| German | `de` | `de` | `de` |
| French | `fr` | `fr` | `fr` |
| Japanese | `ja` | `ja` | `ja` |

The Gettext catalog name for Brazilian Portuguese uses an underscore because the default plural handling recognizes `pt_BR`. Keep this mapping explicit; do not change the frontend or JSON locale ID to the catalog name. [Gettext plural rules](https://gettext.hexdocs.pm/Gettext.Plural.html#module-language-and-territory)

Three kinds of translation have different owners:

- Paraglide owns frontend interface text, including buttons, navigation, and frontend notifications.
- The existing `ServerWeb.Gettext` backend owns backend validation and response message text. Reuse it and add catalogs under `server/priv/gettext/{catalog}/LC_MESSAGES/` as messages are introduced. It does not translate stored content.
- Content translation records in SQLite own authored titles, bodies, summaries, slugs, image descriptions, and SEO overrides. Each translation has its own draft and publication state. A language being supported does not imply every entry has a translation.

#### Request and response rules

- Keep `/api/v1/...` paths unchanged in every language. SvelteKit determines the page language and sends it through `Accept-Language`; Phoenix does not localize API paths or infer the API language from a frontend cookie. This matches the existing Paraglide API exclusion, API helper, proxy, and SSR content loaders.
- For public content record and list reads, retain the exact language selection and 400/406/404 behavior in the Public content SEO contract below. This is an intentional application contract accepting one explicit language tag. General HTTP `Accept-Language` also supports preference lists and weights; those broader forms are outside this API profile and must be documented rather than treated as invalid HTTP. [HTTP language negotiation](https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.4)
- For Identity responses and other endpoints whose data does not require a translation, an absent language header uses English for message text. If a language header is supplied for localized messages, validate it with the same registry. Health and discovery remain usable without a language header; discovery returns published entries across all supported locales.
- Normalize supported language tags case-insensitively to the registry values. Reject duplicate headers, lists, weights, and wildcards according to the documented single-tag API profile. Never create atoms from header values. Invalid language requests return a stable error code with safe English text and cannot recursively invoke failed language selection.
- Select the locale for each request and keep its content ID in `conn.assigns`. Pass it explicitly to contexts, tasks, and service clients. Set the backend-specific Gettext locale for each request that renders translated text; never change application configuration to select a user's language. Gettext stores its locale per process, so spawned work needs explicit locale propagation. [Gettext locale behavior](https://gettext.hexdocs.pm/Gettext.html#module-locale)
- Service role rejection must still hide disabled domains. A language choice must not enable a route, change permissions, or influence session validity. Authenticated responses retain `Cache-Control: no-store`.
- Use canonical `Content-Language` for a response's selected message/content language. Add or merge `Vary: Accept-Language` wherever the representation depends on that header, preserving other existing `Vary` fields. Keep locale-dependent cache and ETag keys separate; the existing proxy already forwards these headers.

#### Messages, content, and compatibility

- Define stable machine error codes, field keys, and safe validation parameters alongside optional translated human messages. Keep `errors.detail` compatible while introducing the documented error envelope and its frontend handling. Clients must not make decisions by parsing translated text. Logs and metrics use stable codes and exclude secrets and sensitive validation values.
- Include message extraction and catalog merging in the development workflow. Check all six catalogs for required messages, interpolation, and plural forms. Use English source messages as a safe runtime fallback for missing backend message translations; the required message set must be reviewed before release. Frontend notifications may map these stable codes to Paraglide messages.
- Public content reads never substitute English content for a missing requested translation. Keep publication, SEO metadata, historical slugs, and cache invalidation scoped to the selected translation as detailed below. Supporting multiple languages does not add automatic machine translation or external translation services.
- Allow Japanese and accented text in titles and slugs. Before creating the database constraints, define one Unicode normalization and case policy for current and historical slugs; do not assume SQLite's default case-insensitive collation handles every Unicode character. Preserve the frontend's slug safety rules and test encoded URLs without transliterating every slug to ASCII. [SQLite collations](https://www.sqlite.org/datatype3.html#collating_sequences)
- Adding a language later requires a coordinated update to the frontend settings/messages, backend registry/catalogs, API schema, locale compatibility tests, and any database locale constraints. Content becomes available in that language only when its translation is published.

Completion evidence must cover all six languages, `pt-br`/`pt-BR`/`pt_BR` mapping, missing and malformed headers, unsupported languages, concurrent request isolation, explicit service/task propagation, message fallback and pluralization, stable error codes, Japanese slugs, missing content translations, publication isolation, language-specific caches, and unchanged API paths. Multilingual runtime support remains planned until these checks pass.

### Minimal content model

- Support `page`, `post`, and `project` entries with translations in the existing six Paraglide locale IDs: `en`, `es`, `pt-br`, `de`, `fr`, and `ja`. The frontend maps `pt-br` to the `pt-BR` language tag in search metadata.
- Store localized slugs, titles, summaries, structured text blocks, SEO overrides, and publication timestamps.
- Publish translations independently; public APIs exclude drafts and unpublished translations.
- Enforce slug uniqueness, database constraints, indexed public lookups, bounded pagination, and allowlisted filtering/sorting.
- Return published translation links alongside content for future multilingual SEO.
- Store only allowlisted block types and plain text; render their text through Svelte's escaped interpolation. A rich text or Markdown pipeline requires a separately reviewed extension.

### Public content SEO contract (planned)

The frontend owns rendered HTML, canonical URLs, and JSON-LD; Phoenix Content owns the published records and discovery data. Keep this contract identical in monolith and service modes. Public page URLs carry the locale, while content API paths do not. SvelteKit reads the locale from the page URL and sends one explicit `Accept-Language` tag (`en`, `es`, `pt-BR`, `de`, `fr`, or `ja`) through its same-origin `/api/v1` proxy to Phoenix. Phoenix maps `pt-BR` to its `pt-br` locale ID. Do not infer the requested content language from the API path, browser preference, or a cookie.

| Public read | Successful response |
| --- | --- |
| `GET /api/v1/content/{kind}/{slug}` with `Accept-Language` | One published record in the requested language; `{kind}` is `pages`, `posts`, or `projects`, and `{slug}` is one URL segment. |
| `GET /api/v1/content/{kind}?cursor=&limit=` with `Accept-Language` | `{items: PublishedSummary[], nextCursor: string \| null}` for public listing pages in the requested language; omit bodies. |
| `GET /api/v1/content/discovery?cursor=&limit=` | `{items: DiscoveryEntry[], nextCursor: string \| null}` across all published languages for sitemap generation; no locale header is required. |

For record and list reads, require exactly one supported `Accept-Language` tag and select that published translation without falling back to another language. Return 400 for a missing or malformed tag, 406 for an unsupported tag, and 404 for a missing or unpublished translation. Set `Content-Language` to the selected language tag on successful responses. Any cacheable language-dependent response, including a cacheable 404, must include `Vary: Accept-Language`; include the normalized language in cache and ETag keys. The same-origin proxy forwards `Accept-Language`, `Content-Language`, and `Vary`. The discovery read is intentionally language-independent and returns all locales.

`PublishedRecord` uses JSON camelCase: `id` (stable across translations), `kind` (`page|post|project`), `locale`, `slug`, `title`, `summary`, `bodyBlocks`, `author` (`{name, url?}` or `null`), `image` (`{url, alt}` or `null`), `publishedAt`, `updatedAt`, `seo`, and `translations`. `bodyBlocks` is an array of `{type: "heading", level: 2|3, text: string}`, `{type: "paragraph", text: string}`, or `{type: "unorderedList", items: string[]}`. Dates are UTC ISO 8601 strings. `seo` contains effective `title`, `description`, `image` (`{url, alt}` or `null`), and `indexable` (`boolean`), with editorial overrides resolved against visible content. `translations` maps each **published** locale to `{slug, indexable}`; the frontend emits alternate-language links only for indexable members. `PublishedSummary` omits `bodyBlocks` but retains ID, kind, locale, slug, title, summary, image, and dates. `DiscoveryEntry` contains kind, locale, slug, `updatedAt`, and the indexable subset of `translations`; the frontend turns `updatedAt` into truthful sitemap `<lastmod>` and constructs public URLs from its configured origin, never a request `Host` header.

- Validate block discriminators, heading levels, text lengths, list sizes, titles, descriptions, slugs, image URLs/alt text, and publication dates before a translation can move from draft to published. Treat block text as plain text, never HTML; Svelte renders it on the server with escaped interpolation. An author is required for a published post. Publish, edit, unpublish, and slug changes are atomic and record a public-content revision.
- Store current and historical slugs in a uniqueness scope of `(kind, locale)` so a retired slug cannot be assigned to another entry. A historical slug that still points to a published record returns that **current** record with its current `slug`; SvelteKit compares requested and returned slugs and sends a public 308 redirect. Never include historical aliases in lists, alternates, or discovery.
- A never-published, draft, private, unpublished, or unknown translation returns 404 without revealing its existence. An intentionally retired URL that was previously public and has no replacement returns 410 from a retained tombstone. A published record with `seo.indexable=false` remains 200 with frontend `noindex`, but is absent from discovery and SEO alternates. Invalid pagination returns 400; unexpected backend failure returns 503 rather than an empty 200 or cached draft.
- Use allowlisted kinds/locales and bounded, deterministic cursor pagination: lists accept up to 20 items and discovery up to 200 items per request, with cursors no longer than 500 characters. Discovery contains only current, published, indexable translations; it never exposes draft, private, deleted, or historical slugs. Return public responses without session-specific data; use ETag/conditional reads and a bounded cache lifetime. Invalidate locale-scoped lookup and list caches, discovery, SvelteKit SSR, and sitemap caches on visible-content, SEO, publication, indexability, translation, or slug changes. Do not serve stale public content after unpublishing; defer SSR caching until invalidation is reliable.
- Specify these schemas, header negotiation, status codes, and publication transitions in OpenAPI. Test locale/slug uniqueness, exact `Accept-Language` selection without fallback, `Content-Language` and `Vary` headers, locale-scoped caches, draft isolation, block validation and escaped rendering, SEO fallback and validation, old-slug resolution, 404/410 boundaries, noindex discovery exclusion, reciprocal translation maps, pagination, meaningful `updatedAt`, and cache invalidation. SSR page loads must await the published record before sending indexable HTML. See [HTTP language negotiation](https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.4), [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), and [localized-page guidance](https://developers.google.com/search/docs/specialty/international/localized-versions).

### Admin authentication

- Use Argon2id password hashing and database-backed opaque sessions.
- Store session-token hashes; use an eight-hour absolute session lifetime initially.
- Provide secure administrator creation and password-recovery commands. No default password or public registration endpoint.
- Logout revokes the session; password recovery revokes every existing session.
- Apply login throttling before password hashing using Hammer's supervised ETS backend. Limits are per running Identity instance. [Hammer](https://hammer.hexdocs.pm/readme.html)
- Adapt Phoenix's authentication patterns to JSON endpoints; retain the API-only backend. [Phoenix authentication guidance](https://phoenix.hexdocs.pm/mix_phx_gen_auth.html)

### SvelteKit integration

Use SvelteKit as the browser-facing server:

```text
Browser -> Caddy -> SvelteKit -> private Phoenix services
```

- Add minimal login/logout and protect the existing dashboard.
- Keep API credentials and authenticated requests in server-only modules.
- SvelteKit sets the HttpOnly session cookie; tokens never enter page data, client state, URLs, or logs.
- Use Secure, host-only cookies in staging/production, with an explicit local HTTP exception.
- Use server actions for browser mutations and retain same-origin CSRF protection.
- Enforce permissions again in Phoenix, including Content writes.
- Preserve Paraglide hooks and protect localized private routes.
- Give service credentials explicit permissions: Content's Identity credential permits session validation only.

Database sessions provide straightforward revocation and fit this admin-only application. [SvelteKit authentication](https://svelte.dev/docs/kit/auth)

## 4. Code quality, Docker, and operations

### Quality gates

Credo, Dialyxir, and Sobelow are present as development/test tools. The complete backend gate should check:

- Formatting without rewriting files.
- Compilation with warnings treated as errors.
- Credo strict checks and Dialyzer analysis.
- Sobelow findings and dependency security advisories.
- Unused lockfile entries.
- ExUnit tests and coverage.

Use a Hex release that includes `mix hex.audit`; Hex 2.5.4 was used during setup. If the task is unavailable, update Hex with `mix local.hex`. Keep formatting fixes separate from verification commands. [Hex audit](https://hex.hexdocs.pm/Mix.Tasks.Hex.Audit.html)

Extend Git hooks with checks scoped to changed frontend/backend paths. CI runs the complete required gates, including frontend checks and container smoke tests.

### Environment contract

| File | Purpose | Runtime |
| --- | --- | --- |
| `env.local` | Local development with hot reload | Development builds |
| `env.dev` | Deployed staging | Production release builds |
| `env.prod` | Live deployment | Production release builds |

Commit example files only. Real environment files, credentials, database files, and backups stay ignored.

- Load the selected environment explicitly.
- Pass an allowlist of variables into each container.
- Mount production secrets as files and implement their loading explicitly.
- Keep staging and production databases, networks, secrets, origins, and volume names separate.
- Use one shared Caddy edge for staging/live domains on the VPS, avoiding competing bindings on ports 80/443.

### Container builds

- Separate frontend and backend multistage Dockerfiles.
- Bun remains the frontend package/build tool.
- Run the SvelteKit 3 application using Node 24 and its configured `@sveltejs/adapter-node` build. Supply the real public HTTPS `ORIGIN` at runtime; do not derive it from untrusted proxy headers. Follow the current [Node adapter documentation](https://svelte.dev/docs/kit/adapter-node) when wiring the production reverse proxy and environment.
- Use pinned images, frozen dependency installs, non-root runtime users, and minimal runtime contents.
- Keep Phoenix ports private; expose the browser application through Caddy.
- Add health checks, graceful shutdown, restart policies, log rotation, and explicit resource settings.

A root launcher selects the environment and translates `MICROSERVICES` into the matching Compose topology.

### SQLite and maintenance

- Persist database directories, including SQLite sidecar files. SvelteKit never mounts them.
- Retain WAL and foreign-key enforcement; explicitly budget connection pools and cache memory.
- Replace automatic application-start migrations with a single maintenance job. Application startup waits for successful migration completion. [Compose startup conditions](https://docs.docker.com/compose/how-tos/startup-order/)
- Back up the existing Identity and Content databases before future schema or deployment-mode changes.
- Add structured production logs, request correlation, request/query telemetry, and secret filtering.

Provide manual local backup/restore commands initially:

- Pause writers and export both databases with a release/schema manifest.
- Validate exports and encrypt the bundle using age.
- Restore while writers are stopped, handle WAL state safely, invalidate restored sessions, and verify health before reopening traffic.

SQLite supports consistent exports using `VACUUM INTO`. [SQLite backup behavior](https://www.sqlite.org/lang_vacuum.html), [age encryption](https://github.com/FiloSottile/age)

Automated off-host backups are deferred as requested; local exports do not cover loss of the VPS.

## 5. Acceptance tests and delivery order

For a project implementing this roadmap, completion requires:

- Identical authentication behavior through local and HTTP service interfaces.
- Correct supervisors, repositories, and enabled routes for every backend role.
- Authentication expiry/revocation, permission checks, throttling, CSRF rejection, and unavailable-service handling.
- Draft isolation, localized slug validation, publishing behavior, pagination, and API contract checks.
- Login/logout and protected dashboard behavior across localized routes.
- No credentials in browser bundles, rendered HTML, logs, or page data.
- Both Docker topologies starting successfully with persistent data.
- Mode switching preserving administrators and content.
- Migration failures preventing startup, plus a successful backup/restore exercise.
- Staging/production isolation and measured memory, latency, and SQLite contention under representative load.

### Completed foundation

- [x] Establish the backend quality baseline and backend CI.
- [x] Separate Identity and Content repositories and select them with `SERVER_ROLE`.
- [x] Add liveness and database readiness endpoints with failure tests.
- [x] Mount versioned Identity and Content domain routers behind their service role guards and verify rejection through the root router.
- [x] Validate current runtime settings and verify actual release startup for every backend role.

These completed items are a foundation. Business handlers, production deployment behavior, full language support, and the remaining quality gates still need the evidence below.

### Implementation tracker

There are **19 remaining milestones out of 21 tracked milestones** as of 2026-11-20. Each row is one deliverable with its own acceptance evidence; it can require several small guided changes. Keep this as the single counted tracker and update each row as work passes verification. Do not infer a completion percentage from the number of rows, since their scope differs.

| Step | Status | Deliverable | Evidence required to complete it |
| --- | --- | --- | --- |
| 1 | Done | Strict runtime and environment configuration | Tests verify mode, role, literal bind addresses, pool, database and SQLite sidecar isolation, hostname, secret sources, and DNS. Production release checks exercised all three roles and rejected invalid configurations before database startup. Service settings, container storage, and topology acceptance belong to later milestones. |
| 2 | Done | Shared API errors and OpenAPI foundation | Shared schemas, service role guards, documented health endpoints, `/dev/openapi.json`, and `/dev/api` are implemented. The full `mix quality` gate passed 123 tests, Dialyzer, the dependency audit, and Sobelow. HTTP checks passed under all three roles. Brave sent both health requests through Scalar, and production excludes both documentation routes. Business endpoint contracts, request validation, and proxy/service correlation belong to later milestones. |
| 3 | Pending | Backend language handling | Implement the six-language registry, header selection, request isolation, existing Gettext backend, and reviewed catalogs. Verify the language rules above against the frontend configuration. |
| 4 | Pending | Identity storage and administrator commands | Add safe Identity migrations, administrator uniqueness, Argon2id hashing, session storage, and bootstrap/recovery commands. Test creation and recovery without default credentials. |
| 5 | Pending | Login, session inspection, and logout | Test hashed opaque tokens, eight-hour expiry, revocation, and safe failure responses through real Identity endpoints. Remove the empty Identity router's generated matching-warning annotation when routes are added. |
| 6 | Pending | Authentication protections | Verify permissions, login throttling before hashing, bounded request input, and responses that do not reveal account existence. |
| 7 | Pending | Local and HTTP Identity clients | Define and validate private Identity origin, service credentials, and timeout settings with the HTTP client. Prove equivalent results, restricted authenticated service calls, explicit deadlines, locale propagation, and safe rejection when Identity is unavailable. |
| 8 | Pending | Content and translation storage | Add separate Content migrations, translation uniqueness, Unicode slug rules, database constraints, and indexed public lookups for all six locale IDs. |
| 9 | Pending | Protected content editing | Verify validated page, post, project, and translation create/update/delete operations, including authorization through both service interfaces. Remove the empty Content router's generated matching-warning annotation when routes are added. |
| 10 | Pending | Publication and slug lifecycle | Test independent translation publishing, required content/SEO fields, atomic revisions, historical slugs, tombstones, and unpublishing. |
| 11 | Pending | Public record and list APIs | Verify exact language selection, draft isolation, bounded pagination, response headers, and the frontend's existing published-content parser contract. |
| 12 | Pending | SEO discovery and cache correctness | Verify indexable discovery, effective metadata, reciprocal published translations, locale-scoped ETags/cache keys, and invalidation after edits, slug changes, and unpublishing. |
| 13 | Pending | Complete API schemas and generated types | Match OpenAPI to implemented endpoints and language/error behavior. Generate frontend types, preserve runtime response validation, and pass contract tests with a clear owner for each schema. |
| 14 | Pending | SvelteKit session and content integration | Verify login/logout, secure cookies, CSRF handling, protected SSR, localized dynamic content/SEO, and absence of secrets in browser output. |
| 15 | Pending | Release and maintenance migrations | Build the release, run migrations once through a maintenance command/job, and prove a failed migration prevents traffic. Remove automatic application-start migrations only after that replacement works. |
| 16 | Pending | Frontend and backend container builds | Verify pinned reproducible builds, non-root runtimes, private Phoenix networking, health checks, and graceful shutdown with the existing Node adapter frontend. |
| 17 | Pending | Compose environments and mode launcher | Verify `env.local`, `env.dev`, and `env.prod` examples, secret loading, shared edge routing, both deployment modes, and isolated persistent database directories. |
| 18 | Pending | Backup and restore commands | Restore encrypted exports, revoke restored sessions, and verify health and data preservation across restarts and mode changes. |
| 19 | Pending | Remaining quality automation | Add meaningful coverage enforcement, frontend CI, container smoke tests, and change-scoped Git hooks. Verify those gates alongside the existing backend quality gate. |
| 20 | Pending | Operational acceptance | Exercise the role/environment/language matrix, service failures, migration failures, persistence, production logs/request correlation, secret filtering, and representative load. Record measured limits and unresolved risks. |
| 21 | Pending | Documentation and final handoff | Complete setup and operations documentation, verify the branch-specific final files and commits remotely when shipping is authorized, then account for and clean temporary local worktrees, stashes, and instructions. |

A milestone becomes Done only after its acceptance evidence is recorded. Update partial progress within its row and the current checkpoint; do not split or silently add milestones without explaining the changed count. Full CMS screens, uploads, public registration, scheduled publishing, and automatic translation remain outside the agreed scope.

## Final local cleanup

Keep the current local backups until implementation and verification are complete. At the final handoff:

- Commit and push the finished starter to `boiler-plate`, then bring shared changes into `main`, preserving each branch's documentation and resume policy.
- Verify the intended final commits and files on both remote branches before removing local backups.
- Check temporary worktrees for unique source files, databases, and environment files, then remove the temporary worktrees and backup stashes when their contents are accounted for.
- Remove temporary project agent instructions and session workflow notes. Keep the reusable setup, API, SEO, and deployment documentation.

Planning confidence: 96%. Implementation completion must be established by the acceptance checks above.
