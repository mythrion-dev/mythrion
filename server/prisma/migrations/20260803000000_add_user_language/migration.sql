-- Add per-user language preference for i18n.
--
-- Column stores the BCP-47 tag of the user's UI language ('en' or 'pt-BR').
-- Existing users default to 'en' (English is the app's default language).

ALTER TABLE "User" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
