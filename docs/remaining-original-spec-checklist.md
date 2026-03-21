# Remaining Original-Spec Checklist

This is the strict ordered list of the major work still required to satisfy the original refactor brief. It is intentionally ordered by dependency, not convenience.

## 1. Make the database brand registry authoritative
Why first:
- The backoffice cannot become reusable while runtime brand and host resolution can still drift from database state.
- Brand/host truth has to be stable before the codebase split or packaging work is safe.

Exit criteria:
- public and admin host routing resolves from `Brand` and `BrandHost` only
- runtime no longer falls back to env host config
- saving invalid or conflicting host config is rejected clearly
- operators can verify live host resolution from the backoffice

## 2. Make brand-scoped email config live
Why second:
- Multi-brand support is incomplete while auth/contact email still depends on global service config.
- This is the next hard requirement from the original spec after brand-aware routing.

Exit criteria:
- signup, verify-email, reset-password, and contact email use `BrandEmailConfig`
- email-dependent flows block cleanly when a brand is not configured
- preview and production can be validated per brand without global sender ambiguity

## 3. Formalize protected bootstrap superadmin provisioning
Why third:
- Repackaging the backoffice requires a deliberate install/bootstrap path.
- The protected bootstrap identity rule exists now, but provisioning and rotation policy do not.

Exit criteria:
- `grant@xdragon.tech` bootstrap behavior is formalized for the current installation
- bootstrap password source is defined and rotatable
- DB initialization / first-run workflow is documented and repeatable
- no legacy env allowlist is involved in backoffice authorization

## 4. Split the current app into a real public app and backoffice app
Why fourth:
- The original spec requires two separate components, and the internal seams are now strong enough to start the actual split.
- Doing this before items 1-3 would have frozen the wrong runtime assumptions into two codebases.

Exit criteria:
- public website and backoffice deploy independently
- shared logic moves into packages/modules with clear ownership
- host routing no longer depends on one Pages Router app serving both surfaces

## 5. Extract X Dragon-specific assumptions out of the reusable backoffice
Why fifth:
- A separated backoffice is not yet redistributable if it still assumes X Dragon naming, bootstrap behavior, or content conventions.

Exit criteria:
- reusable backoffice modules no longer depend on X Dragon domains, branding, or copy
- brand/site-specific assets and settings live outside reusable core modules
- new brands can be added without code edits in reusable backoffice logic

## 6. Package the backoffice installation and onboarding workflow
Why sixth:
- The original goal is a repackagable backoffice product, not just a cleaner internal app.
- Installation and provisioning need to be explicit before this can be reused safely.

Exit criteria:
- documented install/bootstrap workflow for a new deployment
- required env contract per app is explicit
- seed/provision scripts exist for first brand setup
- onboarding a second installation is configuration-driven, not engineer-driven

## 7. Final maintainability and production-hardening cleanup
Why last:
- The original brief explicitly called for consistency, reliability, and maintainability.
- The structural work above should land before destructive cleanup or secondary optimizations.

Exit criteria:
- remaining legacy/transitional code paths are removed
- migration and seed discipline are documented and enforced
- reporting/metrics no longer depend on transitional compatibility logic
- release QA, staging/prod DB steps, and recovery procedures are explicit

## Not Core Original-Spec Items
These are valid backlog items, but they are not ahead of the checklist above:
- partner accounts
- brand-level MFA policy
- permissions v2 beyond current role + brand-access model
