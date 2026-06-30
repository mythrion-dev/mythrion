-- Create CharacterSheetRuntimeModifierValue table
CREATE TABLE "CharacterSheetRuntimeModifierValue" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "modifierId" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterSheetRuntimeModifierValue_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CharacterSheetRuntimeModifierValue_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "CharacterSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterSheetRuntimeModifierValue_modifierId_fkey" FOREIGN KEY ("modifierId") REFERENCES "TemplateRuntimeModifier"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CharacterSheetRuntimeModifierValue_sheetId_idx" ON "CharacterSheetRuntimeModifierValue"("sheetId");
CREATE INDEX "CharacterSheetRuntimeModifierValue_modifierId_idx" ON "CharacterSheetRuntimeModifierValue"("modifierId");
CREATE UNIQUE INDEX "CharacterSheetRuntimeModifierValue_sheetId_modifierId_key" ON "CharacterSheetRuntimeModifierValue"("sheetId", "modifierId");