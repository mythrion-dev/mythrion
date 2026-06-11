-- CreateTable
CREATE TABLE "GoogleAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "locale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleAccount_userId_key" ON "GoogleAccount"("userId");
CREATE UNIQUE INDEX "GoogleAccount_googleId_key" ON "GoogleAccount"("googleId");

-- AddForeignKey
ALTER TABLE "GoogleAccount" ADD CONSTRAINT "GoogleAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;