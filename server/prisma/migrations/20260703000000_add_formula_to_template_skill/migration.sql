-- AlterTable - Add global skill formula to Template
ALTER TABLE "Template" ADD COLUMN "skillFormula" TEXT;

-- AlterTable - Remove per-skill formula from TemplateSkill
ALTER TABLE "TemplateSkill" DROP COLUMN "formula";