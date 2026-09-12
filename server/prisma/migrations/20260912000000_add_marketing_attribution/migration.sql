-- Store the original campaign URL for users who create a new account.
CREATE TABLE "MarketingAttribution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingAttribution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingAttribution_userId_idx" ON "MarketingAttribution"("userId");
CREATE INDEX "MarketingAttribution_createdAt_idx" ON "MarketingAttribution"("createdAt");

ALTER TABLE "MarketingAttribution" ADD CONSTRAINT "MarketingAttribution_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
