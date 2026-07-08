-- Create Resistance System tables

-- TemplateResistance: one-to-many with Template
CREATE TABLE "TemplateResistance" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calculationType" TEXT NOT NULL DEFAULT 'MANUAL',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateResistance_pkey" PRIMARY KEY ("id")
);

-- ResistanceComponent: one-to-many with TemplateResistance
CREATE TABLE "ResistanceComponent" (
    "id" TEXT NOT NULL,
    "resistanceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "editableByPlayer" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT NOT NULL DEFAULT '0',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResistanceComponent_pkey" PRIMARY KEY ("id")
);

-- ResistanceAttributeModifier: one-to-many join table (resistance <-> attribute)
CREATE TABLE "ResistanceAttributeModifier" (
    "id" TEXT NOT NULL,
    "resistanceId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResistanceAttributeModifier_pkey" PRIMARY KEY ("id")
);

-- CharacterSheetResistanceValue: stores per-sheet resistance data
CREATE TABLE "CharacterSheetResistanceValue" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "resistanceId" TEXT NOT NULL,
    "manualValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterSheetResistanceValue_pkey" PRIMARY KEY ("id")
);

-- CharacterSheetResistanceComponentValue: stores per-sheet component values (calculated only)
CREATE TABLE "CharacterSheetResistanceComponentValue" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterSheetResistanceComponentValue_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "TemplateResistance_templateId_idx" ON "TemplateResistance"("templateId");
CREATE INDEX "ResistanceComponent_resistanceId_idx" ON "ResistanceComponent"("resistanceId");
CREATE INDEX "ResistanceAttributeModifier_resistanceId_idx" ON "ResistanceAttributeModifier"("resistanceId");
CREATE INDEX "ResistanceAttributeModifier_attributeId_idx" ON "ResistanceAttributeModifier"("attributeId");
CREATE UNIQUE INDEX "ResistanceAttributeModifier_resistanceId_attributeId_key" ON "ResistanceAttributeModifier"("resistanceId", "attributeId");
CREATE UNIQUE INDEX "CharacterSheetResistanceValue_sheetId_resistanceId_key" ON "CharacterSheetResistanceValue"("sheetId", "resistanceId");
CREATE INDEX "CharacterSheetResistanceValue_sheetId_idx" ON "CharacterSheetResistanceValue"("sheetId");
CREATE INDEX "CharacterSheetResistanceValue_resistanceId_idx" ON "CharacterSheetResistanceValue"("resistanceId");
CREATE UNIQUE INDEX "CharacterSheetResistanceComponentValue_sheetId_componentId_key" ON "CharacterSheetResistanceComponentValue"("sheetId", "componentId");
CREATE INDEX "CharacterSheetResistanceComponentValue_sheetId_idx" ON "CharacterSheetResistanceComponentValue"("sheetId");
CREATE INDEX "CharacterSheetResistanceComponentValue_componentId_idx" ON "CharacterSheetResistanceComponentValue"("componentId");

-- Foreign Keys
ALTER TABLE "TemplateResistance" ADD CONSTRAINT "TemplateResistance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResistanceComponent" ADD CONSTRAINT "ResistanceComponent_resistanceId_fkey" FOREIGN KEY ("resistanceId") REFERENCES "TemplateResistance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResistanceAttributeModifier" ADD CONSTRAINT "ResistanceAttributeModifier_resistanceId_fkey" FOREIGN KEY ("resistanceId") REFERENCES "TemplateResistance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResistanceAttributeModifier" ADD CONSTRAINT "ResistanceAttributeModifier_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "TemplateAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterSheetResistanceValue" ADD CONSTRAINT "CharacterSheetResistanceValue_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "CharacterSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterSheetResistanceValue" ADD CONSTRAINT "CharacterSheetResistanceValue_resistanceId_fkey" FOREIGN KEY ("resistanceId") REFERENCES "TemplateResistance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterSheetResistanceComponentValue" ADD CONSTRAINT "CharacterSheetResistanceComponentValue_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "CharacterSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterSheetResistanceComponentValue" ADD CONSTRAINT "CharacterSheetResistanceComponentValue_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "ResistanceComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;