-- AlterTable
ALTER TABLE "CrmContact" ADD COLUMN "retiredAt" TIMESTAMP(3),
ADD COLUMN "retiredReason" TEXT,
ADD COLUMN "retiredBy" TEXT,
ADD COLUMN "retiredFolderId" TEXT,
ADD COLUMN "retiredOriginFolderId" TEXT,
ADD COLUMN "missingContactAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AccountContact" ADD COLUMN "missingInZohoAt" TIMESTAMP(3);
