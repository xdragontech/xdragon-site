# Bootstrap Superadmin Provisioning

**Status**
Retired from `xdragon-site`.

Bootstrap superadmin provisioning and recovery are now owned by `command`, not this repo.

Current source of truth:
- `command/docs/install-bootstrap-config.md`
- `command/docs/wave-11a-productization-and-runtime-ownership-contract.md`

**Purpose**
Capture the residual compatibility boundary that still exists in `xdragon-site` while reusable backoffice ownership has moved to `command`.

**Current State**
- this repo no longer owns the protected bootstrap identity value
- residual backoffice/auth compatibility surfaces in this repo now read `COMMAND_BOOTSTRAP_SUPERADMIN_EMAIL`
- there is no local fallback bootstrap email in `xdragon-site`
- the old X Dragon-specific bootstrap identity should be treated as historical installation context, not reusable runtime truth

**Compatibility Boundary**
- `xdragon-site` does not provision or recover the protected bootstrap account
- `xdragon-site` only consumes `COMMAND_BOOTSTRAP_SUPERADMIN_EMAIL` so residual backoffice/auth surfaces can continue to recognize the protected account if those surfaces are still deployed
- if that env is not configured, residual `xdragon-site` backoffice auth should be treated as unsupported

**Password Ownership**
- `BACKOFFICE_BOOTSTRAP_PASSWORD` does not belong to the live `xdragon-site` website deployment
- provisioning and recovery password handling remain owned by `command`

**Current Tooling**
- use the equivalent `bootstrap-superadmin:*` commands from the `command` repo
- `xdragon-site` no longer owns the bootstrap tooling contract

**Operational Expectation**
- treat any remaining backoffice/auth surfaces in `xdragon-site` as compatibility-only
- do not treat this repo as the source of truth for bootstrap identity, recovery, or protection policy
