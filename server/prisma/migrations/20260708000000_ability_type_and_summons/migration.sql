-- Add type, description, notes to CharacterAbility
ALTER TABLE "CharacterAbility" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'ABILITY';
ALTER TABLE "CharacterAbility" ADD COLUMN "description" TEXT;
ALTER TABLE "CharacterAbility" ADD COLUMN "notes" TEXT;

-- Remove cooldown from CharacterAbilityLevel
ALTER TABLE "CharacterAbilityLevel" DROP COLUMN "cooldown";

-- Create SummonAttribute table
CREATE TABLE "SummonAttribute" (
    "id" TEXT NOT NULL,
    "abilityId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SummonAttribute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SummonAttribute_abilityId_attributeId_key" ON "SummonAttribute"("abilityId", "attributeId");
CREATE INDEX "SummonAttribute_abilityId_idx" ON "SummonAttribute"("abilityId");

-- Create SummonArmorClassValue table
CREATE TABLE "SummonArmorClassValue" (
    "id" TEXT NOT NULL,
    "abilityId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SummonArmorClassValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SummonArmorClassValue_abilityId_fieldId_key" ON "SummonArmorClassValue"("abilityId", "fieldId");
CREATE INDEX "SummonArmorClassValue_abilityId_idx" ON "SummonArmorClassValue"("abilityId");

-- Create SummonHealth table
CREATE TABLE "SummonHealth" (
    "id" TEXT NOT NULL,
    "abilityId" TEXT NOT NULL,
    "current" INTEGER,
    "maximum" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SummonHealth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SummonHealth_abilityId_key" ON "SummonHealth"("abilityId");

-- Add foreign key constraints
ALTER TABLE "SummonAttribute" ADD CONSTRAINT "SummonAttribute_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "CharacterAbility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SummonArmorClassValue" ADD CONSTRAINT "SummonArmorClassValue_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "CharacterAbility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SummonHealth" ADD CONSTRAINT "SummonHealth_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "CharacterAbility"("id") ON DELETE CASCADE ON UPDATE CASCADE;