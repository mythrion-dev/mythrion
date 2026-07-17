-- Create SheetProfessionalSkill table (character-specific skills, not template-defined)
CREATE TABLE "SheetProfessionalSkill" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attributeId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SheetProfessionalSkill_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "SheetProfessionalSkill_sheetId_idx" ON "SheetProfessionalSkill"("sheetId");
CREATE INDEX "SheetProfessionalSkill_attributeId_idx" ON "SheetProfessionalSkill"("attributeId");
CREATE UNIQUE INDEX "SheetProfessionalSkill_sheetId_name_key" ON "SheetProfessionalSkill"("sheetId", "name");

-- Add foreign key constraints
ALTER TABLE "SheetProfessionalSkill" ADD CONSTRAINT "SheetProfessionalSkill_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "CharacterSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SheetProfessionalSkill" ADD CONSTRAINT "SheetProfessionalSkill_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "TemplateAttribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
