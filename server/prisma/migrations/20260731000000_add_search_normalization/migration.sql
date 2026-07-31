-- Search & filtering: accent-insensitive, case-insensitive text matching.
--
-- Adds the unaccent and pg_trgm extensions plus an IMMUTABLE normalizer
-- function (lowercase + strip accents) that can be used inside index
-- expressions. Trigram GIN indexes over the normalized searchable fields
-- make substring/prefix LIKE lookups fast even with thousands of rows.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- search_norm(text) -> lower(unaccent(text)).
-- The two-argument unaccent with an explicit, schema-qualified dictionary is
-- immutable (unlike the one-argument form, which depends on search_path), so
-- this function is safe to use inside index expressions.
CREATE OR REPLACE FUNCTION search_norm(text) RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $fn$
  SELECT lower(public.unaccent('public.unaccent'::regdictionary, $1))
$fn$;

-- Trigram indexes over normalized searchable fields (GIN, default ops are
-- sufficient for LIKE '%...%' and '...%' patterns).
CREATE INDEX IF NOT EXISTS "idx_adventure_name_norm"
  ON "Adventure" USING gin (search_norm("name") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_adventure_campaign_norm"
  ON "Adventure" USING gin (search_norm("campaign") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_adventure_synopsis_norm"
  ON "Adventure" USING gin (search_norm(COALESCE("synopsis", '')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_template_name_norm"
  ON "Template" USING gin (search_norm("name") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_template_description_norm"
  ON "Template" USING gin (search_norm(COALESCE("description", '')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_user_display_name_norm"
  ON "User" USING gin (search_norm(COALESCE("displayName", '')) gin_trgm_ops);
