-- DropTable
DROP TABLE IF EXISTS "CustomField";

-- CreateTable
CREATE TABLE "TemplateField" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterSheetFieldValue" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "templateFieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterSheetFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemplateField_templateId_idx" ON "TemplateField"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterSheetFieldValue_sheetId_templateFieldId_key" ON "CharacterSheetFieldValue"("sheetId", "templateFieldId");

-- CreateIndex
CREATE INDEX "CharacterSheetFieldValue_sheetId_idx" ON "CharacterSheetFieldValue"("sheetId");

-- CreateIndex
CREATE INDEX "CharacterSheetFieldValue_templateFieldId_idx" ON "CharacterSheetFieldValue"("templateFieldId");

-- AddForeignKey
ALTER TABLE "TemplateField" ADD CONSTRAINT "TemplateField_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterSheetFieldValue" ADD CONSTRAINT "CharacterSheetFieldValue_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "CharacterSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterSheetFieldValue" ADD CONSTRAINT "CharacterSheetFieldValue_templateFieldId_fkey" FOREIGN KEY ("templateFieldId") REFERENCES "TemplateField"("id") ON DELETE CASCADE ON UPDATE CASCADE;