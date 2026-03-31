# Remaining Original-Spec Checklist

This is the strict ordered list of the major work still required to satisfy the original refactor brief. It is intentionally ordered by dependency, not convenience.

## Completed Foundations
- authoritative database brand registry
- live brand-scoped email config
- protected bootstrap superadmin provisioning and recovery tooling

## 1. Split the current platform into separate public-site and backoffice repos
Why first:
- The clarified requirement is two fundamentally separate projects, not one repo with two apps.
- The remaining reusable-product work should not be built on one shared Pages Router deployment or shared runtime forever.

Exit criteria:
- `xdragon-site` and `command` exist as separate repos
- `command` admin UI and service/API are clearly separated modules/apps
- public websites integrate through documented APIs and a BFF/proxy layer instead of shared runtime code
- OpenAPI is the source of truth for the integration contract

Current implementation docs:
- [`docs/repo-split-and-service-contract.md`](./repo-split-and-service-contract.md)
- [`docs/command-public-api-contract.md`](./command-public-api-contract.md)
- [`docs/command-bff-session-forwarding-contract.md`](./command-bff-session-forwarding-contract.md)
- [`docs/command-repo-skeleton-and-bff-extraction-plan.md`](./command-repo-skeleton-and-bff-extraction-plan.md)

## 2. Extract X Dragon-specific assumptions out of the reusable backoffice
Why second:
- A separated `command` repo is not yet redistributable if it still assumes X Dragon naming, bootstrap behavior, or content conventions.

Exit criteria:
- reusable backoffice modules no longer depend on X Dragon domains, branding, or copy
- brand/site-specific assets and settings live outside reusable core modules
- new brands can be added without code edits in reusable backoffice logic

## 3. Package the backoffice installation and onboarding workflow
Why third:
- The original goal is a repackagable backoffice product, not just a cleaner internal app.
- Installation and provisioning need to be explicit before this can be reused safely.

Exit criteria:
- documented install/bootstrap workflow for a new deployment
- required env contract per app is explicit
- seed/provision scripts exist for first brand setup
- a first-run setup page or equivalent guided install flow exists for initial users and base system information
- onboarding a second installation is configuration-driven, not engineer-driven

## 4. Final maintainability and production-hardening cleanup
Why last:
- The original brief explicitly called for consistency, reliability, and maintainability.
- The structural work above should land before destructive cleanup or secondary optimizations.

Exit criteria:
- remaining legacy/transitional code paths are removed
- migration and seed discipline are documented and enforced
- reporting/metrics no longer depend on transitional compatibility logic
- release QA, staging/prod DB steps, and recovery procedures are explicit

Progress already made:
- `xdragon-site` brand management, dashboard metrics, and client account admin surfaces are retired in favor of `command`
- the transitional `ExternalUser.legacyUserId` bridge to legacy `User` rows is removed after those retirements
- the remaining `xdragon-site` analytics and login-geo backfill admin surface is retired in favor of `command`
- the shared legacy auth domain (`User`, `Account`, `Session`, verification/reset tokens, and `LoginEvent`) is removed from the active schema

## Not Core Original-Spec Items
These are valid backlog items, but they are not ahead of the checklist above:
- partner accounts
- brand-level MFA policy
- permissions v2 beyond current role + brand-access model
