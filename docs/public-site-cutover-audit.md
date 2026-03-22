# Public Site Cutover Audit

**Purpose**
Document the current state of the `xdragon-site` to `command` public-site cutover after the live auth, resources, contact, and chat waves. This is not a roadmap draft. It is a code-ownership snapshot.

**Audit Date**
- 2026-03-22

**What Was Audited**
- public website pages
- public website API routes
- BFF/session handling in `xdragon-site`
- remaining local fallback logic in `xdragon-site`
- contract/source-of-truth consistency between `xdragon-site` and `command`

**Current State**
When `COMMAND_PUBLIC_API_BASE_URL` and `COMMAND_PUBLIC_INTEGRATION_KEY` are configured in `xdragon-site`, the live public site now routes these user-facing capabilities through `command/public-api`:

- external login/logout/session
- signup
- email verification
- forgot password
- reset password
- prompts feed
- guides feed
- guide detail
- contact form
- website chat

That means the main public-service boundary is now real, not theoretical.

**Surfaces Already Command-Backed**
- Auth/session BFF in:
  - [/Users/grantr/Projects/xdragon-site/pages/api/bff/auth/login.ts](/Users/grantr/Projects/xdragon-site/pages/api/bff/auth/login.ts)
  - [/Users/grantr/Projects/xdragon-site/pages/api/bff/auth/logout.ts](/Users/grantr/Projects/xdragon-site/pages/api/bff/auth/logout.ts)
  - [/Users/grantr/Projects/xdragon-site/pages/api/bff/auth/session.ts](/Users/grantr/Projects/xdragon-site/pages/api/bff/auth/session.ts)
  - [/Users/grantr/Projects/xdragon-site/lib/commandBffSession.ts](/Users/grantr/Projects/xdragon-site/lib/commandBffSession.ts)
  - [/Users/grantr/Projects/xdragon-site/lib/requireUser.ts](/Users/grantr/Projects/xdragon-site/lib/requireUser.ts)
- Public auth proxy routes in:
  - [/Users/grantr/Projects/xdragon-site/pages/api/auth/register.ts](/Users/grantr/Projects/xdragon-site/pages/api/auth/register.ts)
  - [/Users/grantr/Projects/xdragon-site/pages/api/auth/request-password-reset.ts](/Users/grantr/Projects/xdragon-site/pages/api/auth/request-password-reset.ts)
  - [/Users/grantr/Projects/xdragon-site/pages/api/auth/reset-password.ts](/Users/grantr/Projects/xdragon-site/pages/api/auth/reset-password.ts)
  - [/Users/grantr/Projects/xdragon-site/pages/api/auth/verify-email.ts](/Users/grantr/Projects/xdragon-site/pages/api/auth/verify-email.ts)
- Public resource routes/pages in:
  - [/Users/grantr/Projects/xdragon-site/pages/prompts/index.tsx](/Users/grantr/Projects/xdragon-site/pages/prompts/index.tsx)
  - [/Users/grantr/Projects/xdragon-site/pages/guides/index.tsx](/Users/grantr/Projects/xdragon-site/pages/guides/index.tsx)
  - [/Users/grantr/Projects/xdragon-site/pages/guides/[slug].tsx](/Users/grantr/Projects/xdragon-site/pages/guides/[slug].tsx)
  - [/Users/grantr/Projects/xdragon-site/pages/api/guides/index.ts](/Users/grantr/Projects/xdragon-site/pages/api/guides/index.ts)
  - [/Users/grantr/Projects/xdragon-site/pages/api/guides/[slug].ts](/Users/grantr/Projects/xdragon-site/pages/api/guides/[slug].ts)
- Public service routes in:
  - [/Users/grantr/Projects/xdragon-site/pages/api/contact.ts](/Users/grantr/Projects/xdragon-site/pages/api/contact.ts)
  - [/Users/grantr/Projects/xdragon-site/pages/api/chat.ts](/Users/grantr/Projects/xdragon-site/pages/api/chat.ts)

**Surfaces That Should Remain Website-Owned**
These are not split failures. They belong to `xdragon-site` as the public frontend/BFF:

- public page rendering and UI
  - [/Users/grantr/Projects/xdragon-site/pages/index.tsx](/Users/grantr/Projects/xdragon-site/pages/index.tsx)
  - [/Users/grantr/Projects/xdragon-site/components/BusinessWebsite.tsx](/Users/grantr/Projects/xdragon-site/components/BusinessWebsite.tsx)
  - [/Users/grantr/Projects/xdragon-site/components/ChatWidget.tsx](/Users/grantr/Projects/xdragon-site/components/ChatWidget.tsx)
  - [/Users/grantr/Projects/xdragon-site/components/resources/ResourcesLayout.tsx](/Users/grantr/Projects/xdragon-site/components/resources/ResourcesLayout.tsx)
- BFF cookie/session envelope
  - [/Users/grantr/Projects/xdragon-site/lib/commandBffSession.ts](/Users/grantr/Projects/xdragon-site/lib/commandBffSession.ts)
- website-side host/brand resolution needed before any server-to-server call happens
  - [/Users/grantr/Projects/xdragon-site/middleware.ts](/Users/grantr/Projects/xdragon-site/middleware.ts)
  - [/Users/grantr/Projects/xdragon-site/pages/api/internal/brand-runtime.ts](/Users/grantr/Projects/xdragon-site/pages/api/internal/brand-runtime.ts)

Important design note:
- `command` should not own public-site middleware decisions or browser session presentation.
- `xdragon-site` still needs its own host/runtime awareness because it is the actual frontend entrypoint.

**Still Local In Xdragon-Site, But Only As Transitional Fallback**
These are the remaining pieces of public business logic still duplicated in `xdragon-site` behind dual-mode handlers. They are no longer the desired long-term ownership.

1. Public auth fallback implementations
- [/Users/grantr/Projects/xdragon-site/pages/api/auth/register.ts](/Users/grantr/Projects/xdragon-site/pages/api/auth/register.ts)
- [/Users/grantr/Projects/xdragon-site/pages/api/auth/request-password-reset.ts](/Users/grantr/Projects/xdragon-site/pages/api/auth/request-password-reset.ts)
- [/Users/grantr/Projects/xdragon-site/pages/api/auth/reset-password.ts](/Users/grantr/Projects/xdragon-site/pages/api/auth/reset-password.ts)
- [/Users/grantr/Projects/xdragon-site/pages/api/auth/verify-email.ts](/Users/grantr/Projects/xdragon-site/pages/api/auth/verify-email.ts)

These still contain local Prisma/email/token logic for rollback mode.

2. Public resource fallback implementations
- [/Users/grantr/Projects/xdragon-site/pages/prompts/index.tsx](/Users/grantr/Projects/xdragon-site/pages/prompts/index.tsx)
- [/Users/grantr/Projects/xdragon-site/pages/guides/index.tsx](/Users/grantr/Projects/xdragon-site/pages/guides/index.tsx)
- [/Users/grantr/Projects/xdragon-site/pages/guides/[slug].tsx](/Users/grantr/Projects/xdragon-site/pages/guides/[slug].tsx)
- [/Users/grantr/Projects/xdragon-site/pages/api/guides/index.ts](/Users/grantr/Projects/xdragon-site/pages/api/guides/index.ts)
- [/Users/grantr/Projects/xdragon-site/pages/api/guides/[slug].ts](/Users/grantr/Projects/xdragon-site/pages/api/guides/[slug].ts)

These still contain local Prisma reads for legacy mode.

3. Public contact/chat fallback implementations
- [/Users/grantr/Projects/xdragon-site/pages/api/contact.ts](/Users/grantr/Projects/xdragon-site/pages/api/contact.ts)
- [/Users/grantr/Projects/xdragon-site/pages/api/chat.ts](/Users/grantr/Projects/xdragon-site/pages/api/chat.ts)

These still contain local lead logging, email, Upstash rate limiting, and OpenAI logic for rollback mode.

4. Legacy public-session fallback path
- [/Users/grantr/Projects/xdragon-site/lib/requireUser.ts](/Users/grantr/Projects/xdragon-site/lib/requireUser.ts)

This still supports `legacy` mode via local session/user lookup for protected resources.

**What Is Not Yet Used By The Public Site**
`command` already has account endpoints, but the public site does not currently expose account/profile UI that consumes them:

- `GET /v1/account/me`
- `PATCH /v1/account/me`

This is not a defect. It just means the API surface is ahead of the current website feature set.

**Inconsistencies / Risks Found**
1. Duplicate OpenAPI source
- `command` source of truth:
  - [/Users/grantr/Projects/command/packages/contracts-openapi/command-public-api.v1.yaml](/Users/grantr/Projects/command/packages/contracts-openapi/command-public-api.v1.yaml)
- stale duplicate in `xdragon-site`:
  - [/Users/grantr/Projects/xdragon-site/openapi/command-public-api.v1.yaml](/Users/grantr/Projects/xdragon-site/openapi/command-public-api.v1.yaml)

This is real drift. The `xdragon-site` copy is already behind and does not reflect the newer contact/chat contract.

2. Transitional env duplication
`xdragon-site` still references these service envs because fallback logic still exists:
- `OPENAI_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RESEND_API_KEY` indirectly through local brand email fallback

As long as fallback remains, these envs can still matter there.

3. Dual-mode increases maintenance cost
The current public surface is safer operationally because rollback is simple, but it means every moved feature still has two implementations:
- desired owner in `command`
- legacy fallback in `xdragon-site`

That is acceptable temporarily, but not a stable final architecture.

**Recommendation**
The next highest-leverage wave should be:

1. Retire public legacy fallback logic in `xdragon-site`
Do this only after one more stable production interval, but it is the right next cleanup.

Target removals:
- local auth fallback bodies
- local guides/prompts Prisma fallback reads
- local contact/chat fallback bodies
- `legacy` branch in public resource gating where no longer needed

Reason:
- the live public flows are already working through `command`
- keeping duplicate business logic in the website is now the larger risk

2. Remove the stale OpenAPI copy from `xdragon-site`
Replace it with documentation that references the `command` source of truth instead of copying it.

Reason:
- duplicated contracts will drift again
- they already have

3. Then remove now-unused public service envs from `xdragon-site`
Only after fallback removal is complete.

Likely candidates:
- `OPENAI_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- possibly `RESEND_API_KEY` for public-flow purposes

Reason:
- env cleanup should follow ownership cleanup, not precede it

**Recommended Next Wave**
Name:
- `public-fallback-retirement`

Scope:
- remove duplicated public auth/resource/contact/chat fallback logic from `xdragon-site`
- keep website-owned BFF/session/host-runtime logic
- remove the stale copied OpenAPI file from `xdragon-site`
- leave admin/backoffice code alone

**What Not To Do Next**
- do not move public middleware/brand host resolution into `command`
- do not remove rollback paths piecemeal by env key without removing the actual fallback code
- do not keep both OpenAPI copies and try to manually synchronize them

That would preserve confusion instead of finishing the separation.
