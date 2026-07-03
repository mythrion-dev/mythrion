-- Add targeting fields to SkillModifierProfile
ALTER TABLE "SkillModifierProfile" 
ADD COLUMN "targetMode" TEXT NOT NULL DEFAULT 'ALL_SKILLS',
ADD COLUMN "targetSkillIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];