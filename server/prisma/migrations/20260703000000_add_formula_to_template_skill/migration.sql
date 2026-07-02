-- AlterTable - Add global skill formula to Template
ALTER TABLE "Template" ADD COLUMN "skillFormula" TEXT;

-- AlterTable - Remove per-skill formula from TemplateSkill
ALTER TABLE "TemplateSkill" DROP COLUMN "formula";

-- AlterTable - Add attributeId to TemplateSkill
ALTER TABLE "TemplateSkill" ADD COLUMN "attributeId" TEXT;

-- AddForeignKey
ALTER TABLE "TemplateSkill" ADD CONSTRAINT "TemplateSkill_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "TemplateAttribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "TemplateSkill_attributeId_idx" ON "TemplateSkill"("attributeId");