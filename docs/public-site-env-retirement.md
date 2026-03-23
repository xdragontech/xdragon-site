# Public Site Env Retirement

**Purpose**
Define which environment variables still belong on the `xdragon-site` Vercel project after the public-service cutover to `command/public-api`.

This is specifically about the **website deployment**, not every historical local script that still exists in this repo.

**Current Deployment Model**
- `xdragon-site` owns:
  - public website UI
  - host/brand runtime detection
  - BFF/session handling
  - server-to-server calls to `command/public-api`
- `command` owns:
  - public auth/account/resource APIs
  - public chat
  - public contact handling
  - provider integrations behind those services

That means provider keys for chat, contact, email sending, and old public rate limiting no longer belong on the website deployment.

**Safe To Remove From The `xdragon-site` Vercel Project**
These no longer belong to the live website runtime:

- `OPENAI_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RESEND_API_KEY`
- `BRAND_EMAIL_PROVIDER_SECRET_REF`
- `RESEND_FROM`
- `RESEND_FROM_EMAIL`
- `CONTACT_FROM_EMAIL`
- `EMAIL_FROM`
- `RESEND_TO_EMAIL`
- `CONTACT_TO_EMAIL`
- `CONTACT_TO`

**Keep On The `xdragon-site` Vercel Project**
These are still part of the live website runtime:

- `COMMAND_PUBLIC_API_BASE_URL`
- `COMMAND_PUBLIC_INTEGRATION_KEY`
- `COMMAND_BFF_SESSION_SECRET`
- `XD_POSTGRES`
- website brand/host envs still used by the frontend runtime and brand bootstrap tooling

**Do Not Remove Yet Without A Separate Cleanup**
These are not part of the public cutover, but they still support backoffice/auth code that remains in this repo:

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `BACKOFFICE_MFA_ENCRYPTION_KEY`
- `BACKOFFICE_MFA_ISSUER`
- `BACKOFFICE_BOOTSTRAP_PASSWORD`

Removing those now would be a different change. The public site does not need them for the `command` cutover path, but the repo still contains backoffice runtime surfaces that reference them.

**Important Nuance**
This repo still contains some local operator/bootstrap scripts and docs that mention email bootstrap envs. That does **not** mean those envs still belong on the live `xdragon-site` Vercel project.

If those local scripts are still needed, they should be treated as transitional operator tooling until that ownership is fully retired or moved to `command`.

**Recommendation**
1. Remove the safe-removal env vars from the `xdragon-site` Vercel project.
2. Leave the keep-list in place.
3. Do not remove the backoffice/auth envs until the admin runtime is fully retired from this repo or intentionally disabled in deployment.
