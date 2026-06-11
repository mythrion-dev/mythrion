-- Drop old Campaign table
DROP TABLE IF EXISTS "Campaign" CASCADE;

-- CreateTable Adventure
CREATE TABLE "Adventure" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "campaign" TEXT NOT NULL,
    "synopsis" TEXT,
    "maxPlayers" INTEGER NOT NULL DEFAULT 5,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Adventure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Adventure_ownerId_idx" ON "Adventure"("ownerId");

-- AddForeignKey
ALTER TABLE "Adventure" ADD CONSTRAINT "Adventure_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;