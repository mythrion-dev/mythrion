-- Add per-plan usage limits (null = unlimited).
-- Shape: { "maxCampaigns": int, "maxTemplates": int }
ALTER TABLE "SubscriptionPlan" ADD COLUMN IF NOT EXISTS "limits" JSONB;
