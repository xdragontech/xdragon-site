CREATE TYPE "BrandNotificationNoticeType" AS ENUM (
    'ACCOUNT_VERIFICATION',
    'WELCOME',
    'PASSWORD_RESET_REQUEST',
    'BACKOFFICE_TEMP_PASSWORD',
    'ACCOUNT_PASSWORD_CHANGED',
    'APPLICATION_EXTERNAL_NOTE',
    'APPLICATION_APPROVED',
    'SCHEDULE_ASSIGNMENT_ADDED',
    'SCHEDULE_ASSIGNMENT_UPDATED',
    'SCHEDULE_ASSIGNMENT_REMOVED',
    'COMPLIANCE_DOCS_REMINDER',
    'UPCOMING_EVENT_REMINDER'
);

CREATE TABLE "BrandNotificationSettings" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandNotificationSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrandNotificationControl" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "noticeType" "BrandNotificationNoticeType" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandNotificationControl_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrandNotificationTheme" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "headerHtml" TEXT NOT NULL,
    "brandImageUrl" TEXT,
    "footerHtml" TEXT NOT NULL,
    "fontFamily" TEXT NOT NULL,
    "signatureHtml" TEXT NOT NULL,
    "settings" JSONB,
    "updatedByBackofficeUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandNotificationTheme_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrandNotificationTemplate" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "noticeType" "BrandNotificationNoticeType" NOT NULL,
    "subjectTemplate" TEXT NOT NULL,
    "bodyHtmlTemplate" TEXT NOT NULL,
    "bodyTextTemplate" TEXT,
    "isCustomized" BOOLEAN NOT NULL DEFAULT false,
    "lastTestSentAt" TIMESTAMP(3),
    "updatedByBackofficeUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandNotificationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrandNotificationTestSend" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "noticeType" "BrandNotificationNoticeType" NOT NULL,
    "brandNotificationTemplateId" TEXT,
    "brandNotificationThemeId" TEXT,
    "requestedByBackofficeUserId" TEXT NOT NULL,
    "recipientBackofficeUserIds" JSONB NOT NULL,
    "recipientEmails" JSONB NOT NULL,
    "subjectSnapshot" TEXT NOT NULL,
    "htmlSnapshot" TEXT NOT NULL,
    "textSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandNotificationTestSend_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BrandNotificationSettings_brandId_key" ON "BrandNotificationSettings"("brandId");
CREATE UNIQUE INDEX "BrandNotificationControl_brandId_noticeType_key" ON "BrandNotificationControl"("brandId", "noticeType");
CREATE INDEX "BrandNotificationControl_brandId_idx" ON "BrandNotificationControl"("brandId");
CREATE INDEX "BrandNotificationControl_noticeType_idx" ON "BrandNotificationControl"("noticeType");
CREATE UNIQUE INDEX "BrandNotificationTheme_brandId_key" ON "BrandNotificationTheme"("brandId");
CREATE INDEX "BrandNotificationTheme_updatedByBackofficeUserId_idx" ON "BrandNotificationTheme"("updatedByBackofficeUserId");
CREATE UNIQUE INDEX "BrandNotificationTemplate_brandId_noticeType_key" ON "BrandNotificationTemplate"("brandId", "noticeType");
CREATE INDEX "BrandNotificationTemplate_brandId_idx" ON "BrandNotificationTemplate"("brandId");
CREATE INDEX "BrandNotificationTemplate_noticeType_idx" ON "BrandNotificationTemplate"("noticeType");
CREATE INDEX "BrandNotificationTemplate_updatedByBackofficeUserId_idx" ON "BrandNotificationTemplate"("updatedByBackofficeUserId");
CREATE INDEX "BrandNotificationTestSend_brandId_idx" ON "BrandNotificationTestSend"("brandId");
CREATE INDEX "BrandNotificationTestSend_noticeType_idx" ON "BrandNotificationTestSend"("noticeType");
CREATE INDEX "BrandNotificationTestSend_brandId_noticeType_idx" ON "BrandNotificationTestSend"("brandId", "noticeType");
CREATE INDEX "BrandNotificationTestSend_requestedByBackofficeUserId_idx" ON "BrandNotificationTestSend"("requestedByBackofficeUserId");
CREATE INDEX "BrandNotificationTestSend_createdAt_idx" ON "BrandNotificationTestSend"("createdAt");

ALTER TABLE "BrandNotificationSettings"
ADD CONSTRAINT "BrandNotificationSettings_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrandNotificationControl"
ADD CONSTRAINT "BrandNotificationControl_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrandNotificationTheme"
ADD CONSTRAINT "BrandNotificationTheme_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrandNotificationTheme"
ADD CONSTRAINT "BrandNotificationTheme_updatedByBackofficeUserId_fkey"
FOREIGN KEY ("updatedByBackofficeUserId") REFERENCES "BackofficeUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BrandNotificationTemplate"
ADD CONSTRAINT "BrandNotificationTemplate_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrandNotificationTemplate"
ADD CONSTRAINT "BrandNotificationTemplate_updatedByBackofficeUserId_fkey"
FOREIGN KEY ("updatedByBackofficeUserId") REFERENCES "BackofficeUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BrandNotificationTestSend"
ADD CONSTRAINT "BrandNotificationTestSend_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrandNotificationTestSend"
ADD CONSTRAINT "BrandNotificationTestSend_brandNotificationTemplateId_fkey"
FOREIGN KEY ("brandNotificationTemplateId") REFERENCES "BrandNotificationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BrandNotificationTestSend"
ADD CONSTRAINT "BrandNotificationTestSend_brandNotificationThemeId_fkey"
FOREIGN KEY ("brandNotificationThemeId") REFERENCES "BrandNotificationTheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BrandNotificationTestSend"
ADD CONSTRAINT "BrandNotificationTestSend_requestedByBackofficeUserId_fkey"
FOREIGN KEY ("requestedByBackofficeUserId") REFERENCES "BackofficeUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "BrandNotificationSettings" (
    "id",
    "brandId",
    "notificationsEnabled",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('brand-notification-settings-', b."id"),
    b."id",
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Brand" b
WHERE NOT EXISTS (
    SELECT 1
    FROM "BrandNotificationSettings" existing
    WHERE existing."brandId" = b."id"
);

INSERT INTO "BrandNotificationTheme" (
    "id",
    "brandId",
    "headerHtml",
    "brandImageUrl",
    "footerHtml",
    "fontFamily",
    "signatureHtml",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('brand-notification-theme-', b."id"),
    b."id",
    '<div style="font-size:22px;font-weight:700;letter-spacing:0.01em">{{BrandName}}</div>',
    NULL,
    '<div style="font-size:12px;line-height:1.6;color:#6b7280">This email was sent by {{BrandName}}. Please contact support if you received it in error.</div>',
    'Aptos, ''Segoe UI'', Helvetica, Arial, sans-serif',
    '<p>Thanks,<br />{{BrandName}}</p>',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Brand" b
WHERE NOT EXISTS (
    SELECT 1
    FROM "BrandNotificationTheme" existing
    WHERE existing."brandId" = b."id"
);

INSERT INTO "BrandNotificationControl" (
    "id",
    "brandId",
    "noticeType",
    "isEnabled",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('brand-notification-control-', b."id", '-', LOWER(REPLACE(t."noticeType"::text, '_', '-'))),
    b."id",
    t."noticeType",
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Brand" b
CROSS JOIN (
    VALUES
      ('ACCOUNT_VERIFICATION'::"BrandNotificationNoticeType"),
      ('WELCOME'::"BrandNotificationNoticeType"),
      ('PASSWORD_RESET_REQUEST'::"BrandNotificationNoticeType"),
      ('BACKOFFICE_TEMP_PASSWORD'::"BrandNotificationNoticeType"),
      ('ACCOUNT_PASSWORD_CHANGED'::"BrandNotificationNoticeType"),
      ('APPLICATION_EXTERNAL_NOTE'::"BrandNotificationNoticeType"),
      ('APPLICATION_APPROVED'::"BrandNotificationNoticeType"),
      ('SCHEDULE_ASSIGNMENT_ADDED'::"BrandNotificationNoticeType"),
      ('SCHEDULE_ASSIGNMENT_UPDATED'::"BrandNotificationNoticeType"),
      ('SCHEDULE_ASSIGNMENT_REMOVED'::"BrandNotificationNoticeType"),
      ('COMPLIANCE_DOCS_REMINDER'::"BrandNotificationNoticeType"),
      ('UPCOMING_EVENT_REMINDER'::"BrandNotificationNoticeType")
) AS t("noticeType")
WHERE NOT EXISTS (
    SELECT 1
    FROM "BrandNotificationControl" existing
    WHERE existing."brandId" = b."id"
      AND existing."noticeType" = t."noticeType"
);

INSERT INTO "BrandNotificationTemplate" (
    "id",
    "brandId",
    "noticeType",
    "subjectTemplate",
    "bodyHtmlTemplate",
    "bodyTextTemplate",
    "isCustomized",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('brand-notification-template-', b."id", '-', LOWER(REPLACE(t."noticeType"::text, '_', '-'))),
    b."id",
    t."noticeType",
    t."subjectTemplate",
    t."bodyHtmlTemplate",
    t."bodyTextTemplate",
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Brand" b
CROSS JOIN (
    VALUES
      (
        'ACCOUNT_VERIFICATION'::"BrandNotificationNoticeType",
        'Verify your email for {{BrandName}}',
        '<p>Hello {{FirstName}},</p><p>Thanks for signing up for {{BrandName}}.</p><p>Please verify your email to activate your account.</p><p><a href="{{PortalUrl}}">Verify email</a></p>',
        E'Hello {{FirstName}},\n\nThanks for signing up for {{BrandName}}.\nPlease verify your email to activate your account:\n{{PortalUrl}}'
      ),
      (
        'WELCOME'::"BrandNotificationNoticeType",
        'Welcome to {{BrandName}}',
        '<p>Hello {{FirstName}},</p><p>Your account for {{BrandName}} is now active.</p><p>You can continue in the portal here: <a href="{{PortalUrl}}">Open portal</a></p>',
        E'Hello {{FirstName}},\n\nYour account for {{BrandName}} is now active.\nOpen the portal here:\n{{PortalUrl}}'
      ),
      (
        'PASSWORD_RESET_REQUEST'::"BrandNotificationNoticeType",
        'Reset your {{BrandName}} password',
        '<p>Hello {{FirstName}},</p><p>We received a request to reset your password for {{BrandName}}.</p><p><a href="{{PortalUrl}}">Reset password</a></p>',
        E'Hello {{FirstName}},\n\nWe received a request to reset your password for {{BrandName}}.\nReset it here:\n{{PortalUrl}}'
      ),
      (
        'BACKOFFICE_TEMP_PASSWORD'::"BrandNotificationNoticeType",
        'Temporary password for {{BrandName}}',
        '<p>Hello {{FirstName}},</p><p>A temporary password was issued for your {{BrandName}} account.</p><p>Use the temporary password provided in this email, then sign in and change it immediately.</p><p><a href="{{PortalUrl}}">Open portal</a></p>',
        E'Hello {{FirstName}},\n\nA temporary password was issued for your {{BrandName}} account.\nUse the temporary password provided in this email, then sign in and change it immediately.\n{{PortalUrl}}'
      ),
      (
        'ACCOUNT_PASSWORD_CHANGED'::"BrandNotificationNoticeType",
        'Your {{BrandName}} password was changed',
        '<p>Hello {{FirstName}},</p><p>Your password for {{BrandName}} was changed successfully.</p><p>If this was not you, contact support immediately.</p>',
        E'Hello {{FirstName}},\n\nYour password for {{BrandName}} was changed successfully.\nIf this was not you, contact support immediately.'
      ),
      (
        'APPLICATION_EXTERNAL_NOTE'::"BrandNotificationNoticeType",
        '{{BrandName}} application update for {{EventName}}',
        '<p>Hello {{FirstName}},</p><p>The event team added a new note to your application for <strong>{{EventName}}</strong>.</p><p>Status: {{Status}}</p><p><a href="{{PortalUrl}}">Review application</a></p>',
        E'Hello {{FirstName}},\n\nThe event team added a new note to your application for {{EventName}}.\nStatus: {{Status}}\nReview it here:\n{{PortalUrl}}'
      ),
      (
        'APPLICATION_APPROVED'::"BrandNotificationNoticeType",
        'Your {{EventName}} application was approved',
        '<p>Hello {{FirstName}},</p><p>Your application for <strong>{{EventName}}</strong> has been approved.</p><p>Status: {{Status}}</p><p><a href="{{PortalUrl}}">View application</a></p>',
        E'Hello {{FirstName}},\n\nYour application for {{EventName}} has been approved.\nStatus: {{Status}}\nView it here:\n{{PortalUrl}}'
      ),
      (
        'SCHEDULE_ASSIGNMENT_ADDED'::"BrandNotificationNoticeType",
        'You were scheduled for {{EventName}}',
        '<p>Hello {{FirstName}},</p><p>You were added to the event schedule for <strong>{{EventName}}</strong>.</p><p>Date: {{EventDate}}</p><p><a href="{{PortalUrl}}">View schedule</a></p>',
        E'Hello {{FirstName}},\n\nYou were added to the event schedule for {{EventName}}.\nDate: {{EventDate}}\nView the schedule here:\n{{PortalUrl}}'
      ),
      (
        'SCHEDULE_ASSIGNMENT_UPDATED'::"BrandNotificationNoticeType",
        'Your {{EventName}} schedule changed',
        '<p>Hello {{FirstName}},</p><p>Your schedule for <strong>{{EventName}}</strong> has changed.</p><p>Date: {{EventDate}}</p><p><a href="{{PortalUrl}}">Review schedule</a></p>',
        E'Hello {{FirstName}},\n\nYour schedule for {{EventName}} has changed.\nDate: {{EventDate}}\nReview it here:\n{{PortalUrl}}'
      ),
      (
        'SCHEDULE_ASSIGNMENT_REMOVED'::"BrandNotificationNoticeType",
        'Your {{EventName}} assignment was removed',
        '<p>Hello {{FirstName}},</p><p>Your assignment for <strong>{{EventName}}</strong> was removed.</p><p>If you have questions, contact the event team.</p><p><a href="{{PortalUrl}}">Open portal</a></p>',
        E'Hello {{FirstName}},\n\nYour assignment for {{EventName}} was removed.\nIf you have questions, contact the event team.\n{{PortalUrl}}'
      ),
      (
        'COMPLIANCE_DOCS_REMINDER'::"BrandNotificationNoticeType",
        'Outstanding compliance documents for {{EventName}}',
        '<p>Hello {{FirstName}},</p><p>You still have outstanding compliance documents for <strong>{{EventName}}</strong>.</p><p>Status: {{Status}}</p><p><a href="{{PortalUrl}}">Review discrepancies</a></p>',
        E'Hello {{FirstName}},\n\nYou still have outstanding compliance documents for {{EventName}}.\nStatus: {{Status}}\nReview them here:\n{{PortalUrl}}'
      ),
      (
        'UPCOMING_EVENT_REMINDER'::"BrandNotificationNoticeType",
        '{{EventName}} is coming up',
        '<p>Hello {{FirstName}},</p><p>This is a reminder about your upcoming event: <strong>{{EventName}}</strong>.</p><p>Date: {{EventDate}}</p><p><a href="{{PortalUrl}}">Open portal</a></p>',
        E'Hello {{FirstName}},\n\nThis is a reminder about your upcoming event: {{EventName}}.\nDate: {{EventDate}}\nOpen the portal here:\n{{PortalUrl}}'
      )
) AS t("noticeType", "subjectTemplate", "bodyHtmlTemplate", "bodyTextTemplate")
WHERE NOT EXISTS (
    SELECT 1
    FROM "BrandNotificationTemplate" existing
    WHERE existing."brandId" = b."id"
      AND existing."noticeType" = t."noticeType"
);
