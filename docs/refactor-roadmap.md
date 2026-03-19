# X Dragon Refactor Roadmap

## Purpose
This is the working plan for splitting the current single Next.js app into:

1. a public website app
2. a reusable back office app
3. shared packages that can support multiple brands safely

This roadmap is intentionally incremental. We do not change layout/design unless explicitly approved.

## Current reality
- The repo is one Pages Router app serving both marketing and admin/resource flows.
- Public brand content, host rules, auth rules, and admin behavior are still coupled.
- The current schema is single-tenant. There is no brand/site dimension yet.
- The staging blockers are `/api/chat`, `/api/contact`, favicon, and final QA discipline.

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

Tasks:
- add `Brand` and related scoping to content/leads/auth-facing data
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

## Immediate recommendations
1. Do not split repos yet. First remove coupling inside the current codebase so the split is mechanical, not speculative.
2. Introduce brand/tenant scoping before claiming the back office is reusable. Without it, a second brand will contaminate content and lead data.
3. Restore SSR/SSG for the public site after hydration bugs are fixed at the component level. A JS-only marketing home page is not production-grade.
4. Remove global public concerns from `_app` for admin/resources routes. That is a hard boundary violation.

## Definition of done for every refactor ticket
- no layout/design drift
- clear boundary improved
- env contract unchanged or documented
- QA expectations updated if behavior changed
- deployment path through `staging` still valid
