# Phoenix API backend

This is an API-only Phoenix scaffold with separate `Server.Identity.Repo` and `Server.Content.Repo` SQLite repositories. There is no root page or business API route yet, so an HTTP 404 at `http://localhost:4000/` is expected.

From `server/`, install dependencies, create the local databases, run migrations, and start the endpoint:

```sh
mix setup
mix phx.server
```

Development and test databases live in the automatically created, Git-ignored `server/data/` directory. `SERVER_ROLE` defaults to `all`; setting it to `identity` or `content` starts only that role's repository. The role guard Plug exists, but it is not attached to API routes yet. Separate service deployments and Docker are planned, not implemented.

Run `mix precommit` to check formatting, compile, run Credo, and run tests. Run `mix quality` for the broader audit, Dialyzer, and Sobelow checks. If `mix hex.audit` is unavailable, update Hex with `mix local.hex` first.

For a production release, `runtime.exs` requires `SECRET_KEY_BASE`, plus `IDENTITY_DATABASE_PATH` and/or `CONTENT_DATABASE_PATH` for the selected role. Set `PHX_HOST` to the public hostname; otherwise URL generation defaults to `example.com`. The app is named `server`, so start its release executable with `PHX_SERVER=true bin/server start`; do not generate Phoenix's conflicting default `bin/server` helper.

See the [repository guide](../BOILERPLATE.md) and the [optional backend roadmap](../BACKEND_PLAN.md) for architecture and remaining work.
