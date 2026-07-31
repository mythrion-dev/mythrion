-- Add missing currency column to SubscriptionInvoice that was present in the
-- initial migration (20260724000001) but may not have been applied correctly
-- on some environments (notably Railway production).
--
-- The currency column is required for invoice tracking. Its absence causes
-- Prisma P2022: "column SubscriptionInvoice.currency does not exist".
ALTER TABLE "SubscriptionInvoice" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'BRL';
