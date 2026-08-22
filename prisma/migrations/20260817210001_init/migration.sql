-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPERADMIN', 'ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "FormType" AS ENUM ('NATURAL', 'JURIDICA');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('ACCESS', 'VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmContact" (
    "id" TEXT NOT NULL,
    "crmId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL,
    "type" "FormType" NOT NULL,
    "status" "FormStatus" NOT NULL DEFAULT 'SUBMITTED',
    "clientName" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "crmContactId" TEXT,
    "data" JSONB NOT NULL,
    "conclusionesVerificacion" TEXT,
    "submittedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "type" "TokenType" NOT NULL,
    "crmContactId" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "type" "FormType" NOT NULL,
    "data" JSONB NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 1,
    "token" TEXT NOT NULL,
    "crmContactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "formId" TEXT,
    "draftId" TEXT,
    "name" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GjcMember" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "nacionalidad" TEXT NOT NULL,
    "fechaNacimiento" TIMESTAMP(3),
    "nroId" TEXT NOT NULL,
    "direccion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GjcMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BfMember" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "noIdentificacion" TEXT NOT NULL,
    "nacionalidad" TEXT NOT NULL,
    "fechaAdquisicion" TIMESTAMP(3),
    "porcentajeParticipacion" TEXT,
    "paisNacimiento" TEXT NOT NULL,
    "direccion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BfMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalRepresentative" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaNacimiento" TIMESTAMP(3),
    "nacionalidad" TEXT NOT NULL,
    "noIdentificacion" TEXT NOT NULL,
    "profesionOcupacion" TEXT,
    "actividadEconomica" TEXT,
    "direccion" TEXT,
    "paisResidencia" TEXT,
    "telefono" TEXT,
    "objetoInvestigacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalRepresentative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signatureDate" TIMESTAMP(3) NOT NULL,
    "firmaImage" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmSync" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "crmId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttempt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkDriveSync" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "folderUrl" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttempt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkDriveSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SapSync" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "sapCardCode" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttempt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SapSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AdminUser_email_idx" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AdminUser_deletedAt_idx" ON "AdminUser"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrmContact_crmId_key" ON "CrmContact"("crmId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmContact_email_key" ON "CrmContact"("email");

-- CreateIndex
CREATE INDEX "CrmContact_crmId_idx" ON "CrmContact"("crmId");

-- CreateIndex
CREATE INDEX "CrmContact_email_idx" ON "CrmContact"("email");

-- CreateIndex
CREATE INDEX "CrmContact_deletedAt_idx" ON "CrmContact"("deletedAt");

-- CreateIndex
CREATE INDEX "Form_status_idx" ON "Form"("status");

-- CreateIndex
CREATE INDEX "Form_crmContactId_idx" ON "Form"("crmContactId");

-- CreateIndex
CREATE INDEX "Form_createdAt_idx" ON "Form"("createdAt");

-- CreateIndex
CREATE INDEX "Form_submittedAt_idx" ON "Form"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Token_token_key" ON "Token"("token");

-- CreateIndex
CREATE INDEX "Token_token_idx" ON "Token"("token");

-- CreateIndex
CREATE INDEX "Token_crmContactId_idx" ON "Token"("crmContactId");

-- CreateIndex
CREATE INDEX "Token_expiresAt_idx" ON "Token"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Draft_token_key" ON "Draft"("token");

-- CreateIndex
CREATE INDEX "Draft_token_idx" ON "Draft"("token");

-- CreateIndex
CREATE INDEX "Draft_crmContactId_idx" ON "Draft"("crmContactId");

-- CreateIndex
CREATE INDEX "Document_formId_idx" ON "Document"("formId");

-- CreateIndex
CREATE INDEX "Document_draftId_idx" ON "Document"("draftId");

-- CreateIndex
CREATE INDEX "GjcMember_formId_idx" ON "GjcMember"("formId");

-- CreateIndex
CREATE INDEX "BfMember_formId_idx" ON "BfMember"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "LegalRepresentative_formId_key" ON "LegalRepresentative"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "Signature_formId_key" ON "Signature"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmSync_formId_key" ON "CrmSync"("formId");

-- CreateIndex
CREATE INDEX "CrmSync_status_idx" ON "CrmSync"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkDriveSync_formId_key" ON "WorkDriveSync"("formId");

-- CreateIndex
CREATE INDEX "WorkDriveSync_status_idx" ON "WorkDriveSync"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SapSync_formId_key" ON "SapSync"("formId");

-- CreateIndex
CREATE INDEX "SapSync_status_idx" ON "SapSync"("status");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityName_entityId_idx" ON "AuditLog"("entityName", "entityId");

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_crmContactId_fkey" FOREIGN KEY ("crmContactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_crmContactId_fkey" FOREIGN KEY ("crmContactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_crmContactId_fkey" FOREIGN KEY ("crmContactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GjcMember" ADD CONSTRAINT "GjcMember_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BfMember" ADD CONSTRAINT "BfMember_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalRepresentative" ADD CONSTRAINT "LegalRepresentative_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmSync" ADD CONSTRAINT "CrmSync_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkDriveSync" ADD CONSTRAINT "WorkDriveSync_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SapSync" ADD CONSTRAINT "SapSync_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
