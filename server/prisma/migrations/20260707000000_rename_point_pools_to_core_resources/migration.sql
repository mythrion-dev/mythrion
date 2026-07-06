-- Rename: TemplatePointPool -> TemplateCoreResource
ALTER TABLE "TemplatePointPool" RENAME TO "TemplateCoreResource";

-- Drop foreign key on CharacterSheetPointPoolValue pointing to old table
ALTER TABLE "CharacterSheetPointPoolValue" DROP CONSTRAINT IF EXISTS "CharacterSheetPointPoolValue_pointPoolId_fkey";

-- Rename: CharacterSheetPointPoolValue -> CharacterSheetCoreResourceValue  
ALTER TABLE "CharacterSheetPointPoolValue" RENAME TO "CharacterSheetCoreResourceValue";

-- Rename column: pointPoolId -> coreResourceId
ALTER TABLE "CharacterSheetCoreResourceValue" RENAME COLUMN "pointPoolId" TO "coreResourceId";

-- Add unique index on new column name
ALTER TABLE "CharacterSheetCoreResourceValue" ADD CONSTRAINT "CharacterSheetCoreResourceValue_sheetId_coreResourceId_key" UNIQUE ("sheetId", "coreResourceId");

-- Rename column: name -> displayName on TemplateCoreResource
ALTER TABLE "TemplateCoreResource" RENAME COLUMN "name" TO "displayName";

-- Add new columns to TemplateCoreResource
ALTER TABLE "TemplateCoreResource" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TemplateCoreResource" ADD COLUMN "showNotes" BOOLEAN NOT NULL DEFAULT true;

-- Add notes column to character sheet values
ALTER TABLE "CharacterSheetCoreResourceValue" ADD COLUMN "notes" TEXT DEFAULT '';

-- Add foreign key on coreResourceId
ALTER TABLE "CharacterSheetCoreResourceValue" ADD CONSTRAINT "CharacterSheetCoreResourceValue_coreResourceId_fkey" FOREIGN KEY ("coreResourceId") REFERENCES "TemplateCoreResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old unique constraint if it exists with old name
ALTER TABLE "CharacterSheetCoreResourceValue" DROP CONSTRAINT IF EXISTS "CharacterSheetPointPoolValue_sheetId_pointPoolId_key";

-- Rename the unique index on TemplateCoreResource
ALTER INDEX IF EXISTS "TemplatePointPool_templateId_slug_key" RENAME TO "TemplateCoreResource_templateId_slug_key";

-- Drop old foreign key constraints/indexes with old names
DROP INDEX IF EXISTS "TemplatePointPool_templateId_idx";
DROP INDEX IF EXISTS "CharacterSheetPointPoolValue_sheetId_idx";
DROP INDEX IF EXISTS "CharacterSheetPointPoolValue_pointPoolId_idx";

-- Create new indexes
CREATE INDEX IF NOT EXISTS "TemplateCoreResource_templateId_idx" ON "TemplateCoreResource"("templateId");
CREATE INDEX IF NOT EXISTS "CharacterSheetCoreResourceValue_sheetId_idx" ON "CharacterSheetCoreResourceValue"("sheetId");
CREATE INDEX IF NOT EXISTS "CharacterSheetCoreResourceValue_coreResourceId_idx" ON "CharacterSheetCoreResourceValue"("coreResourceId");