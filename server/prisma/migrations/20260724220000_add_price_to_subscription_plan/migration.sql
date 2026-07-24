-- AlterTable: price column was missing from SubscriptionPlan despite being
-- in the create-table migration (likely applied from an older schema revision).
ALTER TABLE "SubscriptionPlan" ADD COLUMN "price" INTEGER NOT NULL DEFAULT 0;
