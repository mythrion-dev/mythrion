-- Add templateSource field to Adventure model
--
-- This field tracks the origin of the active sheet template for an adventure:
--   - NULL   → no template attached
--   - 'attached' → template linked from My Templates (snapshot present)
--   - 'campaign' → campaign-owned template created directly inside the adventure
--
-- The backend enforces that only one source is active at a time.
-- See template.service.ts for enforcement logic (ConflictException).

ALTER TABLE "Adventure" ADD COLUMN "template_source" TEXT;

-- Create index for efficient lookups
CREATE INDEX "Adventure_templateSource_idx" ON "Adventure"(COALESCE("template_source", ''));
