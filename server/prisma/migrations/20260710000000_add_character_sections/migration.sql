-- Create TemplateCharacterSection table
CREATE TABLE "TemplateCharacterSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateCharacterSection_pkey" PRIMARY KEY ("id")
);

-- Create CharacterSectionEntry table
CREATE TABLE "CharacterSectionEntry" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterSectionEntry_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "TemplateCharacterSection" ADD CONSTRAINT "TemplateCharacterSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterSectionEntry" ADD CONSTRAINT "CharacterSectionEntry_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "CharacterSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterSectionEntry" ADD CONSTRAINT "CharacterSectionEntry_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "TemplateCharacterSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX "TemplateCharacterSection_templateId_idx" ON "TemplateCharacterSection"("templateId");
CREATE INDEX "CharacterSectionEntry_sheetId_idx" ON "CharacterSectionEntry"("sheetId");
CREATE INDEX "CharacterSectionEntry_sectionId_idx" ON "CharacterSectionEntry"("sectionId");