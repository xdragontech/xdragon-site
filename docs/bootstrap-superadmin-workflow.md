**Purpose**
Provide the explicit operator workflow for ensuring and recovering the protected bootstrap superadmin account.

**Protected Identity**
- current installation bootstrap identity: `grant@xdragon.tech`
- this identity is protected in runtime code and must remain an active `SUPERADMIN`

**Password Input**
- env key: `BACKOFFICE_BOOTSTRAP_PASSWORD`
- use a strong password
- do not commit it to the repo
- ordinary deploy startup does not consume this env var
- only the explicit bootstrap tooling uses it

**Commands**
Preview status:
```bash
npm run bootstrap-superadmin:status:preview
```

Preview ensure:
```bash
BACKOFFICE_BOOTSTRAP_PASSWORD='replace-me' npm run bootstrap-superadmin:ensure:preview
```

Preview recover:
```bash
BACKOFFICE_BOOTSTRAP_PASSWORD='replace-me' npm run bootstrap-superadmin:recover:preview
```

Production status:
```bash
npm run bootstrap-superadmin:status:production
```

Production ensure:
```bash
BACKOFFICE_BOOTSTRAP_PASSWORD='replace-me' npm run bootstrap-superadmin:ensure:production
```

Production recover:
```bash
BACKOFFICE_BOOTSTRAP_PASSWORD='replace-me' npm run bootstrap-superadmin:recover:production
```

**What Ensure Does**
- creates `grant@xdragon.tech` if missing
- enforces `SUPERADMIN`
- enforces active status
- ensures explicit access rows exist for all configured brands
- does not rotate the password for an existing account
- does not clear MFA unless explicit recovery is used

**What Recover Does**
- rotates the bootstrap password from `BACKOFFICE_BOOTSTRAP_PASSWORD`
- clears MFA state for the protected bootstrap account
- removes outstanding backoffice password reset tokens for that account
- preserves protected-account invariants

**Safety Rules**
- run brand bootstrap first; the bootstrap superadmin tooling expects at least one configured brand
- use `status` before `ensure` or `recover`
- use `ensure` for first-run provisioning or drift correction
- use `recover` only for deliberate emergency recovery
- because backoffice auth currently uses JWT sessions, password recovery does not immediately revoke already-issued sessions; that should be handled in a later session-versioning hardening pass

**Diagnostics**
- `Settings / Configs` shows:
  - bootstrap password env presence
  - protected bootstrap identity
  - live bootstrap account status from the database

**Future Backlog**
- a first-run setup page should eventually orchestrate initial-user and base-system setup for new installations
- that setup page should call into the same explicit bootstrap/install contract rather than replacing the operator tooling
