import { SetMetadata } from '@nestjs/common'

export const PLAN_LIMIT_RESOURCE_KEY = 'planLimitResource'

export type PlanLimitResource = 'campaign' | 'template'

/**
 * Marks a create/clone route with the resource whose plan-based cap it must
 * enforce. Consumed by PlanLimitGuard; ignored when the plan has no cap.
 */
export const PlanLimit = (resource: PlanLimitResource) =>
  SetMetadata(PLAN_LIMIT_RESOURCE_KEY, resource)
