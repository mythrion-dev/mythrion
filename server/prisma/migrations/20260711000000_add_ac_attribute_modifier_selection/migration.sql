-- Add ArmorClassAttributeModifier join table (replaces TemplateArmorClass.attributeModifierIds)
CREATE TABLE "ArmorClassAttributeModifier" (
    "id" TEXT NOT NULL,
    "armorClassId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "allowPlayerSelection" BOOLEAN NOT NULL DEFAULT false,
    "defaultAttributeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArmorClassAttributeModifier_pkey" PRIMARY KEY ("id")
);

-- Add CharacterSheetArmorClassAttributeValue table for per-character selections
CREATE TABLE "CharacterSheetArmorClassAttributeValue" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "acAttributeModifierId" TEXT NOT NULL,
    "selectedAttributeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterSheetArmorClassAttributeValue_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "ArmorClassAttributeModifier_armorClassId_idx" ON "ArmorClassAttributeModifier"("armorClassId");
CREATE INDEX "ArmorClassAttributeModifier_attributeId_idx" ON "ArmorClassAttributeModifier"("attributeId");
CREATE UNIQUE INDEX "ArmorClassAttributeModifier_armorClassId_attributeId_key" ON "ArmorClassAttributeModifier"("armorClassId", "attributeId");
CREATE UNIQUE INDEX "CharacterSheetArmorClassAttributeValue_sheetId_acAttributeModifierId_key" ON "CharacterSheetArmorClassAttributeValue"("sheetId", "acAttributeModifierId");
CREATE INDEX "CharacterSheetArmorClassAttributeValue_sheetId_idx" ON "CharacterSheetArmorClassAttributeValue"("sheetId");
CREATE INDEX "CharacterSheetArmorClassAttributeValue_acAttributeModifierId_idx" ON "CharacterSheetArmorClassAttributeValue"("acAttributeModifierId");
CREATE INDEX "CharacterSheetArmorClassAttributeValue_selectedAttributeId_idx" ON "CharacterSheetArmorClassAttributeValue"("selectedAttributeId");

-- Foreign Keys
ALTER TABLE "ArmorClassAttributeModifier" ADD CONSTRAINT "ArmorClassAttributeModifier_armorClassId_fkey" FOREIGN KEY ("armorClassId") REFERENCES "TemplateArmorClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArmorClassAttributeModifier" ADD CONSTRAINT "ArmorClassAttributeModifier_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "TemplateAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArmorClassAttributeModifier" ADD CONSTRAINT "ArmorClassAttributeModifier_defaultAttributeId_fkey" FOREIGN KEY ("defaultAttributeId") REFERENCES "TemplateAttribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CharacterSheetArmorClassAttributeValue" ADD CONSTRAINT "CharacterSheetArmorClassAttributeValue_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "CharacterSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterSheetArmorClassAttributeValue" ADD CONSTRAINT "CharacterSheetArmorClassAttributeValue_acAttributeModifierId_fkey" FOREIGN KEY ("acAttributeModifierId") REFERENCES "ArmorClassAttributeModifier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterSheetArmorClassAttributeValue" ADD CONSTRAINT "CharacterSheetArmorClassAttributeValue_selectedAttributeId_fkey" FOREIGN KEY ("selectedAttributeId") REFERENCES "TemplateAttribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing attributeModifierIds into the new join table
INSERT INTO "ArmorClassAttributeModifier" ("id", "armorClassId", "attributeId", "allowPlayerSelection", "defaultAttributeId", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::TEXT,
    tac."id",
    unnest(tac."attributeModifierIds"),
    false,
    NULL,
    NOW(),
    NOW()
FROM "TemplateArmorClass" tac
WHERE tac."attributeModifierIds" IS NOT NULL AND array_length(tac."attributeModifierIds", 1) > 0;

-- Drop the old column
ALTER TABLE "TemplateArmorClass" DROP COLUMN "attributeModifierIds";