-- Create JoinRequestStatus enum for tracking adventure join requests
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- Add isPublic column to Adventure (default false for existing adventures)
ALTER TABLE "Adventure" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- Add ownerId column to Template (nullable, FK to User, SetNull on delete)
ALTER TABLE "Template" ADD COLUMN "ownerId" TEXT;

-- Backfill ownerId for existing templates: set to the adventure's owner
UPDATE "Template" SET "ownerId" = (SELECT "ownerId" FROM "Adventure" WHERE "Adventure"."id" = "Template"."adventureId");

-- Create indexes for JoinRequest and Template.ownerId
CREATE INDEX "Template_ownerId_idx" ON "Template"("ownerId");

-- Create JoinRequest table
CREATE TABLE "JoinRequest" (
    "id" TEXT NOT NULL,
    "adventureId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JoinRequest_pkey" PRIMARY KEY ("id")
);

-- Create indexes for JoinRequest
CREATE INDEX "JoinRequest_adventureId_idx" ON "JoinRequest"("adventureId");
CREATE INDEX "JoinRequest_userId_idx" ON "JoinRequest"("userId");
CREATE INDEX "JoinRequest_status_idx" ON "JoinRequest"("status");

-- Add unique constraint on (adventureId, userId) for JoinRequest
CREATE UNIQUE INDEX "JoinRequest_adventureId_userId_key" ON "JoinRequest"("adventureId", "userId");

-- Add foreign key constraints
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_adventureId_fkey" FOREIGN KEY ("adventureId") REFERENCES "Adventure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Template" ADD CONSTRAINT "Template_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
