-- Add NPC fields to CharacterSheet
ALTER TABLE "CharacterSheet" ADD COLUMN "isNpc" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CharacterSheet" ADD COLUMN "npcType" TEXT;

-- Make ownerId nullable (NPC sheets have no owner)
ALTER TABLE "CharacterSheet" ALTER COLUMN "ownerId" DROP NOT NULL;

-- Update foreign key constraint from CASCADE to SET NULL
ALTER TABLE "CharacterSheet" DROP CONSTRAINT "CharacterSheet_ownerId_fkey";
ALTER TABLE "CharacterSheet" ADD CONSTRAINT "CharacterSheet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index on isNpc for filtering NPC sheets
CREATE INDEX "CharacterSheet_isNpc_idx" ON "CharacterSheet"("isNpc");
