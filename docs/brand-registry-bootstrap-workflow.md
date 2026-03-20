**Purpose**
Make the database brand registry the explicit source of truth without relying on silent seed-by-side-effect behavior.

**What The Sync Does**
- reads the canonical single-brand runtime config from env
- creates or updates the matching `Brand` and canonical `BrandHost` rows
- backfills `brandId` onto existing rows only when the dataset is still single-brand safe
- refuses ambiguous backfills when more than one brand would exist

**Commands**
Preview dry run:
```bash
npm run brand:status:preview
```

Preview apply:
```bash
npm run brand:sync:preview
```

Production dry run:
```bash
npm run brand:status:production
```

Production apply:
```bash
npm run brand:sync:production
```

**Safety Rules**
- Use `status` before `sync`.
- The sync is safe for the current single-brand rollout.
- If more than one brand exists and null-branded rows remain, the command will refuse to backfill.
- Runtime fallback still exists for now when there are zero DB brands, but that is transitional and should not be treated as the steady state.

**Current Limitations**
- Admin content list views are still aggregate views; brand selection and filtering are a later pass.
- Content uniqueness is still globally constrained in several tables. Multi-brand duplicate slugs and names are a later schema pass.
- Backoffice user-to-brand permissions are still pending the auth and account split.
