# SvelteKit + Phoenix boilerplate

This `boiler-plate` branch is a reusable starting point for a server-rendered SvelteKit frontend and a Phoenix API backend with SQLite. The repository's `main` branch is a personal portfolio; clone this branch explicitly when starting a different project.

```sh
git clone --branch boiler-plate --single-branch https://github.com/Meenaketan7/portfolio-final.git my-project
cd my-project
git remote remove origin
git branch -m main
```

Removing `origin` prevents an accidental push to the source repository. The last command names your new project's local branch `main`; it does not change the source repository. Create your own repository and add its remote when you are ready. This branch does not contain `resume/`.

The frontend is in `app/`; the API backend is in `server/`. Node 24, Bun, Elixir 1.19, and Erlang/OTP 28 were used for this scaffold. [Install Bun](https://bun.com/docs/installation) if it is not available. From the repository root, start the frontend in one terminal:

```sh
bun install
cd app
bun install
bun run dev
```

From the repository root, start the backend in a second terminal:

```sh
cd server
mix setup
mix phx.server
```

The frontend runs independently today. Phoenix has two SQLite repositories and role selection, but no business API routes or frontend integration yet. The current SvelteKit `adapter-auto` builds successfully; a production server adapter and deployment setup remain to be implemented.

See [BOILERPLATE.md](./BOILERPLATE.md) for commands, implemented features, customization points, and optional roadmap links. The [frontend](./app/README.md) and [backend](./server/README.md) READMEs cover each package.
