-- AlterTable
ALTER TABLE "CharacterSheet" ALTER COLUMN "adventureId" DROP NOT NULL;

-- AlterForeignKey
ALTER TABLE "CharacterSheet" DROP CONSTRAINT "CharacterSheet_adventureId_fkey";

ALTER TABLE "CharacterSheet" ADD CONSTRAINT "CharacterSheet_adventureId_fkey" FOREIGN KEY ("adventureId") REFERENCES "Adventure"("id") ON DELETE SET NULL ON UPDATE CASCADE;