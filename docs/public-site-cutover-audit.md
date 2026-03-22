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
With `COMMAND_PUBLIC_API_BASE_URL` and `COMMAND_PUBLIC_INTEGRATION_KEY` configured in `xdragon-site`, the live public site now routes these user-facing capabilities through `command/public-api`:

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

**Fallback Retirement Status**
The public fallback-retirement wave removes the remaining duplicated public business logic from `xdragon-site`:

- public auth routes now proxy to `command` only
- prompts/guides pages and guide API routes now read through `command` only
- contact/chat now proxy to `command` only
- protected public resource gating now uses the `command` session only

That is the correct end state. Rollback for the public service boundary is no longer an env toggle; it is a deployment rollback.

**What Is Not Yet Used By The Public Site**
`command` already has account endpoints, but the public site does not currently expose account/profile UI that consumes them:

- `GET /v1/account/me`
- `PATCH /v1/account/me`

This is not a defect. It just means the API surface is ahead of the current website feature set.

**Inconsistencies / Risks Found**
1. Contract drift was real
- `command` source of truth:
  - [/Users/grantr/Projects/command/packages/contracts-openapi/command-public-api.v1.yaml](/Users/grantr/Projects/command/packages/contracts-openapi/command-public-api.v1.yaml)
- `xdragon-site` had a stale duplicate copy during the audit

That duplicate should be removed as part of the same cleanup wave so the contract has one owner again.

2. Transitional env duplication remains
`xdragon-site` can now drop public-service envs that only existed for local fallback, but that cleanup should happen after fallback retirement is merged and live.

**Recommendation**
The next cleanup after fallback retirement should be env simplification in `xdragon-site`:

- remove public-service envs that no longer belong to the website runtime
- keep website-owned BFF/session/host-runtime config
- leave admin/backoffice code alone

**What Not To Do Next**
- do not move public middleware/brand host resolution into `command`
- do not reintroduce local public-service fallback paths in `xdragon-site`
- do not recreate a copied OpenAPI file in the website repo
