-- Create SheetProfessionalSkillProfileValue join table linking professional skills to modifier profiles and options
CREATE TABLE "SheetProfessionalSkillProfileValue" (
    "id" TEXT NOT NULL,
    "sheetProfessionalSkillId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "optionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SheetProfessionalSkillProfileValue_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "SheetProfessionalSkillProfileValue_sheetProfessionalSkillId_idx" ON "SheetProfessionalSkillProfileValue"("sheetProfessionalSkillId");
CREATE INDEX "SheetProfessionalSkillProfileValue_profileId_idx" ON "SheetProfessionalSkillProfileValue"("profileId");
CREATE UNIQUE INDEX "SheetProfessionalSkillProfileValue_sheetProfessionalSkillId_profileId_key" ON "SheetProfessionalSkillProfileValue"("sheetProfessionalSkillId", "profileId");

-- Add foreign key constraints
ALTER TABLE "SheetProfessionalSkillProfileValue" ADD CONSTRAINT "SheetProfessionalSkillProfileValue_sheetProfessionalSkillId_fkey" FOREIGN KEY ("sheetProfessionalSkillId") REFERENCES "SheetProfessionalSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SheetProfessionalSkillProfileValue" ADD CONSTRAINT "SheetProfessionalSkillProfileValue_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SkillModifierProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SheetProfessionalSkillProfileValue" ADD CONSTRAINT "SheetProfessionalSkillProfileValue_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ProfileOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
