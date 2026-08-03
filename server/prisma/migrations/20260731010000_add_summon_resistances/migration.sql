-- Add SummonResistance: manual name + value resistances owned by a Summon.
--
-- Each resistance belongs to a CharacterAbility of type SUMMON and stores a
-- free-text name ("Fire", "Poison", ...) and a free-text value ("Immunity",
-- "Resistance", a number, ...). There are no formulas or derived modifiers --
-- everything is entered by hand. Cascade-deletes with its owning ability.

-- CreateTable
CREATE TABLE "SummonResistance" (
    "id" TEXT NOT NULL,
    "abilityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SummonResistance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SummonResistance_abilityId_idx" ON "SummonResistance"("abilityId");

-- AddForeignKey
ALTER TABLE "SummonResistance" ADD CONSTRAINT "SummonResistance_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "CharacterAbility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
