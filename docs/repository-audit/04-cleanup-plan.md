# Cleanup Plan

Date: 2026-07-21

Scope: validation and planning only. This phase did not delete files, remove dependencies, or refactor business logic.

Inputs read:

- `docs/repository-audit/01-repository-inventory.md`
- `docs/repository-audit/02-unused-candidates.md`
- `docs/repository-audit/03-duplicate-architecture-findings.md`

## Validation Summary

Candidates were rechecked against:

- Repository-wide `rg` searches for imports, exports, direct symbol references, dynamic imports, and package-script references.
- Runtime registrations in `apps/api/src/bootstrap/register-routes.ts`, `apps/api/src/bootstrap/register-workers.ts`, `apps/api/src/bootstrap/register-schedulers.ts`, `apps/api/src/jobs/scheduler-entry.ts`, and `apps/web/src/app/router.tsx`.
- Current package scripts in root, `apps/api`, `apps/web`, `packages/shared`, `packages/test-kit`, and `packages/database`.
- Existing tests under `apps/api/tests`, `apps/web/src/**/*.test.*`, and package test scripts.
- Git history. Relevant paths currently show only `057283f Input Layer v1`, so history is supporting context only, not removal proof.
- Environment selection in `apps/api/src/config/env.ts`, `apps/api/src/config/storage.ts`, `apps/api/src/scripts/check-connections.ts`, and `apps/web/src/services/api-client.ts`.
- Migration configuration under `packages/database/migrations`. No repository script applies migrations directly.
- CI/CD and deployment config search. No `.github`, Docker, Vercel, Netlify, Render, Fly, Railway, GitLab CI, Azure Pipelines, or `.openai/hosting.json` config was found.

Important current-script correction:

- `packages/test-kit/package.json` currently includes both `test` and `test:kpi`. The older inventory note saying no matching `test:kpi` script was found is stale.

## Final Candidate Decisions

| Candidate ID  | Final action    | Validation decision                                                                                                               |
| ------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| UC-HIGH-001   | REMOVE          | Unreferenced script; no package script, runtime registration, test, dynamic import, or deploy/CI reference found.                 |
| UC-HIGH-002   | REMOVE          | Unused HTTP constant file; no imports outside audit docs.                                                                         |
| UC-HIGH-003   | DEPRECATE       | Unused pagination types; medium removal risk because pagination endpoints may be planned.                                         |
| UC-HIGH-004   | REMOVE          | Unused exhaustive-check utility; no imports outside audit docs.                                                                   |
| UC-HIGH-005   | DEPRECATE       | Unused ID schema; should be deprecated with request-validation cluster before removal.                                            |
| UC-HIGH-006   | DEPRECATE       | Unused request-validation middleware; no route adoption yet.                                                                      |
| UC-HIGH-007   | REMOVE          | Unused PDF source viewer component; no active route or import found.                                                              |
| UC-HIGH-008   | REMOVE          | Unused confirmation dialog component; no active import found.                                                                     |
| UC-HIGH-009   | REMOVE          | Dialog primitive is only referenced by unused confirmation dialog.                                                                |
| UC-HIGH-010   | REMOVE          | Shared UI pagination is unused; workflow has its own active pagination.                                                           |
| UC-MED-001    | DEPRECATE       | Legacy `ContractService` is re-exported only; active upload uses `ContractIngestionService`.                                      |
| UC-MED-002    | DEPRECATE       | `LegacyContractRepository` has no implementation.                                                                                 |
| UC-MED-003    | REGISTER        | Document-processing module appears intended for the contract processing pipeline, not abandoned.                                  |
| UC-MED-004    | REGISTER        | Extraction module appears intended for the processing pipeline, not abandoned.                                                    |
| UC-MED-005    | REGISTER        | Review module should be registered if review UX remains in scope.                                                                 |
| UC-MED-006    | REGISTER        | Source anchoring should be wired through processing/review rather than removed.                                                   |
| UC-MED-007    | REGISTER        | Notification provider should be wired before reminder delivery is considered complete.                                            |
| UC-MED-008    | MANUAL_DECISION | OCR provider stubs need a provider-roadmap decision before registration or removal.                                               |
| UC-MED-009    | MANUAL_DECISION | LLM provider stubs need a provider-roadmap decision before registration or removal.                                               |
| UC-MED-010    | MANUAL_DECISION | Email provider adapters/env need a provider-roadmap decision before registration or removal.                                      |
| UC-MED-011    | REGISTER        | Native PDF text extractor is an incomplete processing integration.                                                                |
| UC-MED-012    | REGISTER        | Database health check should be wired into `/health` or `check:connections` if retained.                                          |
| UC-MED-013    | REGISTER        | Expired job recovery wrapper should be scheduled or explicitly dropped later.                                                     |
| UC-MED-014    | REGISTER        | Expired reminder recovery wrapper should be scheduled or explicitly dropped later.                                                |
| UC-MED-015    | CONSOLIDATE     | Reminder producer overlaps with scheduler repository job insertion path.                                                          |
| UC-MED-016    | DEPRECATE       | Reminder frontend feature is unreachable until backend reminder API is implemented.                                               |
| UC-EXP-001    | REMOVE          | Same file as UC-HIGH-002.                                                                                                         |
| UC-EXP-002    | DEPRECATE       | Same cluster as UC-HIGH-005.                                                                                                      |
| UC-EXP-003    | DEPRECATE       | Same cluster as UC-HIGH-006.                                                                                                      |
| UC-EXP-004    | DEPRECATE       | Same file as UC-HIGH-003.                                                                                                         |
| UC-EXP-005    | REMOVE          | Same file as UC-HIGH-004.                                                                                                         |
| UC-EXP-006    | DEPRECATE       | Same candidate as UC-MED-001.                                                                                                     |
| UC-EXP-007    | DEPRECATE       | Same candidate as UC-MED-002.                                                                                                     |
| UC-EXP-008    | REGISTER        | Same planned pipeline area as UC-MED-004.                                                                                         |
| UC-EXP-009    | REGISTER        | Same planned review area as UC-MED-005.                                                                                           |
| UC-EXP-010    | REGISTER        | Same planned source-anchor area as UC-MED-006.                                                                                    |
| UC-EXP-011    | REMOVE          | Unused frontend UI exports should be removed after approval or consolidated if UI direction changes first.                        |
| UC-REG-001    | REGISTER        | Review is an incomplete integration if the review UX remains planned.                                                             |
| UC-REG-002    | REGISTER        | Processing pipeline should wire document-processing, extraction, and source anchoring instead of leaving `PipelineNotConfigured`. |
| UC-REG-003    | MANUAL_DECISION | Scheduler topology needs a decision: standalone scheduler only, API-process scheduler, or both with clear names.                  |
| UC-REG-004    | REGISTER        | Obligation state scheduler is intentionally pending and should only be registered after implementation.                           |
| UC-REG-005    | REGISTER        | Recovery jobs should be scheduled if retained.                                                                                    |
| UC-REG-006    | MANUAL_DECISION | `DELIVER_REMINDER` is registered in the processor map but not functional; decide finish delivery or stop advertising it.          |
| UC-REG-007    | REGISTER        | Placeholder obligations/reminders/KPI controllers are incomplete integrations, not removal candidates by default.                 |
| UC-FE-001     | DEPRECATE       | Old contracts list page is unreachable from the active router.                                                                    |
| UC-FE-002     | DEPRECATE       | Old contract detail page is unreachable from the active router.                                                                   |
| UC-FE-003     | DEPRECATE       | Standalone upload page is redirected away from the active router.                                                                 |
| UC-FE-004     | DEPRECATE       | Review queue page is unreachable and backend review routes are absent.                                                            |
| UC-FE-005     | DEPRECATE       | Review detail page is unreachable and backend review routes are absent.                                                           |
| UC-FE-006     | DEPRECATE       | KPI page is unreachable and backend KPI route is a 501 placeholder.                                                               |
| UC-FE-007     | DEPRECATE       | Old obligation list page is unreachable.                                                                                          |
| UC-FE-008     | DEPRECATE       | Old obligation detail page is unreachable and backend detail route is absent.                                                     |
| UC-FE-009     | DEPRECATE       | Old contract API clients target unsupported/stale endpoints.                                                                      |
| UC-FE-010     | DEPRECATE       | Review frontend API/hooks are ahead of backend registration.                                                                      |
| UC-FE-011     | DEPRECATE       | KPI frontend API/hook are ahead of backend implementation.                                                                        |
| UC-FE-012     | DEPRECATE       | Obligation detail/mutation frontend API is ahead of backend routes.                                                               |
| UC-FE-013     | DEPRECATE       | Reminder frontend feature is unreachable and backend route is placeholder.                                                        |
| UC-FE-014     | DEPRECATE       | Old audit timeline component is not imported by active routes.                                                                    |
| UC-DEP-001    | KEEP            | No dependency removal confirmed.                                                                                                  |
| UC-DEP-002    | MANUAL_DECISION | Root `lint` script exists but no lint tooling/package scripts are present; choose add tooling or remove script.                   |
| UC-DEP-003    | KEEP            | Root-level Vitest is intentional enough for this private monorepo unless package isolation is required.                           |
| UC-DEP-004    | MANUAL_DECISION | Provider env/adapters should wait for OCR/LLM/email roadmap.                                                                      |
| UC-ENV-001    | REMOVE          | `VITE_APP_ENV` is present only in `.env.example`; no source consumer found.                                                       |
| UC-ENV-002    | MANUAL_DECISION | `APP_NAME` and `APP_BASE_URL` are parsed/docs-only; choose use in metadata/link generation or remove.                             |
| UC-ENV-003    | MANUAL_DECISION | JWT env is validated in production but no JWT middleware exists; auth roadmap decision needed.                                    |
| UC-ENV-004    | MANUAL_DECISION | Email env includes unsupported `smtp` option and no active provider factory.                                                      |
| UC-ENV-005    | KEEP            | Groq env is used by the worker obligation extraction provider when configured.                                                     |
| UC-ENV-006    | MANUAL_DECISION | OCR env depends on extraction pipeline/provider roadmap.                                                                          |
| UC-ENV-007    | MANUAL_DECISION | `STORAGE_PROVIDER=local` is accepted by schema but no local provider exists.                                                      |
| UC-MANUAL-001 | KEEP            | Public feature indexes are not removable without module-boundary decision.                                                        |
| UC-MANUAL-002 | KEEP            | Test-kit is protected test infrastructure and now has package scripts.                                                            |
| UC-MANUAL-003 | KEEP            | Datasets and working subset fixtures are protected.                                                                               |
| UC-MANUAL-004 | KEEP            | Migrations are protected historical artifacts.                                                                                    |
| UC-MANUAL-005 | MANUAL_DECISION | Generated/local artifacts may be cleaned only after explicit approval.                                                            |
| UC-MANUAL-006 | KEEP            | CLI entry points are package-script consumers.                                                                                    |
| UC-MANUAL-007 | MANUAL_DECISION | Provider adapters require roadmap decision.                                                                                       |
| UC-MANUAL-008 | MANUAL_DECISION | Old frontend clusters require product/UI direction before deletion.                                                               |
| DA-001        | CONSOLIDATE     | Obligation transition rules are exact duplicates between API and shared.                                                          |
| DA-002        | CONSOLIDATE     | Contract processing status types/schemas have drift.                                                                              |
| DA-003        | CONSOLIDATE     | State machine and repository SQL both encode processing transitions; keep SQL as atomic guard.                                    |
| DA-004        | CONSOLIDATE     | API response/error envelopes are duplicated manually.                                                                             |
| DA-005        | CONSOLIDATE     | Audit event construction/timestamps are duplicated.                                                                               |
| DA-006        | CONSOLIDATE     | Reminder scheduling and job enqueue boundary overlaps and crosses layers.                                                         |
| DA-007        | CONSOLIDATE     | Upload size/validation constants should align while keeping trust boundaries separate.                                            |
| DA-008        | DEPRECATE       | Old hooks/query models should be deprecated before route/API cleanup.                                                             |
| DA-009        | DEPRECATE       | Old UI component overlap should be deprecated until route cleanup decides canonical UI.                                           |
| DA-010        | CONSOLIDATE     | Date/time formatting and service timestamps should use canonical frontend/backend helpers.                                        |
| DA-011        | DEPRECATE       | DTO overlap should wait for review API registration before consolidation.                                                         |
| DA-012        | KEEP            | Job retry policy and domain retry errors are intentionally separate layers.                                                       |
| DA-013        | KEEP            | Migration status literals are historical and must remain separate.                                                                |
| DA-014        | KEEP            | Contract storage key and generic storage fallback have different meanings.                                                        |
| DA-015        | KEEP            | Upload PDF validation and parser sanity validation have different trust boundaries.                                               |
| DA-016        | KEEP            | Backend and frontend env parsing are different runtimes.                                                                          |
| DA-017        | KEEP            | Reminder occurrence keys and job delivery keys have distinct semantics.                                                           |
| DA-018        | KEEP            | Status badges should remain domain-specific.                                                                                      |
| DA-019        | KEEP            | Repository row mappers are domain-specific.                                                                                       |
| DA-020        | KEEP            | `SKIP LOCKED` usage has distinct repository meanings.                                                                             |
| DA-021        | CONSOLIDATE     | Reminder repository depends on job-layer keying and writes job rows.                                                              |
| DA-022        | KEEP            | No high-confidence business logic was found in controllers.                                                                       |
| DA-023        | KEEP            | No SQL was found in controllers/workers.                                                                                          |
| DA-024        | KEEP            | No repository-to-service imports found, except DA-021's job-key dependency.                                                       |
| DA-025        | KEEP            | Bootstrap files are mostly composition roots; registration gaps are tracked separately.                                           |
| DA-026        | KEEP            | No circular dependency was found by manual inspection; optional future static graph check only.                                   |

## Cleanup Batches

### Temporary and Generated Files

| Field                 | Plan                                                                                                                                                                                                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate IDs         | UC-MANUAL-005                                                                                                                                                                                                                                                                                                                                       |
| Exact changes         | After explicit approval, remove local runtime artifacts such as `.api*.pid`, `.web*.pid`, `.api*.log`, `.web*.log`, `.contract-status-body.*.log`, `.dev-connection-smoke.*.log`, and generated output directories only if they are not needed for current debugging. Do not remove datasets, migrations, source fixtures, or working-subset files. |
| Expected impact       | Cleaner worktree and less noise in future audits. No source/runtime behavior impact.                                                                                                                                                                                                                                                                |
| Verification commands | `git status --short`; `corepack pnpm run format:check`                                                                                                                                                                                                                                                                                              |
| Rollback strategy     | Restore deleted artifacts from the recycle/bin if needed or regenerate by rerunning the relevant dev/check command. No source rollback should be required.                                                                                                                                                                                          |

### High-Confidence Unused Files

| Field                 | Plan                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Candidate IDs         | UC-HIGH-001, UC-HIGH-002, UC-HIGH-004, UC-HIGH-007, UC-HIGH-008, UC-HIGH-009, UC-HIGH-010, UC-EXP-001, UC-EXP-005, UC-EXP-011                                                                                                                                                                                                                                            |
| Exact changes         | Remove `scripts/workspace-placeholder.mjs`, `apps/api/src/shared/constants/http.ts`, `apps/api/src/shared/utils/assert-unreachable.ts`, `apps/web/src/components/pdf-viewer/pdf-source-viewer.tsx`, `apps/web/src/components/feedback/confirmation-dialog.tsx`, `apps/web/src/components/ui/dialog.tsx`, and `apps/web/src/components/ui/pagination.tsx` after approval. |
| Expected impact       | Removes unreferenced source/files. No runtime impact expected because repository-wide searches found no imports, script references, dynamic imports, tests, or route registrations.                                                                                                                                                                                      |
| Verification commands | `corepack pnpm --filter @contract-obligation-tracker/api run typecheck`; `corepack pnpm --filter @contract-obligation-tracker/api run test:unit`; `corepack pnpm --filter @contract-obligation-tracker/web run typecheck`; `corepack pnpm --filter @contract-obligation-tracker/web run test`; `corepack pnpm run format:check`                                          |
| Rollback strategy     | Revert the specific deletion patch or restore the deleted files from Git.                                                                                                                                                                                                                                                                                                |

### Unused Exports

| Field                 | Plan                                                                                                                                                                                                                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate IDs         | UC-HIGH-003, UC-HIGH-005, UC-HIGH-006, UC-EXP-002, UC-EXP-003, UC-EXP-004, UC-EXP-006, UC-EXP-007                                                                                                                                                                                                                     |
| Exact changes         | Keep these as documentation-deprecated first. Later, either remove `apps/api/src/shared/types/pagination.ts`, `apps/api/src/shared/validation/id.schema.ts`, `apps/api/src/shared/middleware/validate-request.middleware.ts`, `ContractService`, and `LegacyContractRepository`, or register/adopt them deliberately. |
| Expected impact       | Reduces stale shared/API surface after approval. No immediate behavior impact while deprecation remains documentation-only.                                                                                                                                                                                           |
| Verification commands | `corepack pnpm --filter @contract-obligation-tracker/api run typecheck`; `corepack pnpm --filter @contract-obligation-tracker/api run test:unit`; `corepack pnpm run test`                                                                                                                                            |
| Rollback strategy     | Revert the removal patch. If adoption is chosen instead of removal, keep the files and add targeted route/service tests.                                                                                                                                                                                              |

### Unused Dependencies

| Field                 | Plan                                                                                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate IDs         | UC-DEP-001, UC-DEP-003, UC-DEP-004                                                                                                                                                                                            |
| Exact changes         | Do not remove dependencies in the first cleanup batch. Keep current dependency declarations. For provider dependencies, avoid adding OCR/LLM/email packages until provider factories are implemented and selected at runtime. |
| Expected impact       | Prevents dependency churn while provider and package-isolation decisions are unsettled.                                                                                                                                       |
| Verification commands | `corepack pnpm run typecheck`; `corepack pnpm run test`; `corepack pnpm run test:kpi`; `corepack pnpm run format:check`                                                                                                       |
| Rollback strategy     | If later dependency edits cause lockfile churn or failures, revert `package.json` and `pnpm-lock.yaml` changes together and rerun `corepack pnpm install`.                                                                    |

### Obsolete Scripts and Configuration

| Field                 | Plan                                                                                                                                                                                                                                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate IDs         | UC-DEP-002, UC-ENV-001, UC-ENV-002, UC-ENV-003, UC-ENV-004, UC-ENV-005, UC-ENV-006, UC-ENV-007                                                                                                                                                                                                                                                              |
| Exact changes         | Remove `VITE_APP_ENV` from `.env.example` after approval or wire it into web config. For root `lint`, choose one path: add actual lint tooling/package scripts, or remove/replace the root script. For `APP_NAME`, `APP_BASE_URL`, JWT, email, OCR, and `STORAGE_PROVIDER=local`, make an architecture decision before editing schema/example docs. Keep Groq env for obligation extraction. |
| Expected impact       | Avoids misleading local configuration and script failures. Provider/auth variables remain protected until roadmap decisions are made.                                                                                                                                                                                                                       |
| Verification commands | `corepack pnpm --filter @contract-obligation-tracker/api run typecheck`; `corepack pnpm --filter @contract-obligation-tracker/api run test:unit`; `corepack pnpm --filter @contract-obligation-tracker/web run typecheck`; `corepack pnpm --filter @contract-obligation-tracker/web run test`; `corepack pnpm run format:check`                             |
| Rollback strategy     | Revert `.env.example`, env schema, and package script edits together. If dependencies are added for linting, revert `package.json` and `pnpm-lock.yaml` together.                                                                                                                                                                                           |

### Duplicate Implementation Consolidation

| Field                 | Plan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate IDs         | DA-001, DA-002, DA-003, DA-004, DA-005, DA-006, DA-007, DA-010, DA-021, UC-MED-015                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Exact changes         | In separate PR-sized batches: use shared obligation state-machine rules in API while preserving `InvalidTransitionError`; centralize contract processing statuses; validate intended processing transitions before repository calls while keeping SQL guards; centralize API response/error helpers; add typed audit-event builders and transaction-aware append; define the reminder scheduler/job enqueue boundary; align upload limits/config; route frontend date formatting through the date utility and backend timestamps through `Clock` where business-owned. |
| Expected impact       | Reduces drift and clarifies ownership without changing domain behavior. Some changes affect active upload, worker, scheduler, and frontend workflow paths, so they should not be bundled with removals.                                                                                                                                                                                                                                                                                                                                                                |
| Verification commands | `corepack pnpm --filter @contract-obligation-tracker/api run typecheck`; `corepack pnpm --filter @contract-obligation-tracker/api run test:unit`; `corepack pnpm --filter @contract-obligation-tracker/api run test:integration`; `corepack pnpm --filter @contract-obligation-tracker/web run typecheck`; `corepack pnpm --filter @contract-obligation-tracker/web run test`; `corepack pnpm run build`                                                                                                                                                               |
| Rollback strategy     | Revert each consolidation batch independently. Preserve old tests until the replacement path is covered, then remove obsolete tests only in the same batch as the obsolete implementation.                                                                                                                                                                                                                                                                                                                                                                             |

### Registration Fixes

| Field                 | Plan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate IDs         | UC-MED-003, UC-MED-004, UC-MED-005, UC-MED-006, UC-MED-007, UC-MED-011, UC-MED-012, UC-MED-013, UC-MED-014, UC-REG-001, UC-REG-002, UC-REG-003, UC-REG-004, UC-REG-005, UC-REG-006, UC-REG-007                                                                                                                                                                                                                                                                                                 |
| Exact changes         | Implement and register review routes only if review remains in scope; replace `PipelineNotConfigured` with a real document-processing/extraction/source-anchor pipeline; decide scheduler topology before changing `registerSchedulers`; wire notification provider selection before enabling reminder delivery; register recovery jobs as scheduled maintenance if retained; implement repository-backed obligations/reminders/KPI controllers before advertising those routes as functional. |
| Expected impact       | Converts incomplete integrations into working runtime paths. This is functional product work, not dead-code cleanup.                                                                                                                                                                                                                                                                                                                                                                           |
| Verification commands | `corepack pnpm --filter @contract-obligation-tracker/api run typecheck`; `corepack pnpm --filter @contract-obligation-tracker/api run test:unit`; `corepack pnpm --filter @contract-obligation-tracker/api run test:integration`; `corepack pnpm --filter @contract-obligation-tracker/web run typecheck`; `corepack pnpm --filter @contract-obligation-tracker/web run test`; `corepack pnpm run build`                                                                                       |
| Rollback strategy     | Revert each registration batch and keep placeholder 501 behavior until the replacement route/worker is fully tested. For scheduler topology, revert bootstrap and package-script changes together.                                                                                                                                                                                                                                                                                             |

### Architecture Corrections

| Field                 | Plan                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Candidate IDs         | DA-008, DA-009, DA-011, DA-012, DA-013, DA-014, DA-015, DA-016, DA-017, DA-018, DA-019, DA-020, DA-022, DA-023, DA-024, DA-025, DA-026                                                                                                                                                                                                     |
| Exact changes         | Keep intentionally separate logic from DA-012 through DA-020 and DA-022 through DA-026 unless new evidence appears. Deprecate old frontend hooks/UI and review DTO overlap before route cleanup. Add an optional temporary static import graph check later if circular dependencies become suspected; no tool was installed in this phase. |
| Expected impact       | Prevents over-consolidation of domain-specific logic and documents which duplicate-looking code should stay separate.                                                                                                                                                                                                                      |
| Verification commands | `corepack pnpm run typecheck`; `corepack pnpm run test`; `corepack pnpm run build`; `corepack pnpm run format:check`                                                                                                                                                                                                                       |
| Rollback strategy     | Documentation-only corrections can be reverted directly. Any later source architecture changes should be isolated by domain and reverted independently.                                                                                                                                                                                    |

## Approval Required Before Destructive Changes

These candidate IDs require explicit approval before deletion, dependency removal, or behavior-changing refactor:

- REMOVE: UC-HIGH-001, UC-HIGH-002, UC-HIGH-004, UC-HIGH-007, UC-HIGH-008, UC-HIGH-009, UC-HIGH-010, UC-EXP-001, UC-EXP-005, UC-EXP-011, UC-ENV-001.
- DEPRECATE-first, then later approval for removal or replacement: UC-HIGH-003, UC-HIGH-005, UC-HIGH-006, UC-MED-001, UC-MED-002, UC-MED-016, UC-EXP-002, UC-EXP-003, UC-EXP-004, UC-EXP-006, UC-EXP-007, UC-FE-001, UC-FE-002, UC-FE-003, UC-FE-004, UC-FE-005, UC-FE-006, UC-FE-007, UC-FE-008, UC-FE-009, UC-FE-010, UC-FE-011, UC-FE-012, UC-FE-013, UC-FE-014, DA-008, DA-009, DA-011.
- CONSOLIDATE or REGISTER before removal can be considered: UC-MED-003, UC-MED-004, UC-MED-005, UC-MED-006, UC-MED-007, UC-MED-011, UC-MED-012, UC-MED-013, UC-MED-014, UC-MED-015, UC-REG-001, UC-REG-002, UC-REG-003, UC-REG-004, UC-REG-005, UC-REG-006, UC-REG-007, DA-001, DA-002, DA-003, DA-004, DA-005, DA-006, DA-007, DA-010, DA-021.
- MANUAL_DECISION: UC-MED-008, UC-MED-009, UC-MED-010, UC-DEP-002, UC-DEP-004, UC-ENV-002, UC-ENV-003, UC-ENV-004, UC-ENV-005, UC-ENV-006, UC-ENV-007, UC-MANUAL-005, UC-MANUAL-007, UC-MANUAL-008.

## Implementation Report - Approved Cleanup 2026-07-21

### Approved Candidate IDs

The user explicitly approved only:

- UC-HIGH-001
- UC-HIGH-002
- UC-HIGH-004
- UC-HIGH-008
- UC-HIGH-009
- UC-HIGH-010
- UC-ENV-001

No other cleanup candidates were modified.

### Files Removed

| Candidate ID | Removed path                                               | Result   |
| ------------ | ---------------------------------------------------------- | -------- |
| UC-HIGH-001  | `scripts/workspace-placeholder.mjs`                        | Removed. |
| UC-HIGH-002  | `apps/api/src/shared/constants/http.ts`                    | Removed. |
| UC-HIGH-004  | `apps/api/src/shared/utils/assert-unreachable.ts`          | Removed. |
| UC-HIGH-008  | `apps/web/src/components/feedback/confirmation-dialog.tsx` | Removed. |
| UC-HIGH-009  | `apps/web/src/components/ui/dialog.tsx`                    | Removed. |
| UC-HIGH-010  | `apps/web/src/components/ui/pagination.tsx`                | Removed. |

### Configuration Updated

| Candidate ID | Updated path   | Result                                                                                                                                                              |
| ------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UC-ENV-001   | `.env.example` | Removed only `VITE_APP_ENV=local`. Existing adjacent `VITE_DEV_ORGANIZATION_ID` and `VITE_DEV_USER_ID` lines were preserved. No secret values were read or exposed. |

### Dependencies Removed

None. No dependency-removal candidate was approved.

### Duplicate Implementations Consolidated

None. No DA consolidation candidate was approved in this cleanup pass.

### Files Retained and Reasons

| Candidate ID                                                               | Path or area retained                                      | Reason                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| UC-HIGH-007                                                                | `apps/web/src/components/pdf-viewer/pdf-source-viewer.tsx` | Not approved for removal.                                                                                                                                                                                                                        |
| UC-EXP-001, UC-EXP-005, UC-EXP-011                                         | Export-level companion candidates                          | Not explicitly approved. The approved file-level removals cover `jsonContentType`, `assertUnreachable`, `ConfirmationDialog`, `Dialog`, and shared UI `Pagination`; `PdfSourceViewer` remains because its file-level candidate was not approved. |
| All DEPRECATE, CONSOLIDATE, REGISTER, KEEP, and MANUAL_DECISION candidates | Multiple paths                                             | Not approved for this pass.                                                                                                                                                                                                                      |
| `packages/database/migrations/*`                                           | Migration history                                          | Applied migration history must not be rewritten. No migration files were edited.                                                                                                                                                                 |

### Registration Fixes

None. No registration candidate was approved. Existing registration state remains unchanged:

- Contract routes are mounted at `/api/v1/contracts`.
- Worker registry reports `PROCESS_CONTRACT`.
- Scheduler registry reports an empty `names` list.

### Baseline Results Before Approved Cleanup

Recorded before candidate edits:

| Check                    | Command                                                                        | Result                                                                               |
| ------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Git status               | `git status --short`                                                           | Dirty worktree with existing unrelated source/config changes and untracked files.    |
| TypeScript type checking | `corepack pnpm run typecheck`                                                  | Passed.                                                                              |
| Lint                     | `corepack pnpm run lint`                                                       | Passed, but effectively no-op because workspace packages do not define lint scripts. |
| Unit/root tests          | `corepack pnpm run test`                                                       | Passed. API integration files were skipped in the root run.                          |
| Integration tests        | `corepack pnpm --filter @contract-obligation-tracker/api run test:integration` | Passed with 2 files / 6 tests skipped.                                               |
| Backend/frontend build   | `corepack pnpm run build`                                                      | Passed.                                                                              |

### Batch Results

| Batch                          | Candidate IDs                                                                | Result                                                               | Targeted verification                                                                |
| ------------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| High-confidence unused files   | UC-HIGH-001, UC-HIGH-002, UC-HIGH-004, UC-HIGH-008, UC-HIGH-009, UC-HIGH-010 | Approved files removed. No imports or registrations needed updating. | API typecheck passed; web typecheck passed; API unit tests passed; web tests passed. |
| Obsolete scripts/configuration | UC-ENV-001                                                                   | `VITE_APP_ENV` removed from `.env.example`.                          | Cleanup-specific `rg` scan found no remaining non-doc references.                    |

### Final Verification Results After Approved Cleanup

| Check                             | Command or method                                                                                          | Result                                                                                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript type checking          | `corepack pnpm run typecheck`                                                                              | Passed.                                                                                                                                                             |
| Lint                              | `corepack pnpm run lint`                                                                                   | Passed, but still effectively no-op because workspace packages do not define lint scripts.                                                                          |
| Unit/root tests                   | `corepack pnpm run test`                                                                                   | Passed: API 48 tests passed with 6 skipped integration tests; web 10 tests passed; shared/test-kit had no test files and exited successfully.                       |
| Integration tests                 | `corepack pnpm --filter @contract-obligation-tracker/api run test:integration`                             | Passed with all 6 integration tests skipped.                                                                                                                        |
| Backend build                     | `corepack pnpm run build`                                                                                  | Passed through the app build script.                                                                                                                                |
| Frontend build                    | `corepack pnpm run build`                                                                                  | Passed through the app build script; Vite emitted production assets.                                                                                                |
| Format check                      | `corepack pnpm run format:check`                                                                           | Failed on 15 pre-existing/unapproved files after formatting this cleanup plan. The remaining warnings do not include `docs/repository-audit/04-cleanup-plan.md`.    |
| Migration validation              | `git diff --name-only -- packages/database/migrations`; migration directory listing                        | No tracked migration diffs. No migration runner script exists in the repository. The untracked `202607210002_*` migration pair was not modified.                    |
| API startup                       | Built API started with `API_PORT=3101` using `node dist/src/server.js`                                     | Passed. Temporary process was stopped; no listener remained on port 3101.                                                                                           |
| `/health` smoke test              | `GET http://127.0.0.1:3101/health`                                                                         | Passed: returned `success: true`, `status: ok`, `service: contract-obligation-tracker-api`.                                                                         |
| Existing `/health` smoke check    | `GET http://127.0.0.1:3000/health`                                                                         | Passed against an existing listener. A first attempt to start on port 3000 failed with `EADDRINUSE`, so the isolated startup smoke used port 3101.                  |
| Contract route registration check | Source registration in `apps/api/src/bootstrap/register-routes.ts`                                         | Passed: `/api/v1/contracts` uses `createContractRouter()`.                                                                                                          |
| Worker registry check             | `apps/api/tests/unit/register-workers.test.ts`; `apps/api/src/bootstrap/register-workers.ts`               | Passed in unit tests; source still reports `names: ["PROCESS_CONTRACT"]` and maps `PROCESS_CONTRACT` plus `DELIVER_REMINDER` in the processor registry.             |
| Scheduler registry check          | `apps/api/src/bootstrap/register-schedulers.ts`                                                            | Unchanged: source returns `names: []`. No scheduler registration fix was approved.                                                                                  |
| Unused-code scan                  | `rg` for removed symbols/paths excluding `docs/repository-audit`, `node_modules`, `.git`, and build output | Passed: no non-doc references found for removed symbols/paths or `VITE_APP_ENV`.                                                                                    |
| Git diff inspection               | `git diff --name-status`; `git diff --stat`                                                                | Cleanup-specific changes are the approved deletions and `.env.example` line removal. Other source/config diffs were pre-existing unrelated work and were preserved. |

### Unresolved Risks

- The worktree remains dirty with unrelated source/config changes and untracked files. This cleanup intentionally preserved them.
- Root `lint` still has no package-level lint work to execute.
- Repository-wide `format:check` still fails on pre-existing/unapproved files. The edited cleanup plan was formatted with Prettier; unrelated files were not reformatted.
- API integration tests are configured but skipped without the required integration environment.
- Port 3000 was already occupied during smoke testing. The isolated API startup was verified on port 3101.
- No migration runner exists, so migration validation is limited to confirming no tracked migration diff and no edits to migration files in this cleanup pass.

### Rollback Instructions

To roll back only this approved cleanup, restore these deleted files and the `.env.example` line from Git:

- `scripts/workspace-placeholder.mjs`
- `apps/api/src/shared/constants/http.ts`
- `apps/api/src/shared/utils/assert-unreachable.ts`
- `apps/web/src/components/feedback/confirmation-dialog.tsx`
- `apps/web/src/components/ui/dialog.tsx`
- `apps/web/src/components/ui/pagination.tsx`
- `.env.example` line `VITE_APP_ENV=local`

Do not use a broad reset because the repository contains unrelated uncommitted work. Revert only the cleanup patch or restore the listed paths selectively.

### Behavior Changes

No runtime behavior change is expected. Removed files were unreferenced by source, tests, package scripts, runtime registrations, and non-doc scans. The `.env.example` change removes an unused example-only frontend variable.
