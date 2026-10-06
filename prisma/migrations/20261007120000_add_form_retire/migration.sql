-- AlterTable
ALTER TABLE "Form" ADD COLUMN "retiredAt" TIMESTAMP(3),
ADD COLUMN "retiredReason" TEXT,
ADD COLUMN "retiredBy" TEXT,
ADD COLUMN "retiredFolderId" TEXT,
ADD COLUMN "retiredOriginFolderId" TEXT;
