/**
 * Data migration: Backfill Template ownership, visibility, and create Adventure snapshots.
 *
 * This script must be run AFTER the "decouple_templates" migration has been applied.
 *
 * What it does:
 * 1. Backfill ownerId for templates where ownerId IS NULL (from Adventure.ownerId)
 * 2. Backfill isPublic for templates (from Adventure.isPublic, or false for standalone)
 * 3. Create template_snapshot for all Adventures that have templates
 *
 * Run: npx ts-node prisma/scripts/backfill-template-ownership.ts
 */
import { PrismaClient } from '../../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'

// ── Types for snapshot structure ──

interface SnapshotAttribute {
  id: string
  templateId: string
  key: string
  name: string
  order: number
}

interface SnapshotField {
  id: string
  templateId: string
  key: string
  label: string
  order: number
}

interface SnapshotSkill {
  id: string
  templateId: string
  name: string
  description: string | null
  attributeId: string | null
  allowedAttributeIds: string[]
  defaultAttributeId: string | null
  order: number
}

interface SnapshotProfileOption {
  id: string
  profileId: string
  label: string
  value: number
  order: number
}

interface SnapshotModifierProfile {
  id: string
  templateId: string
  name: string
  order: number
  targetMode: string
  targetSkillIds: string[]
  options: SnapshotProfileOption[]
}

interface SnapshotCoreResource {
  id: string
  templateId: string
  slug: string
  displayName: string
  enabled: boolean
  editableByPlayer: boolean
  showNotes: boolean
  color: string | null
  order: number
}

interface SnapshotAcAttributeModifier {
  id: string
  armorClassId: string
  attributeId: string
  allowPlayerSelection: boolean
  defaultAttributeId: string | null
}

interface SnapshotAcField {
  id: string
  armorClassId: string
  name: string
  key: string
  defaultValue: string
  editableByPlayer: boolean
  description: string | null
  order: number
}

interface SnapshotArmorClass {
  id: string
  templateId: string
  name: string
  enabled: boolean
  attributeModifiers: SnapshotAcAttributeModifier[]
  fields: SnapshotAcField[]
}

interface SnapshotResistanceAttributeModifier {
  id: string
  resistanceId: string
  attributeId: string
  enabled: boolean
}

interface SnapshotResistanceComponent {
  id: string
  resistanceId: string
  name: string
  editableByPlayer: boolean
  defaultValue: string
  order: number
}

interface SnapshotResistance {
  id: string
  templateId: string
  name: string
  calculationType: string
  order: number
  components: SnapshotResistanceComponent[]
  attributeModifiers: SnapshotResistanceAttributeModifier[]
}

interface SnapshotCharacterSection {
  id: string
  templateId: string
  name: string
  order: number
}

interface TemplateSnapshot {
  id: string
  name: string
  description: string | null
  attributeModifierFormula: string | null
  attributeModifiersEnabled: boolean
  skillFormula: string | null
  attributes: SnapshotAttribute[]
  templateFields: SnapshotField[]
  templateSkills: SnapshotSkill[]
  skillModifierProfiles: SnapshotModifierProfile[]
  coreResources: SnapshotCoreResource[]
  armorClasses: SnapshotArmorClass[]
  characterSections: SnapshotCharacterSection[]
  resistances: SnapshotResistance[]
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('=== Starting template ownership & snapshot backfill ===\n')

  // ── Phase 1: Backfill ownerId ──
  const templatesWithoutOwner = await prisma.template.findMany({
    where: { ownerId: null as any },
    include: { adventure: { select: { ownerId: true } } },
  })
  console.log(
    `Found ${templatesWithoutOwner.length} templates without ownerId`,
  )

  let backfilled = 0
  let orphaned = 0
  for (const tpl of templatesWithoutOwner) {
    if (tpl.adventure?.ownerId) {
      await prisma.template.update({
        where: { id: tpl.id },
        data: { ownerId: tpl.adventure.ownerId },
      })
      backfilled++
    } else {
      // Orphan template — no adventure and no owner. Log and skip.
      console.warn(
        `  ⚠ Skipping template "${tpl.id}" (no adventure, no ownerId)`,
      )
      orphaned++
    }
  }
  console.log(`  → Backfilled: ${backfilled}, Orphaned/skipped: ${orphaned}`)

  // ── Phase 2: Backfill isPublic ──
  const templates = await prisma.template.findMany({
    include: { adventure: { select: { isPublic: true } } },
  })

  let publicSet = 0
  for (const tpl of templates) {
    const isPublic = tpl.adventure?.isPublic ?? false
    if (tpl.isPublic !== isPublic) {
      await prisma.template.update({
        where: { id: tpl.id },
        data: { isPublic },
      })
      publicSet++
    }
  }
  console.log(`Set isPublic for ${publicSet} templates`)

  // ── Phase 3: Create snapshots for Adventures with templates ──
  const adventuresWithTemplates = await prisma.adventure.findMany({
    where: {
      templates: { some: {} },
      templateSnapshot: null as any,
    },
    include: {
      templates: {
        orderBy: { createdAt: 'asc' },
        take: 1,
        include: {
          attributes: { orderBy: { order: 'asc' } },
          templateFields: { orderBy: { order: 'asc' } },
          templateSkills: {
            orderBy: { order: 'asc' },
          },
          skillModifierProfiles: {
            orderBy: { order: 'asc' },
            include: {
              options: { orderBy: { order: 'asc' } },
            },
          },
          coreResources: { orderBy: { order: 'asc' } },
          armorClasses: {
            orderBy: { name: 'asc' },
            include: {
              attributeModifiers: true,
              fields: { orderBy: { order: 'asc' } },
            },
          },
          characterSections: { orderBy: { order: 'asc' } },
          resistances: {
            orderBy: { order: 'asc' },
            include: {
              components: { orderBy: { order: 'asc' } },
              attributeModifiers: true,
            },
          },
        },
      },
    },
  })
  console.log(
    `\nFound ${adventuresWithTemplates.length} adventures without snapshots (have templates)`,
  )

  let snapshotsCreated = 0
  for (const adventure of adventuresWithTemplates) {
    const template = adventure.templates[0]
    if (!template) {
      console.warn(
        `  ⚠ Adventure "${adventure.id}" has no templates despite some:{} filter — skipping`,
      )
      continue
    }

    const snapshot: TemplateSnapshot = {
      id: template.id,
      name: template.name,
      description: template.description,
      attributeModifierFormula: template.attributeModifierFormula,
      attributeModifiersEnabled: template.attributeModifiersEnabled,
      skillFormula: template.skillFormula,
      attributes: template.attributes.map((a) => ({
        id: a.id,
        templateId: a.templateId,
        key: a.key,
        name: a.name,
        order: a.order,
      })),
      templateFields: template.templateFields.map((f) => ({
        id: f.id,
        templateId: f.templateId,
        key: f.key,
        label: f.label,
        order: f.order,
      })),
      templateSkills: template.templateSkills.map((s) => ({
        id: s.id,
        templateId: s.templateId,
        name: s.name,
        description: s.description,
        attributeId: s.attributeId,
        allowedAttributeIds: s.allowedAttributeIds,
        defaultAttributeId: s.defaultAttributeId,
        order: s.order,
      })),
      skillModifierProfiles: template.skillModifierProfiles.map((p) => ({
        id: p.id,
        templateId: p.templateId,
        name: p.name,
        order: p.order,
        targetMode: p.targetMode,
        targetSkillIds: p.targetSkillIds,
        options: p.options.map((o) => ({
          id: o.id,
          profileId: o.profileId,
          label: o.label,
          value: o.value,
          order: o.order,
        })),
      })),
      coreResources: template.coreResources.map((cr) => ({
        id: cr.id,
        templateId: cr.templateId,
        slug: cr.slug,
        displayName: cr.displayName,
        enabled: cr.enabled,
        editableByPlayer: cr.editableByPlayer,
        showNotes: cr.showNotes,
        color: cr.color,
        order: cr.order,
      })),
      armorClasses: template.armorClasses.map((ac) => ({
        id: ac.id,
        templateId: ac.templateId,
        name: ac.name,
        enabled: ac.enabled,
        attributeModifiers: ac.attributeModifiers.map((am) => ({
          id: am.id,
          armorClassId: am.armorClassId,
          attributeId: am.attributeId,
          allowPlayerSelection: am.allowPlayerSelection,
          defaultAttributeId: am.defaultAttributeId,
        })),
        fields: ac.fields.map((f) => ({
          id: f.id,
          armorClassId: f.armorClassId,
          name: f.name,
          key: f.key,
          defaultValue: f.defaultValue,
          editableByPlayer: f.editableByPlayer,
          description: f.description,
          order: f.order,
        })),
      })),
      characterSections: template.characterSections.map((cs) => ({
        id: cs.id,
        templateId: cs.templateId,
        name: cs.name,
        order: cs.order,
      })),
      resistances: template.resistances.map((r) => ({
        id: r.id,
        templateId: r.templateId,
        name: r.name,
        calculationType: r.calculationType,
        order: r.order,
        components: r.components.map((c) => ({
          id: c.id,
          resistanceId: c.resistanceId,
          name: c.name,
          editableByPlayer: c.editableByPlayer,
          defaultValue: c.defaultValue,
          order: c.order,
        })),
        attributeModifiers: r.attributeModifiers.map((am) => ({
          id: am.id,
          resistanceId: am.resistanceId,
          attributeId: am.attributeId,
          enabled: am.enabled,
        })),
      })),
    }

    await prisma.adventure.update({
      where: { id: adventure.id },
      data: {
        templateSnapshot: snapshot as any,
        originalTemplateId: template.id,
      },
    })
    snapshotsCreated++
  }
  console.log(`  → Snapshots created: ${snapshotsCreated}`)

  // ── Summary ──
  const totalTemplates = await prisma.template.count()
  const stillOrphaned = await prisma.template.count({
    where: { ownerId: null as any },
  })
  const adventuresWithSnapshot = await prisma.adventure.count({
    where: { templateSnapshot: { not: null as any } },
  })
  const adventuresTotal = await prisma.adventure.count()

  console.log('\n=== Summary ===')
  console.log(`Total templates: ${totalTemplates}`)
  console.log(`Templates with ownerId: ${totalTemplates - stillOrphaned}`)
  console.log(`Templates without ownerId (still orphaned): ${stillOrphaned}`)
  console.log(
    `Adventures with snapshots: ${adventuresWithSnapshot} / ${adventuresTotal}`,
  )
  console.log('\nDone! Ready to apply ALTER COLUMN "ownerId" SET NOT NULL.')
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
