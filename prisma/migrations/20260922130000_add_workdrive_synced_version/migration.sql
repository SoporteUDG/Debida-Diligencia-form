-- AlterTable
ALTER TABLE "WorkDriveSync" ADD COLUMN     "syncedVersion" INTEGER;


-- Los expedientes ya consolidados en WorkDrive corresponden a la versión 1.
UPDATE "WorkDriveSync" ws
   SET "syncedVersion" = 1
  FROM "Form" f
 WHERE ws."formId" = f."id"
   AND ws."status" = 'SUCCESS'
   AND ws."syncedVersion" IS NULL;
