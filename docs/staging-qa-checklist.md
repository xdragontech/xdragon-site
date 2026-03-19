# Staging QA Checklist

## Purpose
Use this after merging a feature branch into `staging` and after the staging deployment finishes.

## Scripted checks
Run the non-mutating HTTP checks first:

```bash
./scripts/staging-http-check.sh
```

Optional:
- Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` to enable authenticated checks if those values are not available locally.
- Set `ALLOW_SIDE_EFFECTS=1` only when you explicitly want the script to send a test chat request and a test contact submission.

Examples:

```bash
ADMIN_EMAIL='...' ADMIN_PASSWORD='...' ./scripts/staging-http-check.sh
ALLOW_SIDE_EFFECTS=1 ./scripts/staging-http-check.sh
```

## Manual visual checks
- Public home page layout matches expected design.
- Favicon is the X Dragon asset in the browser tab.
- Chat widget is visible on the public site.
- Chat widget does not appear on admin, auth, tools, prompts, or guides pages.
- Mobile navigation and sticky header behave correctly.

## Public flow checks
- `/auth/signin` loads and the sign-in form behaves correctly.
- Anonymous access to `/tools`, `/prompts`, and `/guides` redirects to `/auth/signin`.
- Signed-in users can access `/tools`, `/prompts`, and `/guides`.
- Signed-in blocked users are handled correctly.

## Admin flow checks
- `https://stg-admin.xdragon.tech/` redirects to `/admin/signin`.
- Admin sign-in stays on the staging admin host.
- Dashboard, Accounts, Library, Leads, and Analytics pages load.
- Admin navigation works and sign-out returns to the correct host.

## API and form checks
- Chat returns a real assistant response and does not show `Bad JSON`.
- Contact form shows a success or deferred-notification success state, not a generic 500.
- If contact notification is deferred, confirm the lead still appears in admin.

## Release gating
- Vercel staging deployment points to the expected commit SHA.
- Preview environment variables are set correctly for staging.
- No unexpected redirects to production domains.
- No console/network errors that indicate auth cookie or host-pair drift.
