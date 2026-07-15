-- Add npcSheetId to Adventure model
ALTER TABLE "Adventure" ADD COLUMN "npcSheetId" TEXT;

-- Add unique constraint on npcSheetId
ALTER TABLE "Adventure" ADD CONSTRAINT "Adventure_npcSheetId_key" UNIQUE ("npcSheetId");

-- Add foreign key constraint from Adventure.npcSheetId to CharacterSheet.id
ALTER TABLE "Adventure" ADD CONSTRAINT "Adventure_npcSheetId_fkey" FOREIGN KEY ("npcSheetId") REFERENCES "CharacterSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index on npcSheetId
CREATE INDEX "Adventure_npcSheetId_idx" ON "Adventure"("npcSheetId");
