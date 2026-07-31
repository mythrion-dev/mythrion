-- Add createdFromTemplateId to Template model
--
-- This field tracks which public template (if any) was the source when a user
-- cloned/saved a template to their library. It is for analytics only — cloned
-- templates are fully independent copies with no sync relationship to the original.
--
-- See: template.service.ts clone() method

ALTER TABLE "Template" ADD COLUMN "created_from_template_id" TEXT;

-- Create index for analytics queries (count clones per original template)
CREATE INDEX "Template_createdFromTemplateId_idx" ON "Template"("created_from_template_id");
