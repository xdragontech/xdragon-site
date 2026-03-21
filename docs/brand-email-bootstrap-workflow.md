**Purpose**
Make `BrandEmailConfig` the live source of truth for public auth and notification email without relying on silent global sender/recipient fallbacks.

**Operator Surface**
- live editing belongs on `Settings / Brands`
- the sync commands remain useful for first-time bootstrap and emergency recovery

**What The Sync Does**
- reads the current bootstrap email env values
- targets the current `BRAND_KEY`
- creates or updates the matching `BrandEmailConfig`
- marks the config active only through an explicit operator action

**Bootstrap Inputs**
- sender identity:
  - `RESEND_FROM`
  - `RESEND_FROM_EMAIL`
  - `CONTACT_FROM_EMAIL`
  - `EMAIL_FROM`
- support/notification recipient:
  - `RESEND_TO_EMAIL`
  - `CONTACT_TO_EMAIL`
  - `CONTACT_TO`
- provider secret ref:
  - defaults to `RESEND_API_KEY`
  - optional override: `BRAND_EMAIL_PROVIDER_SECRET_REF`

**Commands**
Preview dry run:
```bash
npm run brand-email:status:preview
```

Preview apply:
```bash
npm run brand-email:sync:preview
```

Production dry run:
```bash
npm run brand-email:status:production
```

Production apply:
```bash
npm run brand-email:sync:production
```

**Safety Rules**
- Use `status` before `sync`.
- The target brand must already exist in the database.
- The sync refuses to apply when sender, support email, or provider secret are missing.
- Live runtime email behavior reads `BrandEmailConfig`, not the bootstrap env values directly.

**Current Runtime Behavior**
- signup and password reset are blocked when the brand email config is missing or inactive
- contact notifications are blocked when the brand email config is missing or inactive
- chat conversations still work, but lead-summary email is skipped when brand email config is unavailable
