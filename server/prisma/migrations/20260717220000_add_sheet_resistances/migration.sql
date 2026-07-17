-- Create SheetResistance table (owned by a single CharacterSheet)
CREATE TABLE "SheetResistance" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calculationType" TEXT NOT NULL DEFAULT 'MANUAL',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SheetResistance_pkey" PRIMARY KEY ("id")
);

-- Create SheetResistanceComponent table
CREATE TABLE "SheetResistanceComponent" (
    "id" TEXT NOT NULL,
    "sheetResistanceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "editableByPlayer" BOOLEAN NOT NULL DEFAULT false,
    "value" TEXT NOT NULL DEFAULT '0',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SheetResistanceComponent_pkey" PRIMARY KEY ("id")
);

-- Create SheetResistanceAttributeModifier table
CREATE TABLE "SheetResistanceAttributeModifier" (
    "id" TEXT NOT NULL,
    "sheetResistanceId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SheetResistanceAttributeModifier_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "SheetResistance_sheetId_idx" ON "SheetResistance"("sheetId");
CREATE INDEX "SheetResistanceComponent_sheetResistanceId_idx" ON "SheetResistanceComponent"("sheetResistanceId");
CREATE INDEX "SheetResistanceAttributeModifier_sheetResistanceId_idx" ON "SheetResistanceAttributeModifier"("sheetResistanceId");
CREATE INDEX "SheetResistanceAttributeModifier_attributeId_idx" ON "SheetResistanceAttributeModifier"("attributeId");

-- Create unique constraint
CREATE UNIQUE INDEX "SheetResistanceAttributeModifier_sheetResistanceId_attributeId_key" ON "SheetResistanceAttributeModifier"("sheetResistanceId", "attributeId");

-- Add foreign key constraints
ALTER TABLE "SheetResistance" ADD CONSTRAINT "SheetResistance_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "CharacterSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SheetResistanceComponent" ADD CONSTRAINT "SheetResistanceComponent_sheetResistanceId_fkey" FOREIGN KEY ("sheetResistanceId") REFERENCES "SheetResistance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SheetResistanceAttributeModifier" ADD CONSTRAINT "SheetResistanceAttributeModifier_sheetResistanceId_fkey" FOREIGN KEY ("sheetResistanceId") REFERENCES "SheetResistance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SheetResistanceAttributeModifier" ADD CONSTRAINT "SheetResistanceAttributeModifier_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "TemplateAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
