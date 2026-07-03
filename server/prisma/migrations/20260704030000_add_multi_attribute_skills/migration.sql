-- Add allowedAttributeIds and defaultAttributeId to TemplateSkill
ALTER TABLE "TemplateSkill" ADD COLUMN "allowedAttributeIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "TemplateSkill" ADD COLUMN "defaultAttributeId" TEXT;

-- Add selectedAttributeId to CharacterSheetSkillValue
ALTER TABLE "CharacterSheetSkillValue" ADD COLUMN "selectedAttributeId" TEXT;

-- Create index on defaultAttributeId
CREATE INDEX "TemplateSkill_defaultAttributeId_idx" ON "TemplateSkill"("defaultAttributeId");

-- Create index on selectedAttributeId
CREATE INDEX "CharacterSheetSkillValue_selectedAttributeId_idx" ON "CharacterSheetSkillValue"("selectedAttributeId");

-- Add foreign key constraints
ALTER TABLE "TemplateSkill" ADD CONSTRAINT "TemplateSkill_defaultAttributeId_fkey" FOREIGN KEY ("defaultAttributeId") REFERENCES "TemplateAttribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CharacterSheetSkillValue" ADD CONSTRAINT "CharacterSheetSkillValue_selectedAttributeId_fkey" FOREIGN KEY ("selectedAttributeId") REFERENCES "TemplateAttribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill existing templates: for each skill with an attributeId, set allowedAttributeIds to that single attribute's id,
-- and set defaultAttributeId to that same attribute id
UPDATE "TemplateSkill"
SET "allowedAttributeIds" = ARRAY["attributeId"]::TEXT[],
    "defaultAttributeId" = "attributeId"
WHERE "attributeId" IS NOT NULL;