-- Create BookVisibility enum and Book model for campaign PDF library
CREATE TYPE "BookVisibility" AS ENUM ('GM_BOOK', 'PLAYER_BOOK');

CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "adventureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visibility" "BookVisibility" NOT NULL DEFAULT 'GM_BOOK',
    "fileLength" INTEGER NOT NULL DEFAULT 0,
    "gridfsFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "Book_adventureId_idx" ON "Book"("adventureId");

-- Add foreign key constraints
ALTER TABLE "Book" ADD CONSTRAINT "Book_adventureId_fkey" FOREIGN KEY ("adventureId") REFERENCES "Adventure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
