import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding subscription plans...')

  // Monthly plan — R$120,00
  const monthlyId = process.env.MERCADO_PAGO_MONTHLY_PLAN_ID
  if (!monthlyId) {
    console.warn('MERCADO_PAGO_MONTHLY_PLAN_ID is not set — skipping monthly plan')
  } else {
    await prisma.subscriptionPlan.upsert({
      where: { slug: 'monthly' },
      update: {
        mpPlanId: monthlyId,
        name: 'Plano Mensal',
        price: 12000,
        description: 'Acesso completo à plataforma Mythrion com renovação mensal.',
      },
      create: {
        id: 'monthly',
        slug: 'monthly',
        name: 'Plano Mensal',
        description: 'Acesso completo à plataforma Mythrion com renovação mensal.',
        price: 12000,
        mpPlanId: monthlyId,
      },
    })
    console.log(`  ✓ Monthly plan (R$120,00) — MP ID: ${monthlyId}`)
  }

  // Annual plan — R$1.200,00
  const annualId = process.env.MERCADO_PAGO_ANNUAL_PLAN_ID
  if (!annualId) {
    console.warn('MERCADO_PAGO_ANNUAL_PLAN_ID is not set — skipping annual plan')
  } else {
    await prisma.subscriptionPlan.upsert({
      where: { slug: 'annual' },
      update: {
        mpPlanId: annualId,
        name: 'Plano Anual',
        price: 120000,
        description: 'Acesso completo à plataforma Mythrion com o melhor custo-benefício (equivalente a R$100/mês).',
      },
      create: {
        id: 'annual',
        slug: 'annual',
        name: 'Plano Anual',
        description: 'Acesso completo à plataforma Mythrion com o melhor custo-benefício (equivalente a R$100/mês).',
        price: 120000,
        mpPlanId: annualId,
      },
    })
    console.log(`  ✓ Annual plan (R$1.200,00) — MP ID: ${annualId}`)
  }

  console.log('Seed complete!')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
