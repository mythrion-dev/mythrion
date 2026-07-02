-- AlterTable
ALTER TABLE "Template" ADD COLUMN "attributeModifierFormula" TEXT;

-- AlterTable
ALTER TABLE "TemplateAttribute" DROP COLUMN "modifier";