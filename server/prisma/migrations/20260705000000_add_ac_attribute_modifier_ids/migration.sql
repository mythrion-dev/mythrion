-- Add attributeModifierIds column and drop formula column from TemplateArmorClass
ALTER TABLE "TemplateArmorClass" ADD COLUMN "attributeModifierIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "TemplateArmorClass" DROP COLUMN "formula";