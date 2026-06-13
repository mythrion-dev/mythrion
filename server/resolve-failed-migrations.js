// Auto-resolve any failed migrations before prisma migrate deploy runs.
// This prevents P3009 errors on Railway when a previous deploy partially failed.
// Uses CommonJS-compatible imports for Node.js 24 ESM compatibility.

import prismaPkg from '@prisma/client'
import pgPkg from '@prisma/adapter-pg'

const { PrismaClient } = prismaPkg
const { PrismaPg } = pgPkg

const rawUrl = process.env.DATABASE_URL
if (!rawUrl) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const pgUrl = rawUrl.replace(/^prisma\+/, '')
const adapter = new PrismaPg(pgUrl)
const prisma = new PrismaClient({ adapter })

try {
  const result = await prisma.$queryRawUnsafe(
    `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL`,
  )

  for (const row of result) {
    console.log(`Resolving failed migration: ${row.migration_name}`)
    await prisma.$executeRawUnsafe(
      `UPDATE "_prisma_migrations" SET finished_at = NOW(), logs = NULL, applied_steps_count = 1 WHERE migration_name = $1`,
      row.migration_name,
    )
    console.log(`  ✅ Marked as resolved`)
  }

  console.log('Done — all failed migrations resolved.')
} catch (err) {
  console.error('Failed to resolve migrations:', err)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}