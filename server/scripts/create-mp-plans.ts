/**
 * One-time script to create Mercado Pago subscription plans.
 *
 * Run this only if you need to recreate the plans in a new MP account
 * or after the existing plans were deleted. The current plan IDs are
 * already hardcoded in the .env — this script generates NEW IDs.
 *
 * Usage:
 *   1. Set MERCADO_PAGO_ACCESS_TOKEN in your environment (production or test).
 *   2. Run: npx ts-node scripts/create-mp-plans.ts
 *   3. Copy the output plan IDs into your .env and Railway variables.
 *
 * Requires:
 *   - MERCADO_PAGO_ACCESS_TOKEN env var
 *   - npm package "mercadopago" (already installed)
 */

import { MercadoPagoConfig, PreApprovalPlan } from 'mercadopago'

const ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN
if (!ACCESS_TOKEN) {
  console.error('❌ MERCADO_PAGO_ACCESS_TOKEN is not set.')
  console.error('   Set it to your Mercado Pago access token and try again.')
  process.exit(1)
}

const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN })
const planApi = new PreApprovalPlan(client)

interface PlanConfig {
  slug: string
  name: string
  description: string
  price: number          // in BRL cents
  frequency: number      // days per cycle
  frequencyType: 'days'  // Mercado Pago uses 'days' for subscriptions
  currencyId: 'BRL'
}

const PLANS: PlanConfig[] = [
  {
    slug: 'monthly',
    name: 'Plano Mensal',
    description: 'Acesso completo à plataforma Mythrion com renovação mensal.',
    price: 12000,         // R$ 120,00
    frequency: 30,
    frequencyType: 'days',
    currencyId: 'BRL',
  },
  {
    slug: 'annual',
    name: 'Plano Anual',
    description: 'Acesso completo à plataforma Mythrion com o melhor custo-benefício (equivalente a R$100/mês).',
    price: 120000,        // R$ 1.200,00
    frequency: 365,
    frequencyType: 'days',
    currencyId: 'BRL',
  },
]

async function createPlan(config: PlanConfig) {
  console.log(`\nCreating "${config.name}" (${config.slug})...`)

  // Mercado Pago PreApprovalPlan.create expects a body with:
  //   reason, auto_recurring, back_url, status
  // See: https://www.mercadopago.com.br/developers/en/reference/subscriptions/_preapproval_plan/post
  try {
    const response = await planApi.create({
      body: {
        reason: config.name,
        auto_recurring: {
          frequency: config.frequency,
          frequency_type: config.frequencyType,
          transaction_amount: config.price / 100,  // MP expects reais, not cents
          currency_id: config.currencyId,
        },
        status: 'active',
      },
    })

    const planId = response.id
    console.log(`  ✅ Created — MP Plan ID: ${planId}`)
    return { slug: config.slug, planId }
  } catch (err) {
    console.error(`  ❌ Failed to create "${config.slug}":`, err instanceof Error ? err.message : err)
    return null
  }
}

async function main() {
  console.log('=== Mercado Pago Plan Creator ===')
  console.log('This will create subscription plans in your MP account.\n')

  const results = await Promise.all(PLANS.map(createPlan))
  const created = results.filter((r): r is NonNullable<typeof r> => r !== null)

  console.log('\n=== Results ===')
  if (created.length === 0) {
    console.log('No plans were created. Check the errors above.')
    process.exit(1)
  }

  console.log(`Created ${created.length}/${PLANS.length} plans.\n`)
  console.log('Add these to your .env and Railway environment:')
  console.log('')

  for (const plan of created) {
    switch (plan.slug) {
      case 'monthly':
        console.log(`MERCADO_PAGO_MONTHLY_PLAN_ID=${plan.planId}`)
        break
      case 'annual':
        console.log(`MERCADO_PAGO_ANNUAL_PLAN_ID=${plan.planId}`)
        break
    }
  }

  console.log('')
  console.log('Then run the Prisma seed to update the local database:')
  console.log('  npx prisma db seed')
  console.log('')
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
