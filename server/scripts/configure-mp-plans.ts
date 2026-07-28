/**
 * Configure Mercado Pago preapproval plans with correct payment methods.
 *
 * Usage:
 *   1. Set MERCADO_PAGO_ACCESS_TOKEN in .env (or Railway env vars)
 *   2. Run: npx dotenv -e .env -- npx ts-node scripts/configure-mp-plans.ts
 *
 * This updates both monthly and annual plans to enable credit card
 * payment methods, which is required for card_token_id to work with
 * the /preapproval API.
 *
 * Plan IDs (from MP dashboard):
 *   Monthly: a0269d359ecf475b916af407edb3501d
 *   Annual:  16c79d6d27194e20a176caa9ec0b9faf
 */

// Load .env manually so the script works with or without dotenv preload
import { config } from 'dotenv'
config()

const MP_API_BASE = 'https://api.mercadopago.com'

async function main() {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
  if (!accessToken) {
    console.error('ERROR: MERCADO_PAGO_ACCESS_TOKEN is not set')
    process.exit(1)
  }

  const plans = [
    {
      id: process.env.MERCADO_PAGO_MONTHLY_PLAN_ID ?? 'a0269d359ecf475b916af407edb3501d',
      name: 'Monthly',
    },
    {
      id: process.env.MERCADO_PAGO_ANNUAL_PLAN_ID ?? '16c79d6d27194e20a176caa9ec0b9faf',
      name: 'Annual',
    },
  ]

  for (const plan of plans) {
    console.log(`\n📋 Fetching plan "${plan.name}" (${plan.id})...`)

    // 1. GET current plan config
    const getRes = await fetch(`${MP_API_BASE}/preapproval_plan/${plan.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!getRes.ok) {
      console.error(`  ❌ Failed to fetch plan: ${getRes.status} ${await getRes.text()}`)
      continue
    }
    const current = await getRes.json()
    console.log(`  ✅ Current status: ${current.status}`)
    console.log(`  Current payment_methods_allowed:`, JSON.stringify(current.payment_methods_allowed, null, 2))

    // 2. UPDATE plan with correct payment methods
    console.log(`  📝 Updating plan with credit card payment method...`)

    const updateBody: Record<string, any> = {
      payment_methods_allowed: {
        payment_types: [{ id: 'credit_card' }],
      },
    }

    // Also include the auto_recurring and reason if missing, to ensure consistency
    if (current.auto_recurring) {
      updateBody.auto_recurring = {
        frequency: current.auto_recurring.frequency,
        frequency_type: current.auto_recurring.frequency_type,
        transaction_amount: current.auto_recurring.transaction_amount,
        currency_id: current.auto_recurring.currency_id,
        billing_day: current.auto_recurring.billing_day,
        billing_day_proportional: current.auto_recurring.billing_day_proportional,
        repetitions: current.auto_recurring.repetitions,
      }
    }
    if (current.reason) {
      updateBody.reason = current.reason
    }

    const putRes = await fetch(`${MP_API_BASE}/preapproval_plan/${plan.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateBody),
    })

    if (!putRes.ok) {
      const errText = await putRes.text()
      console.error(`  ❌ Failed to update plan: ${putRes.status} ${errText}`)
    } else {
      const updated = await putRes.json()
      console.log(`  ✅ Plan updated successfully!`)
      console.log(`  Updated payment_methods_allowed:`, JSON.stringify(updated.payment_methods_allowed, null, 2))
    }

    // 3. Verify the update
    const verifyRes = await fetch(`${MP_API_BASE}/preapproval_plan/${plan.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (verifyRes.ok) {
      const verified = await verifyRes.json()
      const types = verified.payment_methods_allowed?.payment_types || []
      console.log(`  ✅ Verification - payment_types:`, JSON.stringify(types, null, 2))
    }
  }

  console.log('\n🎉 Done!')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
