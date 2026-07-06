-- Make point pool values nullable to support system-agnostic approach
-- (player fills in values, template defines nothing numeric)
ALTER TABLE "CharacterSheetPointPoolValue" ALTER COLUMN "current" DROP NOT NULL;
ALTER TABLE "CharacterSheetPointPoolValue" ALTER COLUMN "maximum" DROP NOT NULL;

-- Drop template-level numeric columns if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TemplatePointPool' AND column_name = 'defaultMaximum') THEN
    ALTER TABLE "TemplatePointPool" DROP COLUMN "defaultMaximum";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TemplatePointPool' AND column_name = 'currentStartsFull') THEN
    ALTER TABLE "TemplatePointPool" DROP COLUMN "currentStartsFull";
  END IF;
END $$;