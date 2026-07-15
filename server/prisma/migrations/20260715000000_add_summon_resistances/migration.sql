-- Create SummonResistanceValue and SummonResistanceComponentValue tables
-- for ability/summon-level resistance data

-- SummonResistanceValue: stores per-summon manual resistance values
CREATE TABLE "SummonResistanceValue" (
    "id" TEXT NOT NULL,
    "abilityId" TEXT NOT NULL,
    "resistanceId" TEXT NOT NULL,
    "manualValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SummonResistanceValue_pkey" PRIMARY KEY ("id")
);

-- SummonResistanceComponentValue: stores per-summon component values (calculated only)
CREATE TABLE "SummonResistanceComponentValue" (
    "id" TEXT NOT NULL,
    "abilityId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SummonResistanceComponentValue_pkey" PRIMARY KEY ("id")
);

-- Indexes & Unique Constraints
CREATE UNIQUE INDEX "SummonResistanceValue_abilityId_resistanceId_key" ON "SummonResistanceValue"("abilityId", "resistanceId");
CREATE INDEX "SummonResistanceValue_abilityId_idx" ON "SummonResistanceValue"("abilityId");
CREATE INDEX "SummonResistanceValue_resistanceId_idx" ON "SummonResistanceValue"("resistanceId");

CREATE UNIQUE INDEX "SummonResistanceComponentValue_abilityId_componentId_key" ON "SummonResistanceComponentValue"("abilityId", "componentId");
CREATE INDEX "SummonResistanceComponentValue_abilityId_idx" ON "SummonResistanceComponentValue"("abilityId");
CREATE INDEX "SummonResistanceComponentValue_componentId_idx" ON "SummonResistanceComponentValue"("componentId");

-- Foreign Keys
ALTER TABLE "SummonResistanceValue" ADD CONSTRAINT "SummonResistanceValue_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "CharacterAbility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SummonResistanceValue" ADD CONSTRAINT "SummonResistanceValue_resistanceId_fkey" FOREIGN KEY ("resistanceId") REFERENCES "TemplateResistance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SummonResistanceComponentValue" ADD CONSTRAINT "SummonResistanceComponentValue_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "CharacterAbility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SummonResistanceComponentValue" ADD CONSTRAINT "SummonResistanceComponentValue_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "ResistanceComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
