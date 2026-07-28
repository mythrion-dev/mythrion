-- Summon System Redesign
-- Simplify SummonSkill to free-form name+value, SummonArmorClassValue to single value per summon.
-- Remove SummonSkillProfileValue, SummonArmorClassAttributeValue, SummonResistanceValue, SummonResistanceComponentValue.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. SummonSkill — data migration: populate name from TemplateSkill
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add new columns (allowing NULL temporarily for migration)
ALTER TABLE "SummonSkill" ADD COLUMN "name" TEXT;
ALTER TABLE "SummonSkill" ADD COLUMN "manualValue" INTEGER NOT NULL DEFAULT 0;

-- Backfill name from the linked TemplateSkill for records that have a skillId
UPDATE "SummonSkill"
SET "name" = "TemplateSkill"."name"
FROM "TemplateSkill"
WHERE "SummonSkill"."skillId" = "TemplateSkill"."id"
  AND "SummonSkill"."name" IS NULL;

-- For any remaining NULL names (shouldn't happen, but be safe), use a placeholder
UPDATE "SummonSkill"
SET "name" = 'Skill'
WHERE "name" IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. SummonArmorClassValue — deduplicate
-- ═══════════════════════════════════════════════════════════════════════════════

-- For summons with multiple AC value rows (one per field), keep only the one with
-- the highest numeric value. In a multi-field AC, the highest field-based value was
-- the primary AC the player would see.
DELETE FROM "SummonArmorClassValue" sacv1
WHERE sacv1."id" IN (
  SELECT sacv1_inner."id"
  FROM "SummonArmorClassValue" sacv1_inner
  INNER JOIN "SummonArmorClassValue" sacv2
    ON sacv1_inner."abilityId" = sacv2."abilityId"
    AND sacv1_inner."id" <> sacv2."id"
    AND (
      CAST(sacv2."value" AS INTEGER) > CAST(sacv1_inner."value" AS INTEGER)
      OR (
        CAST(sacv2."value" AS INTEGER) = CAST(sacv1_inner."value" AS INTEGER)
        AND sacv2."id" > sacv1_inner."id"
      )
    )
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Drop deprecated tables (and their FK/indexes via DROP TABLE CASCADE)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS "SummonSkillProfileValue" CASCADE;
DROP TABLE IF EXISTS "SummonArmorClassAttributeValue" CASCADE;
DROP TABLE IF EXISTS "SummonResistanceValue" CASCADE;
DROP TABLE IF EXISTS "SummonResistanceComponentValue" CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. SummonSkill — drop FK constraints, indexes, and old columns
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop foreign keys
ALTER TABLE "SummonSkill" DROP CONSTRAINT IF EXISTS "SummonSkill_skillId_fkey";
ALTER TABLE "SummonSkill" DROP CONSTRAINT IF EXISTS "SummonSkill_selectedAttributeId_fkey";

-- Drop unique constraint on (abilityId, skillId)
DROP INDEX IF EXISTS "SummonSkill_abilityId_skillId_key";

-- Drop index on skillId
DROP INDEX IF EXISTS "SummonSkill_skillId_idx";

-- Drop old columns
ALTER TABLE "SummonSkill" DROP COLUMN IF EXISTS "skillId";
ALTER TABLE "SummonSkill" DROP COLUMN IF EXISTS "selectedAttributeId";

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. SummonArmorClassValue — make NOT NULL + unique, drop FK and old columns
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop foreign keys
ALTER TABLE "SummonArmorClassValue" DROP CONSTRAINT IF EXISTS "SummonArmorClassValue_fieldId_fkey";
ALTER TABLE "SummonArmorClassValue" DROP CONSTRAINT IF EXISTS "SummonArmorClassValue_armorClassId_fkey";

-- Drop old unique constraint on (abilityId, fieldId)
DROP INDEX IF EXISTS "SummonArmorClassValue_abilityId_fieldId_key";

-- Drop index on armorClassId
DROP INDEX IF EXISTS "SummonArmorClassValue_armorClassId_idx";

-- Drop old columns
ALTER TABLE "SummonArmorClassValue" DROP COLUMN IF EXISTS "fieldId";
ALTER TABLE "SummonArmorClassValue" DROP COLUMN IF EXISTS "armorClassId";

-- Add unique constraint on abilityId (one AC value per summon)
CREATE UNIQUE INDEX "SummonArmorClassValue_abilityId_key" ON "SummonArmorClassValue"("abilityId");

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. Finalize SummonSkill — make name NOT NULL
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "SummonSkill" ALTER COLUMN "name" SET NOT NULL;
