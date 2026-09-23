-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "currentVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "FormVersion" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "status" "FormStatus" NOT NULL DEFAULT 'SUBMITTED',
    "clientName" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "authorizationId" TEXT,
    "authorizedBy" TEXT,
    "reason" TEXT,
    "changedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormEditAuthorization" (
    "id" TEXT NOT NULL,
    "formId" TEXT,
    "crmContactId" TEXT NOT NULL,
    "tokenUuid" TEXT,
    "authorizedBy" TEXT NOT NULL,
    "reason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'ZOHO_REACTIVAR',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "consumedByVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormEditAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormVersion_formId_idx" ON "FormVersion"("formId");

-- CreateIndex
CREATE INDEX "FormVersion_authorizedBy_idx" ON "FormVersion"("authorizedBy");

-- CreateIndex
CREATE UNIQUE INDEX "FormVersion_formId_version_key" ON "FormVersion"("formId", "version");

-- CreateIndex
CREATE INDEX "FormEditAuthorization_crmContactId_idx" ON "FormEditAuthorization"("crmContactId");

-- CreateIndex
CREATE INDEX "FormEditAuthorization_formId_idx" ON "FormEditAuthorization"("formId");

-- CreateIndex
CREATE INDEX "FormEditAuthorization_consumedAt_idx" ON "FormEditAuthorization"("consumedAt");

-- CreateIndex
CREATE INDEX "FormEditAuthorization_tokenUuid_idx" ON "FormEditAuthorization"("tokenUuid");

-- AddForeignKey
ALTER TABLE "FormVersion" ADD CONSTRAINT "FormVersion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormVersion" ADD CONSTRAINT "FormVersion_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "FormEditAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormEditAuthorization" ADD CONSTRAINT "FormEditAuthorization_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormEditAuthorization" ADD CONSTRAINT "FormEditAuthorization_crmContactId_fkey" FOREIGN KEY ("crmContactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================================
-- Backfill: sellar los expedientes ya enviados como versión 1.
--
-- Nada se borra. Cada Form existente pasa a tener su FormVersion v1 con el
-- snapshot de su estado actual. authorizedBy/reason quedan NULL a propósito:
-- el envío original no fue autorizado por nadie, es el expediente inicial.
-- ============================================================================
INSERT INTO "FormVersion" ("id", "formId", "version", "data", "status", "clientName", "projectName", "changedFields", "submittedAt", "createdAt")
SELECT
    gen_random_uuid()::text,
    f."id",
    1,
    f."data",
    f."status",
    f."clientName",
    f."projectName",
    ARRAY[]::TEXT[],
    COALESCE(f."submittedAt", f."createdAt"),
    COALESCE(f."submittedAt", f."createdAt")
FROM "Form" f
WHERE NOT EXISTS (
    SELECT 1 FROM "FormVersion" v WHERE v."formId" = f."id" AND v."version" = 1
);

-- Los expedientes existentes quedan en la versión 1
UPDATE "Form" SET "currentVersion" = 1 WHERE "currentVersion" IS NULL OR "currentVersion" < 1;
