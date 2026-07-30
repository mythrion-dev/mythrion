-- Create Notebook, NotebookFolder, and NotebookPage models for per-user private campaign notes
CREATE TABLE "Notebook" (
    "id" TEXT NOT NULL,
    "adventureId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notebook_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotebookFolder" (
    "id" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotebookFolder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotebookPage" (
    "id" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "folderId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotebookPage_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "Notebook_adventureId_idx" ON "Notebook"("adventureId");
CREATE INDEX "Notebook_userId_idx" ON "Notebook"("userId");
CREATE UNIQUE INDEX "Notebook_adventureId_userId_key" ON "Notebook"("adventureId", "userId");
CREATE INDEX "NotebookFolder_notebookId_idx" ON "NotebookFolder"("notebookId");
CREATE INDEX "NotebookPage_notebookId_idx" ON "NotebookPage"("notebookId");
CREATE INDEX "NotebookPage_folderId_idx" ON "NotebookPage"("folderId");

-- Add foreign key constraints
ALTER TABLE "Notebook" ADD CONSTRAINT "Notebook_adventureId_fkey" FOREIGN KEY ("adventureId") REFERENCES "Adventure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notebook" ADD CONSTRAINT "Notebook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotebookFolder" ADD CONSTRAINT "NotebookFolder_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotebookPage" ADD CONSTRAINT "NotebookPage_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotebookPage" ADD CONSTRAINT "NotebookPage_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "NotebookFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
