-- Create RuntimeModifierType enum
CREATE TYPE "RuntimeModifierType" AS ENUM ('NUMBER', 'BOOLEAN', 'SELECT');

-- Create TemplateRuntimeModifier table
CREATE TABLE "TemplateRuntimeModifier" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RuntimeModifierType" NOT NULL,
    "defaultValue" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateRuntimeModifier_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TemplateRuntimeModifier_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "TemplateRuntimeModifier_templateId_idx" ON "TemplateRuntimeModifier"("templateId");

-- Create RuntimeModifierOption table
CREATE TABLE "RuntimeModifierOption" (
    "id" TEXT NOT NULL,
    "modifierId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuntimeModifierOption_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RuntimeModifierOption_modifierId_fkey" FOREIGN KEY ("modifierId") REFERENCES "TemplateRuntimeModifier"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "RuntimeModifierOption_modifierId_idx" ON "RuntimeModifierOption"("modifierId");