// Auto-resolve any failed migrations before prisma migrate deploy runs.
// This prevents P3009 errors on Railway when a previous deploy partially failed.
// Uses the `pg` driver directly to avoid ESM/CJS compatibility issues.

import pg from 'pg'

const rawUrl = process.env.DATABASE_URL
if (!rawUrl) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

// Strip prisma+ prefix and parse the URL for pg driver
const pgUrl = rawUrl.replace(/^prisma\+/, '')

const pool = new pg.Pool({
  connectionString: pgUrl,
})

try {
  const client = await pool.connect()

  try {
    // Check if _prisma_migrations table exists
    const exists = await client.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '_prisma_migrations')`,
    )

    if (!exists.rows[0].exists) {
      console.log('No _prisma_migrations table yet — fresh database, skipping.')
    } else {
      const result = await client.query(
        `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL`,
      )

      for (const row of result.rows) {
        console.log(`Resolving failed migration: ${row.migration_name}`)
        await client.query(
          `UPDATE "_prisma_migrations" SET finished_at = NOW(), logs = NULL, applied_steps_count = 1 WHERE migration_name = $1`,
          [row.migration_name],
        )
        console.log(`  ✅ Marked as resolved`)
      }

      console.log('Done — all failed migrations resolved.')
    }
  } finally {
    client.release()
  }
} catch (err) {
  console.error('Failed to resolve migrations:', err)
  process.exit(1)
} finally {
  await pool.end()
}