-- Add cancelAtPeriodEnd field to UserSubscription
-- Allows a user to cancel at period end without immediately losing access
ALTER TABLE "UserSubscription" ADD COLUMN IF NOT EXISTS "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false;
