-- Add session scheduling fields to Adventure model
ALTER TABLE "Adventure" ADD COLUMN "sessionWeekday" TEXT;
ALTER TABLE "Adventure" ADD COLUMN "sessionTime" TEXT;
ALTER TABLE "Adventure" ADD COLUMN "sessionType" TEXT;
