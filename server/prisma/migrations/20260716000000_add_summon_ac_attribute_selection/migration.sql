-- Create SummonArmorClassAttributeValue table for summon AC attribute modifier selection
-- Mirrors CharacterSheetArmorClassAttributeValue but per-summon instead of per-sheet

CREATE TABLE "SummonArmorClassAttributeValue" (
    "id" TEXT NOT NULL,
    "abilityId" TEXT NOT NULL,
    "acAttributeModifierId" TEXT NOT NULL,
    "selectedAttributeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SummonArmorClassAttributeValue_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one selection per summon per AC modifier
CREATE UNIQUE INDEX "SummonArmorClassAttributeValue_abilityId_acAttributeModifierId_key" ON "SummonArmorClassAttributeValue"("abilityId", "acAttributeModifierId");
CREATE INDEX "SummonArmorClassAttributeValue_abilityId_idx" ON "SummonArmorClassAttributeValue"("abilityId");
CREATE INDEX "SummonArmorClassAttributeValue_acAttributeModifierId_idx" ON "SummonArmorClassAttributeValue"("acAttributeModifierId");
CREATE INDEX "SummonArmorClassAttributeValue_selectedAttributeId_idx" ON "SummonArmorClassAttributeValue"("selectedAttributeId");

-- Foreign keys
ALTER TABLE "SummonArmorClassAttributeValue" ADD CONSTRAINT "SummonArmorClassAttributeValue_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "CharacterAbility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SummonArmorClassAttributeValue" ADD CONSTRAINT "SummonArmorClassAttributeValue_acAttributeModifierId_fkey" FOREIGN KEY ("acAttributeModifierId") REFERENCES "ArmorClassAttributeModifier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SummonArmorClassAttributeValue" ADD CONSTRAINT "SummonArmorClassAttributeValue_selectedAttributeId_fkey" FOREIGN KEY ("selectedAttributeId") REFERENCES "TemplateAttribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
