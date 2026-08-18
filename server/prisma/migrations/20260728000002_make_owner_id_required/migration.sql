-- Make Template.ownerId required and update FK behavior
--
-- IMPORTANT: Run the backfill script BEFORE applying this migration:
--   npx ts-node prisma/scripts/backfill-template-ownership.ts
--
-- Changes:
-- - Template.ownerId SET NOT NULL (must be backfilled first)
-- - Change FK: Template → User onDelete SET NULL → CASCADE

ALTER TABLE "Template" ALTER COLUMN "ownerId" SET NOT NULL;

ALTER TABLE "Template" DROP CONSTRAINT "Template_ownerId_fkey";
ALTER TABLE "Template" ADD CONSTRAINT "Template_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
