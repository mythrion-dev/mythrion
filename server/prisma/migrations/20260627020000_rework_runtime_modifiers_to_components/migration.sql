-- Drop old runtime modifier tables
DROP TABLE IF EXISTS "CharacterSheetRuntimeModifierValue" CASCADE;
DROP TABLE IF EXISTS "RuntimeModifierOption" CASCADE;
DROP TYPE IF EXISTS "RuntimeModifierType" CASCADE;

-- Recreate TemplateRuntimeModifier without type, defaultValue, options
ALTER TABLE "TemplateRuntimeModifier" DROP COLUMN IF EXISTS "type" CASCADE;
ALTER TABLE "TemplateRuntimeModifier" DROP COLUMN IF EXISTS "defaultValue" CASCADE;
ALTER TABLE "TemplateRuntimeModifier" DROP COLUMN IF EXISTS "description" CASCADE;
ALTER TABLE "TemplateRuntimeModifier" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- Create RuntimeModifierComponent table
CREATE TABLE "RuntimeModifierComponent" (
    "id" TEXT NOT NULL,
    "modifierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultValue" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "formula" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuntimeModifierComponent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RuntimeModifierComponent_modifierId_fkey" FOREIGN KEY ("modifierId") REFERENCES "TemplateRuntimeModifier"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "RuntimeModifierComponent_modifierId_idx" ON "RuntimeModifierComponent"("modifierId");

-- Create CharacterSheetRuntimeModifierComponentValue table
CREATE TABLE "CharacterSheetRuntimeModifierComponentValue" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterSheetRuntimeModifierComponentValue_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CharacterSheetRuntimeModifierComponentValue_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "CharacterSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterSheetRuntimeModifierComponentValue_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "RuntimeModifierComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CharacterSheetRuntimeModifierComponentValue_sheetId_idx" ON "CharacterSheetRuntimeModifierComponentValue"("sheetId");
CREATE INDEX "CharacterSheetRuntimeModifierComponentValue_componentId_idx" ON "CharacterSheetRuntimeModifierComponentValue"("componentId");
CREATE UNIQUE INDEX "CharacterSheetRuntimeModifierComponentValue_sheetId_componentId_key" ON "CharacterSheetRuntimeModifierComponentValue"("sheetId", "componentId");