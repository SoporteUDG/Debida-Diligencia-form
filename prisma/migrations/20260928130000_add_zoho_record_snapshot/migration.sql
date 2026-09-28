-- CreateTable
CREATE TABLE "ZohoRecordSnapshot" (
    "id" TEXT NOT NULL,
    "crmId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZohoRecordSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZohoRecordSnapshot_crmId_key" ON "ZohoRecordSnapshot"("crmId");
