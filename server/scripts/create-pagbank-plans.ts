/**
 * One-time script to create PagBank subscription plans (assinaturas).
 *
 * PagBank requires plans to be created first in their dashboard (or via this API),
 * then referenced by plan ID when creating subscriptions.
 *
 * Usage:
 *   1. Set PAGBANK_TOKEN and PAGBANK_API_URL in your environment.
 *   2. Run: npx ts-node scripts/create-pagbank-plans.ts
 *   3. Copy the output plan IDs into your .env and Railway variables.
 *
 * Requires:
 *   - PAGBANK_TOKEN env var (sandbox or production API token)
 *   - PAGBANK_API_URL env var (e.g. https://sandbox.api.assinaturas.pagseguro.com)
 */

interface PagBankPlanConfig {
  slug: string
  name: string
  description: string
  price: number          // in BRL cents (e.g. 12000 = R$120.00)
  interval: 'MONTHLY' | 'YEARLY'
}

const PLANS: PagBankPlanConfig[] = [
  {
    slug: 'monthly',
    name: 'Mythrion Premium - Mensal',
    description: 'Acesso completo à plataforma Mythrion com renovação mensal.',
    price: 12000,         // R$ 120,00
    interval: 'MONTHLY',
  },
  {
    slug: 'annual',
    name: 'Mythrion Premium - Anual',
    description: 'Acesso completo à plataforma Mythrion com o melhor custo-benefício.',
    price: 120000,        // R$ 1.200,00
    interval: 'YEARLY',
  },
]

const TOKEN = process.env.PAGBANK_TOKEN
const API_URL =
  process.env.PAGBANK_API_URL ?? 'https://sandbox.api.assinaturas.pagseguro.com'

if (!TOKEN) {
  console.error('❌ PAGBANK_TOKEN is not set.')
  console.error('   Set it to your PagBank API token and try again.')
  process.exit(1)
}

async function createPlan(config: PagBankPlanConfig): Promise<string | null> {
  console.log(`\nCreating "${config.name}" (${config.slug})...`)

  const body = {
    name: config.name,
    amount: {
      value: config.price, // PagBank uses cents
      currency: 'BRL',
    },
    interval: config.interval,
  }

  try {
    const response = await fetch(`${API_URL}/plans`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`  ❌ HTTP ${response.status}: ${text}`)
      return null
    }

    const data = await response.json()
    const planId = data.id
    console.log(`  ✅ Created — PagBank Plan ID: ${planId}`)
    return planId
  } catch (err) {
    console.error(`  ❌ Failed to create "${config.slug}":`, err instanceof Error ? err.message : err)
    return null
  }
}

async function main() {
  console.log('=== PagBank Plan Creator ===')
  console.log('This will create subscription plans in your PagBank account.\n')

  const results = await Promise.all(PLANS.map(createPlan))
  const created = results.filter((r): r is string => r !== null)

  console.log('\n=== Results ===')
  if (created.length === 0) {
    console.log('No plans were created. Check the errors above.')
    process.exit(1)
  }

  console.log(`Created ${created.length}/${PLANS.length} plans.\n`)
  console.log('Add these to your .env and Railway environment:')
  console.log('')

  for (let i = 0; i < PLANS.length; i++) {
    const plan = PLANS[i]
    const planId = results[i]
    if (!planId) continue

    switch (plan.slug) {
      case 'monthly':
        console.log(`PAGBANK_MONTHLY_PLAN_ID=${planId}`)
        break
      case 'annual':
        console.log(`PAGBANK_ANNUAL_PLAN_ID=${planId}`)
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
