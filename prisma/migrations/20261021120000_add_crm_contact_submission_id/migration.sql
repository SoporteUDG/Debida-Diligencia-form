-- AlterTable
ALTER TABLE "CrmContact" ADD COLUMN "submissionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CrmContact_submissionId_key" ON "CrmContact"("submissionId");
