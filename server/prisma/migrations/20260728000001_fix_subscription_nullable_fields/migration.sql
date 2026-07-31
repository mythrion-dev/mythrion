-- Safety net: ensure subscription period fields are nullable
-- In the initial migration (20260724000001) these columns were created without
-- NOT NULL. Some environments (notably Railway production) may have had the
-- table created via prisma db push with NOT NULL instead. Running this
-- migration guarantees they are nullable regardless of how the table was created.
ALTER TABLE "UserSubscription" ALTER COLUMN "currentPeriodStart" DROP NOT NULL;
ALTER TABLE "UserSubscription" ALTER COLUMN "currentPeriodEnd" DROP NOT NULL;
ALTER TABLE "UserSubscription" ALTER COLUMN "graceEndsAt" DROP NOT NULL;
