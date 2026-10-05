-- CreateTable
CREATE TABLE "AccountContact" (
    "id" TEXT NOT NULL,
    "crmId" TEXT NOT NULL,
    "accountCrmId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "email" TEXT,
    "phone" TEXT,
    "zohoCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AccountContact_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CrmContact" ADD COLUMN "accountCrmId" TEXT,
ADD COLUMN "accountContactId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AccountContact_crmId_key" ON "AccountContact"("crmId");

-- CreateIndex
CREATE INDEX "AccountContact_accountCrmId_idx" ON "AccountContact"("accountCrmId");

-- CreateIndex
CREATE INDEX "AccountContact_deletedAt_idx" ON "AccountContact"("deletedAt");

-- CreateIndex
CREATE INDEX "CrmContact_accountCrmId_idx" ON "CrmContact"("accountCrmId");

-- CreateIndex
CREATE INDEX "CrmContact_accountContactId_idx" ON "CrmContact"("accountContactId");

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_accountContactId_fkey" FOREIGN KEY ("accountContactId") REFERENCES "AccountContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
