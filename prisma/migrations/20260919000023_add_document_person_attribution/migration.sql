-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "documentType" TEXT,
ADD COLUMN     "personId" TEXT,
ADD COLUMN     "personType" TEXT;

-- CreateIndex
CREATE INDEX "Document_draftId_documentType_personType_personId_idx" ON "Document"("draftId", "documentType", "personType", "personId");
