/**
 * Fix subscription plan prices on Railway's production database.
 *
 * The production database has wrong plan prices (e.g. 50 instead of 12000
 * for monthly), causing MP to receive transaction_amount: 0.5 (R$0,50)
 * instead of 120 (R$120,00).
 *
 * Usage (on Railway):
 *   npx dotenv -e .env -- npx ts-node scripts/fix-plan-prices.ts
 *
 * Or via Railway shell:
 *   npx ts-node scripts/fix-plan-prices.ts
 *
 * This updates the prices inline so the seed doesn't need to be re-run.
 */

import { config } from 'dotenv'
config()

const MP_API_BASE = 'https://api.mercadopago.com'

interface PlanToFix {
  slug: string
  name: string
  correctPrice: number // in cents
  mpPlanId: string
  envVar: string
}

async function main() {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
  if (!accessToken) {
    console.error('ERROR: MERCADO_PAGO_ACCESS_TOKEN is not set')
    process.exit(1)
  }

  const plans: PlanToFix[] = [
    {
      slug: 'monthly',
      name: 'Plano Mensal',
      correctPrice: 12000, // R$120,00
      mpPlanId: process.env.MERCADO_PAGO_MONTHLY_PLAN_ID ?? 'a0269d359ecf475b916af407edb3501d',
      envVar: 'MERCADO_PAGO_MONTHLY_PLAN_ID',
    },
    {
      slug: 'annual',
      name: 'Plano Anual',
      correctPrice: 120000, // R$1.200,00
      mpPlanId: process.env.MERCADO_PAGO_ANNUAL_PLAN_ID ?? '16c79d6d27194e20a176caa9ec0b9faf',
      envVar: 'MERCADO_PAGO_ANNUAL_PLAN_ID',
    },
  ]

  // We can't import PrismaClient with adapter-pg easily in a standalone script,
  // so we use fetch to the database URL directly via a raw query approach.
  // Instead, let's generate SQL statements that the user can run via Railway CLI.
  console.log('=== Fix Plan Prices — SQL to run on Railway ===')
  console.log()

  for (const plan of plans) {
    console.log(`-- ${plan.name} (${plan.slug})`)
    console.log(`-- Plan price should be ${plan.correctPrice} (R$${(plan.correctPrice / 100).toFixed(2)})`)
    console.log(`UPDATE "SubscriptionPlan" SET "price" = ${plan.correctPrice} WHERE "slug" = '${plan.slug}';`)
    console.log()
  }

  // Also verify the current prices via the MP API
  console.log('=== Verifying plan amounts on Mercado Pago ===')
  console.log()

  for (const plan of plans) {
    console.log(`\n📋 Checking ${plan.name} (${plan.mpPlanId}) on MP...`)
    const res = await fetch(`${MP_API_BASE}/preapproval_plan/${plan.mpPlanId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.ok) {
      const data = await res.json()
      const mpAmount = data.auto_recurring?.transaction_amount
      console.log(`  MP transaction_amount: ${mpAmount}`)
      console.log(`  Expected: ${plan.correctPrice / 100}`)
      if (mpAmount && Math.abs(mpAmount - plan.correctPrice / 100) < 0.01) {
        console.log(`  ✅ MP plan amount matches expected price`)
      } else {
        console.log(`  ⚠️  MP plan amount DOES NOT MATCH expected price`)
        console.log(`  💡 Update MP plan with: PUT /preapproval_plan/${plan.mpPlanId}`)
        console.log(`      body: { "auto_recurring": { "transaction_amount": ${plan.correctPrice / 100} } }`)
      }
    } else {
      console.log(`  ❌ Failed to fetch plan from MP: ${res.status}`)
    }
  }

  console.log('\n=== Instructions ===')
  console.log('1. Run the SQL statements above on your Railway database:')
  console.log('   Railway Dashboard → your-project → Data → SQL query tab')
  console.log('   OR via Railway CLI: railway run "psql \'$DATABASE_URL\' -c \\"UPDATE ...\\""')
  console.log('2. Then also run: npx prisma migrate deploy')
  console.log('   (This applies the nullable-fields migration)')
  console.log()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
