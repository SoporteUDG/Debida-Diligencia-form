-- CreateEnum
CREATE TYPE "LinkRole" AS ENUM ('PRINCIPAL', 'RELATED', 'ADITIONAL');

-- AlterTable
ALTER TABLE "AccountContact" ADD COLUMN "isStandard" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Draft" ADD COLUMN "role" "LinkRole" NOT NULL DEFAULT 'PRINCIPAL',
ADD COLUMN "accountContactId" TEXT;

-- AlterTable
ALTER TABLE "Form" ADD COLUMN "role" "LinkRole" NOT NULL DEFAULT 'PRINCIPAL',
ADD COLUMN "accountContactId" TEXT;

-- Backfill: los adicionales existentes conservan su rol
UPDATE "Draft" SET "role" = 'ADITIONAL' WHERE "isAditional" = true;
UPDATE "Form" SET "role" = 'ADITIONAL' WHERE "isAditional" = true;

-- CreateIndex
CREATE INDEX "Draft_accountContactId_idx" ON "Draft"("accountContactId");

-- CreateIndex
CREATE INDEX "Form_accountContactId_idx" ON "Form"("accountContactId");

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_accountContactId_fkey" FOREIGN KEY ("accountContactId") REFERENCES "AccountContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_accountContactId_fkey" FOREIGN KEY ("accountContactId") REFERENCES "AccountContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
