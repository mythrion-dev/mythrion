-- AlterTable
ALTER TABLE "CharacterSheet" ADD COLUMN "playerName" TEXT,
ADD COLUMN "level" INTEGER DEFAULT 1;

-- CreateTable
CREATE TABLE "CustomField" (
    "id" TEXT NOT NULL,
    "characterSheetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomField_characterSheetId_idx" ON "CustomField"("characterSheetId");

-- AddForeignKey
ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_characterSheetId_fkey" FOREIGN KEY ("characterSheetId") REFERENCES "CharacterSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;