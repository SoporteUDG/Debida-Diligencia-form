-- CreateTable
CREATE TABLE "Temporal" (
    "id" TEXT NOT NULL,
    "type" "FormType" NOT NULL,
    "data" JSONB NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "crmRecordId" TEXT NOT NULL,
    "crmModule" TEXT NOT NULL,
    "createdBy" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Temporal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Temporal_tokenHash_key" ON "Temporal"("tokenHash");

-- CreateIndex
CREATE INDEX "Temporal_crmRecordId_idx" ON "Temporal"("crmRecordId");

-- CreateIndex
CREATE INDEX "Temporal_expiresAt_idx" ON "Temporal"("expiresAt");
