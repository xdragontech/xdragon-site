# Schema Split And Migration Plan

## Purpose
This document turns the brand and identity contract into a concrete schema direction and migration sequence.

The goal is to replace the current single-user, single-brand assumptions without forcing a risky big-bang auth rewrite.

## Why the current schema is no longer acceptable
The current schema in [`prisma/schema.prisma`](./../prisma/schema.prisma) has these blockers:

- one shared `User` table for both backoffice/admin and public website users
- globally unique `User.email`
- globally unique OAuth account identity via `@@unique([provider, providerAccountId])`
- no `Brand` model
- no host mapping per brand
- no brand-scoped email configuration
- no brand scoping on leads, content, or analytics tables

That conflicts directly with the agreed model:

- same email must be usable across multiple brands for external users
- staff users must be separate credentials from external users
- backoffice users need brand-scoped access control
- staging and production public hosts must map to the same brand record
- email behavior must be configured per brand

## Design principles
1. Additive first, destructive last.
2. Separate backoffice and external identity domains before changing login behavior.
3. Keep `brandId` internal and use `brandKey` for external-safe references.
4. Use explicit join tables for permissions instead of encoding future complexity into one enum too early.
5. Avoid storing provider secrets in plaintext if brand email config becomes database-managed.

## Target schema direction

### Brand
Purpose:
- one managed public website/business

Recommended fields:
- `id String @id @default(cuid())`
- `brandKey String @unique`
- `name String`
- `status BrandStatus`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`

Recommended enum:
- `SETUP_PENDING`
- `ACTIVE`
- `DISABLED`

### BrandHost
Purpose:
- authoritative host allowlist for public brand resolution

Recommended fields:
- `id String @id @default(cuid())`
- `brandId String`
- `host String @unique`
- `environment BrandEnvironment`
- `kind BrandHostKind`
- `isCanonical Boolean @default(false)`

Recommended enums:
- `BrandEnvironment`: `PRODUCTION`, `PREVIEW`
- `BrandHostKind`: `PUBLIC`, `APEX`, `ALIAS`

Recommendation:
- do not model the future shared backoffice host here
- keep `host` globally unique so one hostname can never resolve to multiple brands

### BrandEmailConfig
Purpose:
- brand-scoped sender/provider behavior for public email-enabled flows

Recommended fields:
- `id String @id @default(cuid())`
- `brandId String @unique`
- `status BrandEmailConfigStatus`
- `provider BrandEmailProvider`
- `fromName String?`
- `fromEmail String?`
- `replyToEmail String?`
- `supportEmail String?`
- `providerSecretRef String?`
- `settings Json?`

Recommended enums:
- `BrandEmailConfigStatus`: `ACTIVE`, `INACTIVE`
- `BrandEmailProvider`: start with `RESEND`

Recommendation:
- prefer `providerSecretRef` or encrypted secrets over raw plaintext API keys in the database
- do not let one brand silently fall back to another brand's sender config

### BackofficeUser
Purpose:
- staff and superadmin accounts for the shared backoffice

Recommended fields:
- `id String @id @default(cuid())`
- `username String @unique`
- `email String? @unique`
- `passwordHash String`
- `role BackofficeRole`
- `status BackofficeUserStatus`
- `mfaEnabledAt DateTime?`
- `mfaSecretEncrypted String?`
- `lastSelectedBrandKey String?`
- `createdAt DateTime @default(now())`
- `lastLoginAt DateTime?`

Recommended enums:
- `BackofficeRole`: `SUPERADMIN`, `STAFF`
- `BackofficeUserStatus`: `ACTIVE`, `BLOCKED`

Recommendation:
- keep backoffice usernames unique platform-wide
- keep optional email unique for operations/security use, but it should not define brand access

### BackofficeUserBrandAccess
Purpose:
- explicit brand assignment for staff accounts

Recommended fields:
- `userId String`
- `brandId String`
- `createdAt DateTime @default(now())`

Recommended constraint:
- `@@unique([userId, brandId])`

Recommendation:
- `SUPERADMIN` should not require rows here to function
- keep this table even if feature permissions are added later

### BackofficeSession / BackofficeAccount / BackofficeVerificationToken
Purpose:
- separate auth/session storage for backoffice identity

Recommendation:
- do not reuse current `Session`, `Account`, or `VerificationToken` tables for backoffice once the split begins
- if NextAuth remains in use, give backoffice its own adapter-backed tables and cookie namespace

### ExternalUser
Purpose:
- public website user account scoped to a single brand

Recommended fields:
- `id String @id @default(cuid())`
- `brandId String`
- `email String?`
- `name String?`
- `passwordHash String?`
- `emailVerified DateTime?`
- `image String?`
- `status ExternalUserStatus`
- `createdAt DateTime @default(now())`
- `lastLoginAt DateTime?`

Recommended enum:
- `ExternalUserStatus`: `ACTIVE`, `BLOCKED`

Recommended constraint:
- `@@unique([brandId, email])`

Recommendation:
- allow null email only if future providers require it; otherwise prefer email presence for operational clarity
- same email across brands is valid by design

### ExternalAccount
Purpose:
- social or provider identity for external users

Recommended fields:
- same general shape as current `Account`
- plus `brandId String`

Recommended constraint:
- `@@unique([brandId, provider, providerAccountId])`

Reason:
- the same provider identity must be able to exist independently per brand

### ExternalSession / ExternalVerificationToken / ExternalPasswordResetToken
Purpose:
- separate public auth/session storage for external identity

Recommendation:
- keep external auth tables distinct from backoffice auth tables
- keep password reset and verification tokens brand-aware either by direct `brandId` or by brand-resolved user lookup

### Lead and LeadEvent
Recommended changes:
- add `brandId String`
- index `brandId`
- include brand in dedupe logic and reporting paths

Reason:
- current lead capture will mix brands otherwise

### Content tables
Add `brandId` to:
- `Category`
- `Prompt`
- `ArticleCategory`
- `Article`
- any future guide/category tables not yet represented in Prisma

Recommendation:
- uniqueness should become brand-scoped where appropriate
- for example, slugs that are currently global will likely need `@@unique([brandId, slug])`

## Recommended auth split
The current auth stack in [`pages/api/auth/[...nextauth].ts`](./../pages/api/auth/[...nextauth].ts) assumes:

- one credential domain
- one session model
- one role model

That should not survive the migration.

Recommended direction:
- backoffice auth gets its own session tables, cookie names, and auth route
- external auth gets its own session tables, cookie names, and auth route
- shared helper code can exist, but adapters/tables must not be shared blindly

Recommendation:
- do not try to make one NextAuth adapter represent both identity domains once the split starts

## Migration sequence

### Phase A: Add new brand and identity tables in parallel
Add without removing old tables:
- `Brand`
- `BrandHost`
- `BrandEmailConfig`
- `BackofficeUser`
- `BackofficeUserBrandAccess`
- `BackofficeSession` and related auth tables
- `ExternalUser`
- `ExternalAccount`
- `ExternalSession` and related auth tables

Also add nullable `brandId` to:
- `Lead`
- `LeadEvent`
- content tables

Exit criteria:
- Prisma can represent the target model without any auth cutover yet

### Phase B: Seed the first brand
Create one brand row for X Dragon.

Seed:
- `brandKey = xdragon`
- production public host
- staging public host
- brand status
- brand email config status

Backfill:
- existing leads/content rows get `brandId = xdragon`

Exit criteria:
- all existing brand-scoped data points at the initial brand row

### Phase C: Introduce backoffice identities
Backfill:
- current admin/staff access into `BackofficeUser`
- explicit brand access rows for staff users
- convert the current hardcoded/admin-email behavior into the new model incrementally

Recommendation:
- preserve the current emergency/superadmin path during transition, but isolate it clearly

Exit criteria:
- backoffice login can be validated independently of the old shared `User` role model

### Phase D: Introduce external identities
Backfill:
- existing public users from `User` into `ExternalUser` for the X Dragon brand
- existing provider accounts into `ExternalAccount`
- verification/reset data into external-auth equivalents as needed

Recommendation:
- dual-run the public auth path briefly if needed, but avoid a long hybrid state

Exit criteria:
- public auth no longer depends on the shared `User` model

### Phase E: Switch reads and writes
Order:
1. backoffice auth reads from `BackofficeUser`
2. external auth reads from `ExternalUser`
3. lead/content queries become brand-aware by default
4. email config resolves by `brandId`

Exit criteria:
- no runtime auth path depends on the old mixed user model

### Phase F: Retire legacy tables and columns
Only after live verification:
- remove shared role assumptions from `User`
- archive or migrate remaining legacy auth tables
- drop no-longer-used constraints that encode single-brand behavior

Recommendation:
- do this only after at least one successful staging-to-production cycle on the new auth paths

## High-risk areas
- password reset and verification token migration
- keeping existing admin access intact during backoffice cutover
- global email uniqueness assumptions in code and UI
- provider account uniqueness assumptions for future social login
- content slug uniqueness that is currently global

## Non-goals for this phase
- implementing social login
- implementing MFA
- feature-level staff permissions beyond brand assignment
- changing public design/layout

## Recommended next code pass after this doc
1. Add proposed Prisma models in additive form only.
2. Add brand-aware nullable foreign keys to leads/content.
3. Create seed/backfill script for the initial X Dragon brand.
4. Only then start the auth split.
