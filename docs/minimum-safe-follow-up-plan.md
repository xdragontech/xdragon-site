# Minimum-Safe Follow-Up Plan

## Purpose
This is the next refactor pass after Phase 1 stabilization. It is intentionally narrow: improve separation and reuse without opening a repo split or design rewrite too early.

## What not to do yet
- Do not split into multiple repos.
- Do not move to a monorepo until internal boundaries are proven.
- Do not add a second brand to production data before tenancy exists.
- Do not reintroduce optional infra as a hard dependency.

## Priority order
### 1. Lock the runtime contract
Goal:
- production and preview behave the same for failure handling and host routing

Tasks:
- document env parity rules for Preview vs Production
- keep chat/contact failure modes structured and non-fatal where infra is optional
- make production smoke checks part of every user-facing release

Exit criteria:
- no raw HTML 500s for chat/contact caused by optional infra
- env expectations are documented and reviewed during rollout

### 2. Strengthen the public vs backoffice boundary inside the current app
Goal:
- the eventual split becomes mechanical rather than architectural guesswork

Tasks:
- group public-only composition under a public shell boundary
- group admin/resources/auth composition under a backoffice shell boundary
- move shared request/env/host helpers into reusable utilities only where both sides need them
- add import discipline so public components do not leak into admin paths

Exit criteria:
- `_app` no longer acts as a mixed public/admin composition layer
- shared code has a clear reason to exist

### 3. Replace single-brand assumptions with a real brand registry shape
Goal:
- support multiple brands without editing routing/auth code for every rollout

Tasks:
- evolve [`lib/siteConfig.ts`](/Users/grantr/Projects/xdragon-site/lib/siteConfig.ts) from one brand config to a registry-oriented interface
- resolve brand/site from host in one place
- remove remaining X Dragon assumptions from reusable auth and routing layers

Exit criteria:
- routing/auth code depends on config lookup, not hardcoded host pairs
- adding a second brand becomes a config exercise, not a middleware rewrite

### 4. Design tenancy before extraction
Goal:
- prevent cross-brand data contamination

Tasks:
- define `Brand` and/or `Site` ownership for leads, lead events, prompts, guides, articles, and categories
- define how admin access maps to one or more brands
- write the migration plan before touching extraction work

Exit criteria:
- the target Prisma model is reviewed before implementation
- backoffice queries can become brand-aware by default

## Recommended next tickets
1. Create public/backoffice shell boundaries without changing layout.
2. Convert `siteConfig` into a registry-based API with one existing X Dragon brand entry.
3. Draft the multi-brand Prisma schema and migration plan in a design doc before code changes.
4. Add a production smoke command path using the existing staging script inputs.

## Definition of done for the next pass
- no visual drift
- no direct dependency from reusable code to X Dragon brand details
- no new env ambiguity between Preview and Production
- each PR improves one boundary with explicit QA steps
