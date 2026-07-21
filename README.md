# Contract & Obligation Tracker

Contract & Obligation Tracker is a production-oriented TypeScript monorepo for converting uploaded legal contracts into verifiable obligations and tracking deadlines with traceability.

This repository currently contains the workspace structure, shared configuration, package boundaries, dataset conventions, and documentation entry points. Business features are intentionally not implemented in this setup task.

## Workspace Layout

- `apps/web`: future React, Vite, TypeScript frontend.
- `apps/api`: future Node.js, Express, TypeScript backend.
- `packages/shared`: framework-independent shared types, schemas, constants, and state-machine definitions.
- `packages/database`: migration, seed, and database script location.
- `packages/test-kit`: reusable test fixtures, fixed clock helpers, provider mocks, and KPI report types.
- `datasets`: local development and validation inputs.
- `reports/kpi`: generated KPI output location.
- `docs`: architecture, API, diagrams, and decisions.

## Commands

Install dependencies:

```sh
pnpm install
```

Run available apps together:

```sh
pnpm dev
```

Run individual app workspaces:

```sh
pnpm dev:web
pnpm dev:api
```

Validate the workspace:

```sh
pnpm typecheck
pnpm test
pnpm test:kpi
pnpm format:check
```

The frontend and backend folders are present as package scaffolds only. Their `dev` and `build` scripts report that implementation is pending until the dedicated app setup work is completed.
