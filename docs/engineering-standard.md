# Engineering Standard

## Purpose
This is the working standard for every X Dragon change until the public site and reusable back office split is complete.

## Core rules
1. No visual/layout changes unless explicitly approved.
2. No direct pushes to `main` or `staging`.
3. Every production-affecting change must pass through staging.
4. Preview and Production envs are separate deployable contracts.
5. Reusable layers must not hardcode X Dragon domains, host pairs, or brand copy.

## Boundary rules
### Public website
- owns marketing layout, brand copy, assets, chat, contact, and public conversion flows
- can depend on brand config
- must not own reusable admin logic

### Back office
- owns admin shell, content operations, lead management, analytics, and role-based access
- must not render public-site widgets or depend on public marketing components
- must become brand-aware, not brand-hardcoded

### Shared code
- only put code in shared space if both apps need it
- shared packages cannot import from app folders
- shared contracts must be typed and validation-first

## Data rules
1. Any reusable content or lead data must be scoped to a brand/site.
2. New tables/features must define tenancy before they are considered reusable.
3. Prisma changes require an explicit migration and rollback thought process.
4. Never edit an already-applied migration to repair history. Restore missing migration directories or add forward fixes with idempotent SQL.
5. Backoffice users and external users must not be modeled as one credential domain once the brand migration begins.
6. `brandId` is internal only; external-safe references should use `brandKey`.

## Runtime rules
1. Public API handlers must return structured JSON on failure.
2. Do not instantiate env-sensitive clients at module scope for public-facing handlers when missing envs would crash the route.
3. Request identity logic must stay centralized.
4. Auth/session shape must be normalized in one place and consumed consistently.
5. Host/domain routing rules must flow through shared site config, not be duplicated across pages and middleware.
6. If a lead is durably captured, notification failures should degrade to deferred follow-up rather than user-visible loss.
7. Public brand context must resolve from host server-side; client-sent brand identifiers are cross-checks only.
8. Brand-specific email flows must fail safely and must not fall back across brands.
9. Protected bootstrap superadmin provisioning must be explicit, env-driven, and idempotent; deploy startup must not silently rotate protected-account credentials.

## Deployment rules
1. `feature/*` -> PR -> `staging` -> QA -> PR -> `main`
2. Verify Vercel branch, commit SHA, env scope, and domain mapping after each merge.
3. Sync `main` back into `staging` after production release.

## Review checklist
- Does this change increase or reduce public/admin coupling?
- Does this add a new brand-specific assumption to reusable code?
- Does this preserve staging/prod isolation?
- Does this create a multi-brand data problem later?
- Does this change need QA steps or env documentation updates?
- Does this mix backoffice and external identity concerns that should stay separate?
- Does this trust client-provided brand context where host/session validation should be authoritative?

## Minimum QA for user-facing changes
- public landing page loads correctly
- admin sign-in and redirect flow still work
- resource auth flow still works
- chat/contact return expected success or structured failure messages
- favicon and core brand assets load on staging

## Stop conditions
Stop and clarify before merging if a change:
- alters layout/design unexpectedly
- changes auth/cookie/domain behavior across environments
- adds multi-brand implications without a tenancy plan
- hides a broken env contract behind silent failures

## Reference docs
- [`docs/refactor-roadmap.md`](./refactor-roadmap.md)
- [`docs/brand-context-and-identity-contract.md`](./brand-context-and-identity-contract.md)
- [`docs/bootstrap-superadmin-provisioning.md`](./bootstrap-superadmin-provisioning.md)
- [`docs/schema-split-and-migration-plan.md`](./schema-split-and-migration-plan.md)
