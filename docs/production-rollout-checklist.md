# Production Rollout Checklist

## Purpose
Use this after `staging` is green and before promoting the same change set to production.

## Release gates before merge to `main`
- `staging` is deployed on the expected commit SHA.
- [`docs/staging-qa-checklist.md`](/Users/grantr/Projects/xdragon-site/docs/staging-qa-checklist.md) is complete for the candidate change.
- The production diff is limited to the intended PRs. No unrelated fixes ride along.
- Vercel Production env scope has been reviewed, not assumed.

## Production env contract
Verify these before rollout:

- `OPENAI_API_KEY` for [`pages/api/chat.ts`](/Users/grantr/Projects/xdragon-site/pages/api/chat.ts)
- `RESEND_API_KEY`
- sender env: `RESEND_FROM_EMAIL` or `RESEND_FROM` or `CONTACT_FROM_EMAIL`
- recipient env: `RESEND_TO_EMAIL` or `CONTACT_TO_EMAIL` or `CONTACT_TO`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- admin/auth envs as used by [`pages/api/auth/[...nextauth].ts`](/Users/grantr/Projects/xdragon-site/pages/api/auth/[...nextauth].ts) and [`lib/auth.ts`](/Users/grantr/Projects/xdragon-site/lib/auth.ts)
- production host config in [`lib/siteConfig.ts`](/Users/grantr/Projects/xdragon-site/lib/siteConfig.ts):
  `NEXT_PUBLIC_APEX_HOST`, `NEXT_PUBLIC_PROD_WWW_HOST`, `NEXT_PUBLIC_PROD_ADMIN_HOST`

Optional:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Rule:
- If Upstash is intentionally unused, both Redis vars must be absent.
- If Upstash is used, both vars must be valid and the database must not be archived.

## Rollout steps
1. Confirm the release branch/PR merged cleanly into `main`.
2. Confirm Vercel created the expected production deployment for that commit.
3. Verify domain mapping is still correct for public and admin hosts.
4. Run non-mutating smoke checks against production.
5. Run intentional write-path checks for chat/contact only after confirming the business team is aware of test traffic.

## Production smoke checks
- Public home page loads on the correct production host.
- Favicon loads correctly.
- Public auth route loads on the correct host.
- Admin root redirects to `/admin/signin` on the admin host.
- Anonymous access to protected resources redirects correctly.
- No unexpected redirect to staging hosts.

## Production write-path checks
- Chat returns structured JSON, not a raw HTML 500.
- Contact form returns success or deferred-notification success, not a generic 500.
- If contact is deferred, confirm the lead is still captured in admin/database.
- Review Vercel Function logs for chat/contact immediately after the test.

## Rollback triggers
- Raw HTML 500 from `POST /api/chat`
- Raw HTML 500 from `POST /api/contact`
- auth loop or bad host redirect
- production host serving staging/admin routing behavior
- lead capture missing or duplicated unexpectedly

## Rollback action
1. Roll back the production deployment or revert the PR.
2. Re-check Vercel env scope separately from the code rollback.
3. Re-run non-mutating smoke checks before declaring recovery.

## Release record
Capture these in the PR or release notes:
- commit SHA
- Vercel deployment URL
- time of rollout
- who verified production
- any env changes made with the rollout
