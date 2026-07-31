-- Add missing columns to SubscriptionInvoice that were present in the
-- initial migration (20260724000001) but may not have been applied correctly
-- on some environments (notably Railway production).
--
-- The amount column is required for invoice tracking. Its absence causes
-- Prisma P2022: "column SubscriptionInvoice.amount does not exist".
ALTER TABLE "SubscriptionInvoice" ADD COLUMN IF NOT EXISTS "amount" INTEGER NOT NULL DEFAULT 0;
