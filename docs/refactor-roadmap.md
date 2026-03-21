# X Dragon Refactor Roadmap

## Purpose
This is the working plan for splitting the current X Dragon platform into:

1. a brand-specific public website repo
2. a reusable back office repo
3. a versioned service contract between them

This roadmap is intentionally incremental. We do not change layout/design unless explicitly approved.

## Companion docs
- [`docs/engineering-standard.md`](./engineering-standard.md)
- [`docs/repo-split-and-service-contract.md`](./repo-split-and-service-contract.md)
- [`docs/command-public-api-contract.md`](./command-public-api-contract.md)
- [`docs/command-bff-session-forwarding-contract.md`](./command-bff-session-forwarding-contract.md)
- [`docs/brand-context-and-identity-contract.md`](./brand-context-and-identity-contract.md)
- [`docs/brand-email-bootstrap-workflow.md`](./brand-email-bootstrap-workflow.md)
- [`docs/bootstrap-superadmin-provisioning.md`](./bootstrap-superadmin-provisioning.md)
- [`docs/bootstrap-superadmin-workflow.md`](./bootstrap-superadmin-workflow.md)
- [`docs/schema-split-and-migration-plan.md`](./schema-split-and-migration-plan.md)
- [`docs/remaining-original-spec-checklist.md`](./remaining-original-spec-checklist.md)

## Current reality
- The repo is one Pages Router app serving both marketing and admin/resource flows.
- Brand, host, identity, and bootstrap foundations now exist in the database and runtime.
- Public and backoffice auth are separated, but the repo is still one deployable application and one codebase.
- The real target is no longer “one repo, two apps.” It is “two repos with a stable service contract.”
- Recent stabilization work resolved the immediate chat/contact deployment failures.
- The next structural blocker is the repo split and service-contract definition.

## Non-negotiable guardrails
- No direct pushes to `main` or `staging`.
- Use feature branches and PRs only.
- Do not change visual design/layout without approval.
- Production and Preview envs are separate contracts and must be checked separately.
- Reusable back office code must not depend on X Dragon domain names, branding, or public-site widgets.

## Target architecture
### Repos
- `xdragon-site`
  - brand-specific public website
  - public authenticated user UI
  - BFF/proxy integration layer to `command`
  - brand-specific layout, theme, copy, and assets
- `command`
  - admin UI module/app
  - public API module/app
  - shared core packages for data, auth, brand runtime, and service contracts

### Shared contract
- OpenAPI is the source of truth
- human docs layer on top of OpenAPI
- integration credential and forwarded user session remain separate trust layers

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

### Phase 3: Split into separate repos with a stable service contract
Exit criteria:
- `xdragon-site` and `command` exist as separate repos
- `command` admin UI and API are separate modules/apps
- `xdragon-site` integrates through documented APIs instead of shared runtime code

Tasks:
- define the initial service contract before moving repos
- extract `command` first because the admin/API ownership boundary is the cleanest reusable seam
- keep `/auth`, `/tools`, `/prompts`, and `/guides` with the public website; they are brand-user surfaces, not reusable backoffice surfaces
- preserve the current Git/Vercel workflow while the X Dragon install is being separated

### Phase 4: Package the back office installation and onboarding flow
Exit criteria:
- a new install can be provisioned mostly through config and seeded data
- brand-specific assets/copy are outside reusable back office modules
- onboarding a second install does not require code edits in core modules

Tasks:
- define install/bootstrap checklist
- define required env contract for `xdragon-site` and `command`
- define extension points for content types, lead flows, and admin modules
- define a first-run setup page for new installs to collect initial users and base system information

## Immediate recommendations
1. Treat the next split ticket as a repo/service-contract ticket, not a pathname extraction ticket.
2. Freeze the initial `command` API surface before moving runtime into a new repo.
3. Keep `/auth`, `/tools`, `/prompts`, and `/guides` with the public website. They are external-user surfaces, not reusable backoffice surfaces.
4. Separate public and backoffice auth route/config ownership before repo extraction. Reusing the current combined auth route would preserve the wrong coupling.
5. Keep the v1 public API narrow: auth, account, and resources first. Do not freeze admin or speculative service surfaces into the first contract.

## Definition of done for every refactor ticket
- no layout/design drift
- clear boundary improved
- env contract unchanged or documented
- QA expectations updated if behavior changed
- deployment path through `staging` still valid
