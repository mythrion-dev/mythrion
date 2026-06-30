-- CreateTable
CREATE TABLE "TemplateArmorClass" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "formula" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateArmorClass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TemplateArmorClass_templateId_key" ON "TemplateArmorClass"("templateId");

-- CreateTable
CREATE TABLE "ArmorClassField" (
    "id" TEXT NOT NULL,
    "armorClassId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "defaultValue" TEXT NOT NULL DEFAULT '0',
    "editableByPlayer" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArmorClassField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArmorClassField_armorClassId_key_key" ON "ArmorClassField"("armorClassId", "key");

-- CreateTable
CREATE TABLE "CharacterSheetArmorClassValue" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterSheetArmorClassValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CharacterSheetArmorClassValue_sheetId_fieldId_key" ON "CharacterSheetArmorClassValue"("sheetId", "fieldId");

-- AddForeignKey
ALTER TABLE "TemplateArmorClass" ADD CONSTRAINT "TemplateArmorClass_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArmorClassField" ADD CONSTRAINT "ArmorClassField_armorClassId_fkey" FOREIGN KEY ("armorClassId") REFERENCES "TemplateArmorClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterSheetArmorClassValue" ADD CONSTRAINT "CharacterSheetArmorClassValue_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "CharacterSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterSheetArmorClassValue" ADD CONSTRAINT "CharacterSheetArmorClassValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "ArmorClassField"("id") ON DELETE CASCADE ON UPDATE CASCADE;