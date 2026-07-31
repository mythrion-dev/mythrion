-- Rename Mercado Pago fields to PagBank fields
-- Rename mpPlanId to pgPlanId on SubscriptionPlan
ALTER TABLE "SubscriptionPlan" RENAME COLUMN "mpPlanId" TO "pgPlanId";

-- Rename mpSubscriptionId to pgSubscriptionId on UserSubscription
ALTER TABLE "UserSubscription" RENAME COLUMN "mpSubscriptionId" TO "pgSubscriptionId";

-- Rename mpInvoiceId to pgInvoiceId on SubscriptionInvoice
ALTER TABLE "SubscriptionInvoice" RENAME COLUMN "mpInvoiceId" TO "pgInvoiceId";

-- Add pgCustomerId for PagBank customer UUID (used in update-payment-method)
ALTER TABLE "UserSubscription" ADD COLUMN IF NOT EXISTS "pgCustomerId" TEXT;

-- Rename unique indexes to match new column names
ALTER INDEX IF EXISTS "SubscriptionPlan_mpPlanId_key" RENAME TO "SubscriptionPlan_pgPlanId_key";
ALTER INDEX IF EXISTS "UserSubscription_mpSubscriptionId_key" RENAME TO "UserSubscription_pgSubscriptionId_key";
ALTER INDEX IF EXISTS "SubscriptionInvoice_mpInvoiceId_key" RENAME TO "SubscriptionInvoice_pgInvoiceId_key";
ALTER INDEX IF EXISTS "SubscriptionInvoice_mpInvoiceId_idx" RENAME TO "SubscriptionInvoice_pgInvoiceId_idx";
