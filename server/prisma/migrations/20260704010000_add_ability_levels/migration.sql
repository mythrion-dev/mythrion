-- Ensure pgcrypto extension is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateTable CharacterAbilityLevel
CREATE TABLE "CharacterAbilityLevel" (
    "id" TEXT NOT NULL,
    "abilityId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "manaCost" INTEGER,
    "range" TEXT,
    "cooldown" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "damage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterAbilityLevel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CharacterAbilityLevel_abilityId_level_key" ON "CharacterAbilityLevel"("abilityId", "level");

-- CreateIndex
CREATE INDEX "CharacterAbilityLevel_abilityId_idx" ON "CharacterAbilityLevel"("abilityId");

-- AddForeignKey
ALTER TABLE "CharacterAbilityLevel" ADD CONSTRAINT "CharacterAbilityLevel_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "CharacterAbility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing ability data: create Level 1 for each existing ability with its data
INSERT INTO "CharacterAbilityLevel" ("id", "abilityId", "level", "manaCost", "cooldown", "description", "notes", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    a."id",
    1,
    a."manaCost",
    a."cooldown",
    a."description",
    a."notes",
    a."createdAt",
    a."updatedAt"
FROM "CharacterAbility" a;

-- Drop old columns from CharacterAbility (only if they exist)
ALTER TABLE "CharacterAbility" DROP COLUMN IF EXISTS "description";
ALTER TABLE "CharacterAbility" DROP COLUMN IF EXISTS "manaCost";
ALTER TABLE "CharacterAbility" DROP COLUMN IF EXISTS "cooldown";
ALTER TABLE "CharacterAbility" DROP COLUMN IF EXISTS "notes";