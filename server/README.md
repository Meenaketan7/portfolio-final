# Portfolio backend

The portfolio's API backend is a Phoenix application with separate `Server.Identity.Repo` and `Server.Content.Repo` SQLite repositories. `GET /health/live` checks HTTP availability; `GET /health/ready` checks the selected databases and returns 200 or 503. There is no root page or business API handler yet, so an HTTP 404 at `http://localhost:4000/` is expected.

From `server/`, install dependencies, create the local databases, run migrations, and start the endpoint:

```sh
mix setup
mix phx.server
```

Development and test databases live in the automatically created, Git-ignored `server/data/` directory. `SERVER_ROLE=all` starts both repositories. The `identity` and `content` roles each start their own repository. The root router mounts both domain routers under `/api/v1` and hides the other domain's routes in a single-service role.

Run `mix precommit` to check formatting, compile, run Credo, and run tests. Run `mix quality` for the broader audit, Dialyzer, and Sobelow checks. If `mix hex.audit` is unavailable, update Hex with `mix local.hex` first.

## Backend layout

```text
lib/
  server/
    health.ex                 # database readiness, without HTTP concerns
    identity/repo.ex          # Identity persistence
    content/repo.ex           # Content persistence
  server_web/
    router.ex                 # feature mounts and service role guards
    api_spec.ex               # role-aware OpenAPI composition
    api_docs/                 # development documentation router and Scalar HTML
    api/
      health/                 # router, health controller, response schema
      identity/router.ex
      content/router.ex
    errors/                   # JSON renderer and three shared error schemas
    plugs/                    # shared HTTP plugs
```

HTTP modules use `ServerWeb.Api.Health`, `ServerWeb.Api.Identity`, and `ServerWeb.Api.Content` namespaces. Each feature owns its router, controllers, and API schemas as they are added. Shared errors use `ServerWeb.Errors`. Application contexts, database schemas, repositories, migrations, and environment configuration remain outside these HTTP feature folders, following [Phoenix contexts](https://phoenix.hexdocs.pm/1.8.15/contexts.html).

`Server.Health.ready?/0` checks only the configured repositories using the existing `SELECT 1` query and one-second timeout. The health controller selects the HTTP response and applies `Cache-Control: no-store`. Tests mirror ownership under `test/server/health_test.exs`, `test/server_web/api/health/`, and `test/server_web/errors/`; root routing and specification tests remain under `test/server_web/`.

On 2026-11-20, `mix quality` passed the dependency audit, all 123 tests, strict Credo, Dialyzer, and Sobelow. Development HTTP checks passed separately under `SERVER_ROLE=all`, `identity`, and `content`. Production routing excludes both documentation URLs. Brave rendered Scalar, sent both health requests directly to Phoenix, and passed the mobile layout check without JavaScript errors. Tests cover health responses, request IDs, role restrictions, SQLite path isolation, and the OpenAPI contracts.

## API errors

Framework JSON errors and service role rejections share this format:

```json
{
  "code": "not_found",
  "message": "Not Found",
  "errors": { "detail": "Not Found" },
  "requestId": "request-id-from-the-response-header"
}
```

Use `code` for application decisions and `message` for display. The `errors.detail` field remains available for compatibility. For valid UTF-8 request IDs, `requestId` matches the `x-request-id` response header and the logger's request ID metadata. Missing or non-UTF-8 IDs are omitted from the JSON body so error rendering remains safe. Header and logger handling follow the existing request ID plug.

The existing plug accepts incoming IDs of 20 through 200 bytes and generates one otherwise. Treat these IDs as correlation labels, never credentials. Forwarding them across the frontend proxy and service calls remains integration work.

Rendering `422.json` with an Ecto changeset adds `errors.fields`, where each field has a list of objects containing `code` and `message`. Required fields use `required`, invalid formats use `invalid_format`, and other validation rules use `invalid`. Messages come from fixed Gettext entries; submitted values, custom changeset messages, and constraint metadata are excluded. Nested records retain their structure and list positions.

Controllers must set HTTP status 422 and pass the changeset to the renderer when handling validation failures. The renderer only builds the response body. OpenApiSpex 3.22.4 is installed for API schemas and contract tests. `ServerWeb.Errors.FieldError` describes one field-error object; `FieldErrors` describes the nested dictionary; `ErrorResponse` describes the full envelope. Their tests check actual rendered JSON, endpoint responses, and recursive references. Adding a new field-error code requires updating both the renderer and the leaf schema.

## API documentation

With `mix phx.server` running in development, open:

- [Scalar API reference](http://localhost:4000/dev/api) to browse schemas, view response examples, and send requests.
- [OpenAPI JSON](http://localhost:4000/dev/openapi.json) to inspect or download the generated specification.

Use the configured port when running multiple service roles. Both routes are mounted only when `:dev_routes` is enabled, which is the development default; production and normal tests omit them. JSON and HTML responses use `Cache-Control: no-store`. Development disables OpenApiSpex caching so changes to operation definitions appear on the next request.

`ServerWeb.ApiSpec.spec/0` builds the document with the relative backend URL `/` and resolves all four response schemas. It explicitly collects documented operations from the three feature routers, applying their mounted prefixes: `/health`, `/api/v1/identity`, and `/api/v1/content`. Health is included for every backend role; domain operations are included only for their permitted roles. Collection uses known routers rather than filesystem discovery. Identity and Content still have no business endpoints, so the current document contains these two operations:

| Operation | HTTP 200 example | HTTP 503 example |
| --- | --- | --- |
| `GET /health/live` | `{"status":"ok"}` | Not returned; liveness does not query repositories. |
| `GET /health/ready` | `{"status":"ok"}` | `{"status":"unavailable"}` when a selected repository fails or none are configured. |

Both operations reference `ServerWeb.Api.Health.HealthResponse` and document `Cache-Control` and `X-Request-Id`. The shared schema permits both machine status values; response examples and controller tests enforce their HTTP status combinations. Actual success and failure bodies are validated against the generated document's schema registry.

The Scalar page uses its [HTML/JavaScript integration](https://scalar.com/products/api-references/integrations/html-js), pinned to `@scalar/api-reference@1.81.0` on jsDelivr. The UI needs network access to load that asset; the specification and health requests stay on the local backend. No Scalar proxy or remote fonts are used. Phoenix renders the page through HEEx, with a fresh script nonce and a content security policy. The integration adds no Mix or frontend package dependency.

When adding a business endpoint, define its operation and response schemas beside its feature controller, then test actual responses against the root document and verify the role and mounted path. Request-validation plugs, business operation schemas, and generated frontend types remain part of their later endpoint milestones.

Milestone 2 is complete. There are 19 milestones remaining; next is backend language handling.

## Runtime configuration

`config/runtime.exs` reads process environment variables when Mix starts the application or a release boots. It does not load an environment file automatically. The future launcher will explicitly load `env.local`, `env.dev`, or `env.prod`; deployed staging and production both use production releases.

| Variable | Behavior |
| --- | --- |
| `SERVER_ROLE` | `all` by default; also accepts `identity` or `content`. |
| `MICROSERVICES` | Accepts only `true` or `false`. `false` requires role `all`; `true` requires `identity` or `content`. When omitted, the mode follows the selected role so existing role-only commands keep working. |
| `PHX_SERVER` | Optional `true` or `false`. When omitted, preserves normal Mix/test behavior. Set `true` to serve HTTP from a release. |
| `PORT` | Integer from 1 through 65535. Defaults to 4002 in tests and 4000 otherwise. |
| `PHX_IP` | Optional literal bind address, such as `127.0.0.1` or `::1`. Production defaults to `0.0.0.0`; development and tests retain their loopback defaults. |
| `POOL_SIZE` | Production connection count per active repository. Positive integer, default 1. |
| `PHX_HOST` | Required in production for HTTPS URL generation on port 443. Supply a hostname or IP address without a scheme, port, path, credentials, query, or fragment. IPv6 input uses brackets, such as `[::1]`. |
| `IDENTITY_DATABASE_PATH` | Required in production when Identity is selected. Absolute SQLite file path. |
| `CONTENT_DATABASE_PATH` | Required in production when Content is selected. Absolute SQLite file path. |
| `SECRET_KEY_BASE` | Production secret of at least 64 bytes. Generate it with `mix phx.gen.secret`. |
| `SECRET_KEY_BASE_FILE` | Alternative to `SECRET_KEY_BASE`: an absolute path to a readable regular secret file. Trailing file whitespace is removed. Set exactly one secret source in production. |
| `DNS_CLUSTER_QUERY` | Optional production DNS discovery query. Unset or blank disables discovery; surrounding whitespace is removed. |

Only active production repositories require database settings. Paths are normalized and must refer to regular files or new file targets. The combined role rejects duplicate paths, existing files that share an inode, and paths that overlap the other database's `-journal`, `-wal`, or `-shm` file. Configuration does not create database directories or open databases. Aliases through symlinked parents to a file that does not exist yet, shared paths across containers, persistent mounts, and storage permissions still require deployment checks. Host parsing checks URI structure without resolving DNS; secret length does not prove randomness.

The empty domain routers temporarily annotate matching warnings in Phoenix's generated `call/2` callback. Remove each annotation when that router gains real routes. Application type checks and other generated callbacks remain enabled.

Run a combined backend locally:

```sh
MICROSERVICES=false SERVER_ROLE=all mix phx.server
```

For separate processes, run these in two terminals:

```sh
MICROSERVICES=true SERVER_ROLE=identity PORT=4000 mix phx.server
MICROSERVICES=true SERVER_ROLE=content PORT=4001 mix phx.server
```

Each command starts one process. The HTTP Identity client, service authentication, frontend routing to both services, and Docker launcher remain planned. Setting the mode flag alone does not launch the other service.

For a production release, supply the selected database paths, hostname, and one secret source before running `PHX_SERVER=true bin/server start`. The app is named `server`, so do not generate Phoenix's conflicting default `bin/server` helper. Existing automatic release migrations remain until the dedicated migration job is implemented and verified.

Runtime conventions follow [Elixir configuration](https://elixir.hexdocs.pm/Config.html), [Phoenix endpoint configuration](https://phoenix.hexdocs.pm/Phoenix.Endpoint.html#module-runtime-configuration), and [the SQLite adapter](https://ecto-sqlite3.hexdocs.pm/Ecto.Adapters.SQLite3.html). Absolute persistent database paths and compatible mode/role combinations are the portfolio backend's deployment policy.

See the [portfolio setup guide](../BOILERPLATE.md) and the [backend roadmap](../BACKEND_PLAN.md) for architecture and remaining work.
