# Optional Phoenix backend and Docker roadmap

Status: optional content-focused roadmap, partly started. The starter already has quality tooling, separate Identity and Content SQLite repositories, and runtime Repo selection. API routes, authentication, the service launcher, and Docker are not implemented. The quality-foundation checklist item remains open until CI and coverage are in place. The items below are proposed work for a project that needs them, not requirements for every clone of the boilerplate.

## 1. Foundation and research findings

Extend the existing Phoenix scaffold, keeping `app/` and `server/` in the monorepo.

| Reference reviewed | What to adopt |
| --- | --- |
| [Official Phoenix releases](https://phoenix.hexdocs.pm/releases.html) | OTP releases, centralized runtime configuration, supervision, container builds |
| [Mirego boilerplate](https://github.com/mirego/elixir-boilerplate) | Quality checks, security scanning, health checks |
| [Plausible](https://github.com/plausible/analytics) | Production testing, operational visibility, explicit application boundaries |
| [Supabase Realtime](https://github.com/supabase/realtime/blob/main/ARCHITECTURE.md) | Supervision, service responsibilities, failure handling |

These are representative sources; there is no universally best boilerplate. Their larger dependency stacks will stay outside this project.

The proposed scope is admin authentication, minimal localized pages/posts, both backend deployment modes, frontend login/SSR integration, and Docker environments. A full CMS interface, uploads, public registration, and scheduled publishing remain future features.

## 2. Backend structure and deployment modes

Keep one Phoenix codebase and backend image, with three startup roles:

| Configuration | Running backend | Database ownership |
| --- | --- | --- |
| `MICROSERVICES=false` | One container, `SERVER_ROLE=all` | Identity and Content each own a separate SQLite database |
| `MICROSERVICES=true` | Separate `identity` and `content` containers | Each container mounts only its own database |

The services share a build and release version. They have separate processes, storage, and API boundaries.

- Identity owns administrators, passwords, sessions, and access decisions.
- Content owns pages, posts, translations, publication state, and SEO fields.
- Content calls Identity through one interface: a local implementation in monolith mode and an HTTP implementation in service mode.
- Cross-service calls use Req, fixed upstream addresses, explicit deadlines, and authenticated caller credentials.
- Public content reads work independently of Identity. Protected operations fail closed when authentication cannot be verified.
- Parse configuration strictly at startup. Reject invalid roles, malformed booleans, missing secrets, and inconsistent service settings.
- Changing modes requires a controlled restart. The launcher stops the previous topology and preserves database volumes.

Organize code by responsibility:

```text
server/
  lib/
    server/
      identity.ex
      identity/        # schemas, sessions, repository
      content.ex
      content/         # schemas, publishing, repository
      clients/         # local and HTTP service interfaces
    server_web/
      router.ex        # small root router
      identity/        # router, controllers, JSON contracts
      content/         # router, controllers, JSON contracts
      plugs/           # authentication, limits, role guards
  priv/
    identity_repo/migrations/
    content_repo/migrations/
```

For the API routing preference, use explicit Phoenix routes in domain-specific routers. Phoenix supports forwarding to smaller routers, which avoids a large central routing file. Do not introduce custom filesystem scanning. [Phoenix routing](https://phoenix.hexdocs.pm/Phoenix.Router.html#forward/4)

Controllers handle HTTP concerns; contexts handle business operations; repositories handle persistence. Files stay focused as features grow.

## 3. APIs, authentication, and frontend integration

### API contract

- Version backend endpoints under `/api/v1`.
- Identity provides login, session inspection, logout, and a restricted internal session-validation operation.
- Content provides published-content listing and lookup, plus protected create, update, delete, publish, and unpublish operations.
- Add separate liveness and readiness endpoints.
- Use OpenApiSpex for documented request/response contracts and response validation in tests. Generate frontend TypeScript types from the exported specification. [OpenApiSpex](https://open-api-spex.hexdocs.pm/readme.html)
- Standardize validation errors and request IDs, with appropriate `400`, `401`, `403`, `404`, `422`, `429`, and `503` responses.

### Minimal content model

- Support `page` and `post` entries with translations in the existing six locales: `en`, `es`, `pt-BR`, `de`, `fr`, and `ja`.
- Store localized slugs, titles, summaries, Markdown bodies, SEO overrides, and publication timestamps.
- Publish translations independently; public APIs exclude drafts and unpublished translations.
- Enforce slug uniqueness, database constraints, indexed public lookups, bounded pagination, and allowlisted filtering/sorting.
- Return published translation links alongside content for future multilingual SEO.
- Markdown permits no executable components. Rendering disables raw HTML and validates link/image protocols.

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
- Run the existing SvelteKit 2 application using Node 24 and compatible `adapter-node` 5.5.4. At the time of research, the official Bun adapter targeted SvelteKit 3 prereleases. [Node adapter compatibility](https://raw.githubusercontent.com/sveltejs/kit/@sveltejs/adapter-node@5.5.4/packages/adapter-node/package.json), [Bun adapter requirements](https://raw.githubusercontent.com/sveltejs/kit/main/packages/adapter-bun/package.json)
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

Follow this implementation checklist in order. Mark an item complete only after its relevant checks pass:

- [ ] Establish the backend quality foundation.
- [ ] Add domain boundaries, separate repositories, migrations, and API contracts.
- [ ] Implement admin authentication and minimal localized content operations.
- [ ] Implement and test both backend deployment modes.
- [ ] Connect SvelteKit login/logout, server API access, and protected SSR routes.
- [ ] Containerize the frontend/backend and configure local, staging, and production environments.
- [ ] Verify topology switching, persistence, migration failure handling, backups, restoration, and representative load.
- [ ] Update `BOILERPLATE.md` with the final architecture, commands, environment reference, service-switch procedure, backup/restore instructions, and remaining product features.

Planning confidence: 96%. Implementation completion must be established by the acceptance checks above.
