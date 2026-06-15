-- Add unique index for DiscordAccount.email (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'DiscordAccount_email_key'
  ) THEN
    CREATE UNIQUE INDEX "DiscordAccount_email_key" ON "DiscordAccount"("email");
  END IF;
END $$;
