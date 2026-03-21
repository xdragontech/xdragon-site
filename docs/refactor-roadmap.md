# X Dragon Refactor Roadmap

## Purpose
This is the working plan for splitting the current single Next.js app into:

1. a public website app
2. a reusable back office app
3. shared packages that can support multiple brands safely

This roadmap is intentionally incremental. We do not change layout/design unless explicitly approved.

## Companion docs
- [`docs/engineering-standard.md`](./engineering-standard.md)
- [`docs/brand-context-and-identity-contract.md`](./brand-context-and-identity-contract.md)
- [`docs/brand-email-bootstrap-workflow.md`](./brand-email-bootstrap-workflow.md)
- [`docs/bootstrap-superadmin-provisioning.md`](./bootstrap-superadmin-provisioning.md)
- [`docs/bootstrap-superadmin-workflow.md`](./bootstrap-superadmin-workflow.md)
- [`docs/schema-split-and-migration-plan.md`](./schema-split-and-migration-plan.md)
- [`docs/remaining-original-spec-checklist.md`](./remaining-original-spec-checklist.md)

## Current reality
- The repo is one Pages Router app serving both marketing and admin/resource flows.
- Brand, host, and identity foundations now exist in the database and runtime.
- Public and backoffice auth are separated, but the repo is still one deployable application.
- Brand-scoped runtime and service behavior are not fully complete until database host routing and brand email config are fully authoritative.
- Recent stabilization work resolved the immediate chat/contact deployment failures.
- The next structural blockers are authoritative DB brand runtime, brand-scoped service config, and the real app split.

## Non-negotiable guardrails
- No direct pushes to `main` or `staging`.
- Use feature branches and PRs only.
- Do not change visual design/layout without approval.
- Production and Preview envs are separate contracts and must be checked separately.
- Reusable back office code must not depend on X Dragon domain names, branding, or public-site widgets.

## Target architecture
### Apps
- `apps/public-site`
  - marketing pages
  - chat/contact/public forms
  - brand-specific layout, theme, copy, assets
- `apps/backoffice`
  - admin shell
  - user/admin operations
  - content management
  - analytics/leads
- `packages/shared-data`
  - Prisma schema, data access, migrations
- `packages/shared-auth`
  - session/auth helpers, host-safe redirect rules, guards
- `packages/shared-contracts`
  - validation, DTOs, API contracts
- `packages/shared-ui`
  - only primitives that are genuinely shared
- `packages/brand-config`
  - brand registry, domains, asset references, feature flags

## Phase plan
### Phase 0: Stabilize staging and lock standards
Exit criteria:
- `/api/chat` returns structured JSON failures
- `/api/contact` env contract is verified in Preview
- favicon is correct on staging
- QA checklist is completed before prod promotion

Tasks:
- remove handler failure modes caused by missing envs at module load
- document env contract and QA checklist
- stop adding tactical fixes without a documented reason

### Phase 1: Create a clean boundary inside the current repo
Exit criteria:
- public-only code, admin-only code, and shared code are separated by directory and import rules
- no public widget/code is mounted globally into admin pages
- brand strings/domains are pulled behind config instead of hardcoded in reusable layers

Tasks:
- introduce `brand-config` shape inside the existing app first
- move request identity, env parsing, API helpers, and auth guards into shared utilities
- isolate public website composition from admin/resources layouts

### Phase 2: Add multi-brand data model before extraction
Exit criteria:
- content, leads, and analytics are scoped to a brand/site
- admin permissions can resolve brand access explicitly
- no global content tables remain for reusable back office features
- backoffice identities and external identities are no longer modeled as one shared user domain

Tasks:
- add `Brand` and related scoping to content/leads/auth-facing data
- split backoffice and external identity models according to the contract doc
- follow the additive migration sequence in the schema split plan before any destructive cleanup
- define migration plan for current X Dragon data
- make back office queries brand-aware by default

### Phase 3: Split into separate apps in one repo
Exit criteria:
- public site and back office can deploy independently
- shared packages own common logic
- host routing no longer depends on one app handling both domains

Tasks:
- convert to a monorepo only after the internal boundaries are proven
- move public app first or back office first based on lower-risk extraction seam
- preserve current Vercel/Git workflow during the split

### Phase 4: Package the back office for reuse
Exit criteria:
- a new brand can be provisioned mostly through config and seeded data
- brand-specific assets/copy are outside the reusable back office
- onboarding a second site does not require code edits in core back office modules

Tasks:
- define brand bootstrap checklist
- define required env contract per app
- define extension points for content types, lead flows, and admin modules
- define a first-run setup page for new installs to collect initial users and base system information

## Immediate recommendations
1. Make the database brand registry authoritative before any further packaging work. Runtime host fallback is incompatible with a reusable multi-brand backoffice.
2. Make brand-scoped email config live before calling the platform multi-brand complete. Global email config still leaks single-brand assumptions.
3. Formalize the protected bootstrap superadmin/install flow before packaging work. Reuse is not safe while bootstrap and recovery behavior are still implicit.
4. Split the public and backoffice apps only after the remaining shared runtime truth is database-driven. That keeps the extraction mechanical instead of speculative.

## Definition of done for every refactor ticket
- no layout/design drift
- clear boundary improved
- env contract unchanged or documented
- QA expectations updated if behavior changed
- deployment path through `staging` still valid
