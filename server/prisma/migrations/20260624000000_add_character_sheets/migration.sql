-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "adventureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateAttribute" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modifier" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterSheet" (
    "id" TEXT NOT NULL,
    "characterName" TEXT NOT NULL,
    "adventureId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterSheetValue" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterSheetValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Template_adventureId_idx" ON "Template"("adventureId");

-- CreateIndex
CREATE INDEX "TemplateAttribute_templateId_idx" ON "TemplateAttribute"("templateId");

-- CreateIndex
CREATE INDEX "CharacterSheet_adventureId_idx" ON "CharacterSheet"("adventureId");

-- CreateIndex
CREATE INDEX "CharacterSheet_ownerId_idx" ON "CharacterSheet"("ownerId");

-- CreateIndex
CREATE INDEX "CharacterSheet_templateId_idx" ON "CharacterSheet"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterSheetValue_sheetId_attributeId_key" ON "CharacterSheetValue"("sheetId", "attributeId");

-- CreateIndex
CREATE INDEX "CharacterSheetValue_sheetId_idx" ON "CharacterSheetValue"("sheetId");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_adventureId_fkey" FOREIGN KEY ("adventureId") REFERENCES "Adventure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateAttribute" ADD CONSTRAINT "TemplateAttribute_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterSheet" ADD CONSTRAINT "CharacterSheet_adventureId_fkey" FOREIGN KEY ("adventureId") REFERENCES "Adventure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterSheet" ADD CONSTRAINT "CharacterSheet_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterSheet" ADD CONSTRAINT "CharacterSheet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterSheetValue" ADD CONSTRAINT "CharacterSheetValue_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "CharacterSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterSheetValue" ADD CONSTRAINT "CharacterSheetValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "TemplateAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;