# SvelteKit + Phoenix boilerplate

This `boiler-plate` branch is a starter for SvelteKit, Phoenix, and SQLite. Clone this branch for a new project. The `main` branch contains the portfolio.

The frontend uses Bun, TypeScript, Tailwind CSS, shadcn-svelte, Paraglide, and TanStack Query. It starts with placeholder pages. Phoenix content routes and authentication are still planned.

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

The placeholder frontend runs without Phoenix. SvelteKit builds a Node server with `adapter-node`, but content pages still need Phoenix routes. Set the public HTTPS `ORIGIN` before launch, and finish deployment and database backups.

See [BOILERPLATE.md](./BOILERPLATE.md) for commands, implemented features, customization points, and optional roadmap links. The [frontend](./app/README.md) and [backend](./server/README.md) READMEs cover each package.
