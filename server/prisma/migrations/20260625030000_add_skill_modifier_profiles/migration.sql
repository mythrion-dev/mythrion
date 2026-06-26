-- Create SkillModifierProfile table
CREATE TABLE "SkillModifierProfile" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillModifierProfile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SkillModifierProfile_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SkillModifierProfile_templateId_idx" ON "SkillModifierProfile"("templateId");
CREATE UNIQUE INDEX "SkillModifierProfile_templateId_name_key" ON "SkillModifierProfile"("templateId", "name");

-- Create ProfileOption table
CREATE TABLE "ProfileOption" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileOption_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProfileOption_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SkillModifierProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProfileOption_profileId_idx" ON "ProfileOption"("profileId");
CREATE UNIQUE INDEX "ProfileOption_profileId_label_key" ON "ProfileOption"("profileId", "label");

-- Create CharacterSheetSkillProfileValue table (stores player selections)
CREATE TABLE "CharacterSheetSkillProfileValue" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "optionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterSheetSkillProfileValue_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CharacterSheetSkillProfileValue_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "CharacterSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterSheetSkillProfileValue_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "TemplateSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterSheetSkillProfileValue_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SkillModifierProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterSheetSkillProfileValue_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ProfileOption"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "CharacterSheetSkillProfileValue_sheetId_idx" ON "CharacterSheetSkillProfileValue"("sheetId");
CREATE INDEX "CharacterSheetSkillProfileValue_skillId_idx" ON "CharacterSheetSkillProfileValue"("skillId");
CREATE UNIQUE INDEX "CharacterSheetSkillProfileValue_sheetId_skillId_profileId_key" ON "CharacterSheetSkillProfileValue"("sheetId", "skillId", "profileId");