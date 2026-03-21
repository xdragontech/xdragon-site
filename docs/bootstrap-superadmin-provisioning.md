# Bootstrap Superadmin Provisioning

**Purpose**
Define the protected bootstrap superadmin contract for the current X Dragon installation, including provisioning, password source, recovery, and future reuse constraints.

**Current State**
- the protected backoffice identity already exists in runtime code as `grant@xdragon.tech`
- that identity is forced to `SUPERADMIN`
- that identity cannot be deleted, blocked, demoted, or have its email changed
- provisioning and password lifecycle are not yet formalized

**Current Installation Contract**
- `grant@xdragon.tech` is the protected bootstrap backoffice identity for this installation
- the protected bootstrap identity must always exist as an active `BackofficeUser`
- the protected bootstrap identity must always resolve to `SUPERADMIN`
- the protected bootstrap identity must remain eligible to access all brands
- no backoffice env allowlist is used to grant or protect that identity

**Security Rules**
- the bootstrap password must never be hardcoded in application code or committed seed data
- the bootstrap password source must be env-driven and rotatable
- deploys must not silently overwrite the bootstrap password on every startup
- bootstrap recovery must support explicit MFA reset, because MFA is now part of backoffice auth
- bootstrap recovery actions must be deliberate operator actions, not passive side effects of viewing a page

**Password Source Policy**
- the bootstrap password comes from a dedicated env value during provisioning or explicit recovery
- the bootstrap password is consumed by a controlled bootstrap command, not by ordinary request-time runtime code
- ordinary deploys may enforce protected-account invariants, but must not reset password hashes
- password rotation for the bootstrap account must be an explicit operator workflow

**Provisioning Workflow**
1. apply database migrations
2. ensure the initial brand registry and host registry exist
3. run an explicit bootstrap-superadmin ensure command
4. the ensure command must be idempotent:
   - create `grant@xdragon.tech` if missing
   - enforce `SUPERADMIN` role
   - enforce active status
   - enforce protected identity invariants
   - ensure full brand access
   - leave the existing password hash unchanged unless explicit reset mode is requested

**Recovery Workflow**
- an explicit recovery/reset command must exist for the protected bootstrap account
- that recovery command must be able to:
  - rotate the bootstrap password from the env-provided source
  - clear MFA state when operational recovery requires it
  - preserve the protected identity invariants
- recovery must not depend on the normal staff-management UI alone

**Operational Expectations**
- the protected bootstrap account is for initial setup, emergency recovery, and maintenance
- ordinary daily staff administration should use normal `BackofficeUser` management flows
- the protected bootstrap account should remain visible in staff management as protected, but normal operators must not be able to remove its safeguards

**Reusable Product Constraint**
- the current X Dragon installation keeps `grant@xdragon.tech` as the protected bootstrap identity
- the future reusable backoffice product must not permanently hardcode an X Dragon-specific bootstrap email
- when packaging work begins, the bootstrap identity must become installation-configurable without weakening the protected-account model

**Non-Goals In This Pass**
- no implementation of the bootstrap command yet
- no password rotation UI yet
- no change to current staff-management screens beyond the already-present protected-account handling
- no change to MFA policy beyond requiring recovery support in the future implementation

**Implementation Scope For Pass 2**
- add an explicit bootstrap-superadmin ensure command
- add an explicit bootstrap-superadmin recovery/reset command
- document required env inputs for bootstrap provisioning
- expose enough status/diagnostics to verify the protected bootstrap account without exposing secrets
