-- Add summonId to CharacterAbility for summon-scoped child abilities
ALTER TABLE "CharacterAbility" ADD COLUMN "summonId" TEXT;

-- Add foreign key from summonId back to CharacterAbility (self-relation)
ALTER TABLE "CharacterAbility" ADD CONSTRAINT "CharacterAbility_summonId_fkey" FOREIGN KEY ("summonId") REFERENCES "CharacterAbility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create index on summonId
CREATE INDEX "CharacterAbility_summonId_idx" ON "CharacterAbility"("summonId");

-- Add foreign key from SummonArmorClassValue to ArmorClassField (field relation)
ALTER TABLE "SummonArmorClassValue" ADD CONSTRAINT "SummonArmorClassValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "ArmorClassField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create SummonSkill table
CREATE TABLE "SummonSkill" (
    "id" TEXT NOT NULL,
    "abilityId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "selectedAttributeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SummonSkill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SummonSkill_abilityId_skillId_key" ON "SummonSkill"("abilityId", "skillId");
CREATE INDEX "SummonSkill_abilityId_idx" ON "SummonSkill"("abilityId");
CREATE INDEX "SummonSkill_skillId_idx" ON "SummonSkill"("skillId");

-- Add foreign keys for SummonSkill
ALTER TABLE "SummonSkill" ADD CONSTRAINT "SummonSkill_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "CharacterAbility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SummonSkill" ADD CONSTRAINT "SummonSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "TemplateSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SummonSkill" ADD CONSTRAINT "SummonSkill_selectedAttributeId_fkey" FOREIGN KEY ("selectedAttributeId") REFERENCES "TemplateAttribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create SummonSkillProfileValue table
CREATE TABLE "SummonSkillProfileValue" (
    "id" TEXT NOT NULL,
    "summonSkillId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "optionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SummonSkillProfileValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SummonSkillProfileValue_summonSkillId_profileId_key" ON "SummonSkillProfileValue"("summonSkillId", "profileId");
CREATE INDEX "SummonSkillProfileValue_summonSkillId_idx" ON "SummonSkillProfileValue"("summonSkillId");

-- Add foreign keys for SummonSkillProfileValue
ALTER TABLE "SummonSkillProfileValue" ADD CONSTRAINT "SummonSkillProfileValue_summonSkillId_fkey" FOREIGN KEY ("summonSkillId") REFERENCES "SummonSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SummonSkillProfileValue" ADD CONSTRAINT "SummonSkillProfileValue_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SkillModifierProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SummonSkillProfileValue" ADD CONSTRAINT "SummonSkillProfileValue_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ProfileOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;