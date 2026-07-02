-- AlterTable - Add attributeId column if it doesn't exist (to fix broken migration 20260703000000)
ALTER TABLE "TemplateSkill" ADD COLUMN IF NOT EXISTS "attributeId" TEXT;

-- AddForeignKey (idempotent - only if column was just added / FK doesn't exist)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'TemplateSkill' AND column_name = 'attributeId'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'TemplateSkill' AND ccu.column_name = 'attributeId' AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE "TemplateSkill"
        ADD CONSTRAINT "TemplateSkill_attributeId_fkey"
        FOREIGN KEY ("attributeId") REFERENCES "TemplateAttribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "TemplateSkill_attributeId_idx" ON "TemplateSkill"("attributeId");