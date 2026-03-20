# Brand Context And Identity Contract

## Purpose
This document defines the required engineering contract for:

1. brand recognition
2. backoffice vs external identity separation
3. brand-scoped permissions
4. brand-scoped email configuration

This contract must be treated as the source of truth before Prisma, auth, and UI migrations begin.

## Core decisions
- One `Brand` represents one managed public website/business.
- `brandId` is internal only.
- `brandKey` is the stable external-safe identifier.
- Staging and production hosts map to the same brand record.
- Public brand context is resolved server-side from the request host.
- Any client-sent `brandKey` is a cross-check only, not the source of truth.
- Backoffice users and external users are separate identity domains.
- Staff users never authenticate into public brand websites with staff credentials.
- Email-enabled public flows are blocked when the brand has no active email configuration.
- Browser traffic is the only supported integration surface for now.

## Domain model
### Brand
Required shape:
- `id`
- `brandKey`
- `name`
- `status`

Recommended statuses:
- `SETUP_PENDING`
- `ACTIVE`
- `DISABLED`

### BrandHost
Each brand needs explicit allowed public hosts.

Required shape:
- `brandId`
- `host`
- `environment`
- `kind`

Current minimum use:
- production public host
- staging public host
- optional apex/alias hosts

Rule:
- the future shared backoffice host is platform-owned, not brand-owned
- do not model backoffice host access as a brand host record

### BrandEmailConfig
Email behavior must be configurable per brand.

Required shape:
- `brandId`
- `provider`
- `status`
- sender configuration
- recipient configuration where applicable

Rules:
- public flows that require email must not silently fall back to another brand's config
- if a brand email config is missing or inactive, those flows are blocked
- provider credentials may be shared across brands later, but the effective config must still resolve per brand

## Brand resolution contract
### Public website and public API requests
Source of truth:
- request `Host` header resolved server-side against allowed brand hosts

Rules:
- if host does not resolve to an active brand, reject the request
- if a request includes `brandKey`, it must match the host-resolved brand or be rejected
- public handlers must log the resolved `brandId`/`brandKey` on brand-scoped events

Reason:
- the browser must not be trusted to choose the brand for a public request

### Backoffice requests
Source of truth:
- authenticated backoffice session

Host model:
- one shared backoffice host serves all brands
- brand access is resolved from session permissions, not from the request host

Backoffice session must carry:
- `role`
- `allowedBrandKeys`
- optional `lastSelectedBrandKey`

Modes:
- aggregate mode: no explicit brand selected, results are scoped to all brands assigned to the staff user
- brand-specific mode: a `brandKey` is supplied for a specific action and must be validated against the session's allowed brands

Rule:
- `SUPERADMIN` bypasses brand assignment checks
- `STAFF` must always be validated against explicit brand assignments

## Identity domains
### Backoffice users
Purpose:
- manage brands
- manage backoffice features
- manage staff access

Auth requirements:
- username/password
- optional 2FA later

Rules:
- separate credential/account domain from external users
- roles start as:
  - `SUPERADMIN`
  - `STAFF`
- staff permissions are brand-scoped now
- feature-scoped permissions will be added later

Recommended future fields:
- `mfaEnabledAt`
- `mfaSecretEncrypted`
- `lastSelectedBrandKey`

### External users
Purpose:
- authenticate into one brand's public website and access services for that brand only

Rules:
- external users are unique within a brand, not globally across the platform
- the same email may exist under multiple brands
- future social login identities may also repeat across brands
- external users must not be implicitly recognized across brands
- staff credentials must never be valid for external-user flows

## Session contracts
### BackofficeSession
Required fields:
- `userId`
- `role`
- `allowedBrandKeys`
- optional `lastSelectedBrandKey`

Behavior:
- login lands the user in aggregate mode by default across all allowed brands
- the UI may store a selected brand in session state for convenience
- brand-specific writes should still send an explicit `brandKey` so the server can validate and audit the action clearly

### ExternalSession
Required fields:
- `externalUserId`
- `brandKey`
- brand-scoped auth/provider identity

Behavior:
- the session is valid for one brand only
- the brand is derived from host during login/session validation

## Authorization rules
### Backoffice
- `SUPERADMIN` can access all brands and all current backoffice features
- `STAFF` can access only assigned brands
- brand assignment is the only managed permission at this time
- future feature permissions must layer on top of brand assignment, not replace it

### Public
- external users can access only the brand they authenticated into
- public routes and APIs must never accept a different brand context than the resolved host

## Email rules
Brand-specific email behavior must be supported for:
- signup verification
- password reset
- contact submissions
- chat follow-up notifications

Rules:
- sender identity must resolve per brand
- templates/content should resolve per brand
- if a brand is `SETUP_PENDING` or lacks active email configuration, email-enabled flows are blocked instead of falling back silently
- operational errors must still return structured failures

## Current gap from the existing codebase
The current implementation does not satisfy this contract because:
- one shared `User` model currently mixes admin/staff and public users
- `User.email` is globally unique
- auth/session logic assumes one credential domain
- email configuration is global, not brand-scoped
- content and lead data are not yet brand-scoped
- current routing still reflects a transitional single-brand admin-host model

## Migration intent
The next implementation phases should follow this order:
1. introduce brand context helpers and host-to-brand resolution interfaces
2. define separate backoffice and external identity schemas
3. add brand-scoped email configuration
4. migrate auth/session flows
5. make content, lead, and analytics data brand-aware

## Deferred for later
- server-to-server brand API credentials
- social login implementation
- feature-level backoffice permissions beyond brand assignment
- MFA implementation details
