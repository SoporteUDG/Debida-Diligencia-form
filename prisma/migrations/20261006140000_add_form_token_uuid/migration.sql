-- AlterTable
ALTER TABLE "Form" ADD COLUMN "tokenUuid" TEXT;

-- CreateIndex
CREATE INDEX "Form_tokenUuid_idx" ON "Form"("tokenUuid");

-- Backfill: el borrador guarda el id del formulario enviado (data.submittedFormId)
UPDATE "Form" f
SET "tokenUuid" = d."token"
FROM "Draft" d
WHERE d."data"->>'submittedFormId' = f."id";
