/**
 * Per-plan usage limits, stored as JSON on SubscriptionPlan.limits.
 *
 * null/undefined (or an empty object) means "unlimited". Each member is an
 * optional non-negative integer cap; a cap of 0 forbids that resource entirely.
 */
export interface PlanLimits {
  maxCampaigns?: number
  maxTemplates?: number
}

/**
 * Normalize a raw limits JSON value into a PlanLimits object, or null when
 * unlimited. Lenient by design: invalid/unknown members are dropped rather
 * than throwing, so the entitlement/enforcement path never crashes on a
 * malformed stored value — it simply treats the affected resource as
 * unlimited. The admin CRUD path validates strictly before writing.
 */
export function parsePlanLimits(raw: unknown): PlanLimits | null {
  if (raw == null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  const source = raw as Record<string, unknown>
  const out: PlanLimits = {}
  for (const key of ['maxCampaigns', 'maxTemplates'] as const) {
    const value = source[key]
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
      out[key] = value
    }
  }
  return Object.keys(out).length > 0 ? out : null
}
