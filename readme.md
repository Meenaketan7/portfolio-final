# Portfolio

This is my personal portfolio project. The browser-facing app is a server-rendered SvelteKit frontend in `app/`; the API backend is Phoenix with SQLite in `server/`. The site is still being built: the frontend foundation is in place, but several pages are placeholders and the backend has no application API endpoints yet.

## Branches

- `main` is the portfolio project and includes `resume/`.
- [`boiler-plate`](https://github.com/Meenaketan7/portfolio-final/tree/boiler-plate) is a reusable SvelteKit and Phoenix starter. Its history does not contain `resume/`.

To start a different project from the starter branch:

```sh
git clone --branch boiler-plate --single-branch https://github.com/Meenaketan7/portfolio-final.git new-project
cd new-project
git remote remove origin
```

Add your own remote after renaming the project. Removing `origin` prevents an accidental push to this portfolio repository.

## Run locally

Install Node 24, Bun, and Elixir 1.17 or newer with a compatible Erlang/OTP release. From the repository root, install the Git-hook tooling, then the frontend dependencies:

```sh
bun install
cd app
bun install
bun run dev
```

In another terminal, start the backend:

```sh
cd server
mix setup
mix phx.server
```

Open the local address printed by Vite. The frontend runs without the backend for now. Phoenix listens on `http://localhost:4000` by default but currently has no application API routes, so a request to its `/` path returns 404. Development and test SQLite files live in the ignored `server/data/` directory.

The [setup and commands guide](./BOILERPLATE.md) describes the current frontend foundation and portfolio SEO work. The [backend plan](./BACKEND_PLAN.md) tracks the remaining API, authentication, deployment-mode, and Docker work. The production SvelteKit server adapter is not configured yet.
