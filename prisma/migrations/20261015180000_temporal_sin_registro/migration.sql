-- AlterTable: el temporal se genera desde la vista de lista, sin registro de Zoho
ALTER TABLE "Temporal" ALTER COLUMN "crmRecordId" DROP NOT NULL;
