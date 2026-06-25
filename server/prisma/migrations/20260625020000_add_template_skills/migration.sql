-- CreateTable
CREATE TABLE "TemplateSkill" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "formula" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterSheetSkillValue" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterSheetSkillValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemplateSkill_templateId_idx" ON "TemplateSkill"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterSheetSkillValue_sheetId_skillId_key" ON "CharacterSheetSkillValue"("sheetId", "skillId");

-- CreateIndex
CREATE INDEX "CharacterSheetSkillValue_sheetId_idx" ON "CharacterSheetSkillValue"("sheetId");

-- CreateIndex
CREATE INDEX "CharacterSheetSkillValue_skillId_idx" ON "CharacterSheetSkillValue"("skillId");

-- AddForeignKey
ALTER TABLE "TemplateSkill" ADD CONSTRAINT "TemplateSkill_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterSheetSkillValue" ADD CONSTRAINT "CharacterSheetSkillValue_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "CharacterSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterSheetSkillValue" ADD CONSTRAINT "CharacterSheetSkillValue_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "TemplateSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;