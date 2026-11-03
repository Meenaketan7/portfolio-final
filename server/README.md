# Portfolio backend

This Phoenix API scaffold has separate Identity and Content SQLite repositories. `SERVER_ROLE` selects `all` (the default), `identity`, or `content` at startup. Domain APIs, authentication, and the deployment-mode switch are still planned; the router currently has no application endpoints or root page.

From `server/`, install dependencies and initialize the local databases, then start Phoenix:

```sh
mix setup
mix phx.server
```

Development and test databases are created under the ignored `server/data/` directory. Run `mix precommit` to check formatting, compile, run Credo, and run tests. The [backend plan](../BACKEND_PLAN.md) covers the intended API and deployment architecture.

For a production release, set `PHX_HOST` to the public hostname and start the endpoint with `PHX_SERVER=true bin/server start`. The app name `server` already produces a `bin/server` release executable; do not generate Phoenix's default `bin/server` helper with `mix phx.gen.release`.
