-- Decouple Templates from Adventures (Phase 1: Schema Changes)
--
-- Changes:
-- - Make Template.adventureId optional (DROP NOT NULL)
-- - Change FK: Template → Adventure onDelete CASCADE → SET NULL
-- - Add Template.isPublic flag (default false for existing)
-- - Add Template.useCount counter (default 0)
-- - Add Adventure.template_snapshot (JSONB — immutable deep copy)
-- - Add Adventure.originalTemplateId (FK → Template, onDelete SET NULL)
-- - New indexes for query performance

-- Step 1: Make adventureId optional on Template
ALTER TABLE "Template" ALTER COLUMN "adventureId" DROP NOT NULL;

-- Step 2: Change FK behavior on adventureId (CASCADE → SET NULL)
ALTER TABLE "Template" DROP CONSTRAINT "Template_adventureId_fkey";
ALTER TABLE "Template" ADD CONSTRAINT "Template_adventureId_fkey"
  FOREIGN KEY ("adventureId") REFERENCES "Adventure"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 3: Add isPublic flag to Template (default false to match existing behavior)
ALTER TABLE "Template" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- Step 4: Add useCount counter to Template
ALTER TABLE "Template" ADD COLUMN "useCount" INTEGER NOT NULL DEFAULT 0;

-- Step 5: Add templateSnapshot to Adventure (stores immutable deep copy of template structure)
ALTER TABLE "Adventure" ADD COLUMN "template_snapshot" JSONB;

-- Step 6: Add originalTemplateId FK to Adventure
ALTER TABLE "Adventure" ADD COLUMN "originalTemplateId" TEXT;
ALTER TABLE "Adventure" ADD CONSTRAINT "Adventure_originalTemplateId_fkey"
  FOREIGN KEY ("originalTemplateId") REFERENCES "Template"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 7: Create new indexes
CREATE INDEX "Template_isPublic_idx" ON "Template"("isPublic");
CREATE INDEX "Template_useCount_idx" ON "Template"("useCount");
CREATE INDEX "Adventure_originalTemplateId_idx" ON "Adventure"("originalTemplateId");
