-- Drop old Runtime Modifiers tables
DROP TABLE IF EXISTS "CharacterSheetRuntimeModifierComponentValue" CASCADE;
DROP TABLE IF EXISTS "RuntimeModifierComponent" CASCADE;
DROP TABLE IF EXISTS "TemplateRuntimeModifier" CASCADE;

-- Create Point Pools tables
CREATE TABLE "TemplatePointPool" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "defaultMaximum" INTEGER NOT NULL DEFAULT 0,
    "currentStartsFull" BOOLEAN NOT NULL DEFAULT true,
    "editableByPlayer" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplatePointPool_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TemplatePointPool_templateId_slug_key" ON "TemplatePointPool"("templateId", "slug");
CREATE INDEX "TemplatePointPool_templateId_idx" ON "TemplatePointPool"("templateId");

CREATE TABLE "CharacterSheetPointPoolValue" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "pointPoolId" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "maximum" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterSheetPointPoolValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CharacterSheetPointPoolValue_sheetId_pointPoolId_key" ON "CharacterSheetPointPoolValue"("sheetId", "pointPoolId");
CREATE INDEX "CharacterSheetPointPoolValue_sheetId_idx" ON "CharacterSheetPointPoolValue"("sheetId");
CREATE INDEX "CharacterSheetPointPoolValue_pointPoolId_idx" ON "CharacterSheetPointPoolValue"("pointPoolId");

-- Add foreign key constraints
ALTER TABLE "TemplatePointPool" ADD CONSTRAINT "TemplatePointPool_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CharacterSheetPointPoolValue" ADD CONSTRAINT "CharacterSheetPointPoolValue_sheetId_fkey"
    FOREIGN KEY ("sheetId") REFERENCES "CharacterSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CharacterSheetPointPoolValue" ADD CONSTRAINT "CharacterSheetPointPoolValue_pointPoolId_fkey"
    FOREIGN KEY ("pointPoolId") REFERENCES "TemplatePointPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;