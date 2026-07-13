-- Drop the unique constraint on templateId to allow multiple ACs per template
DROP INDEX IF EXISTS "TemplateArmorClass_templateId_key";

-- Add name column with a default for existing rows
ALTER TABLE "TemplateArmorClass" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Armor Class';

-- Add armorClassId to SummonArmorClassValue so summons can reference which AC config they belong to
ALTER TABLE "SummonArmorClassValue" ADD COLUMN "armorClassId" TEXT;

-- Index on armorClassId for summon values
CREATE INDEX "SummonArmorClassValue_armorClassId_idx" ON "SummonArmorClassValue"("armorClassId");

-- Add foreign key from SummonArmorClassValue to TemplateArmorClass
ALTER TABLE "SummonArmorClassValue" ADD CONSTRAINT "SummonArmorClassValue_armorClassId_fkey" FOREIGN KEY ("armorClassId") REFERENCES "TemplateArmorClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;