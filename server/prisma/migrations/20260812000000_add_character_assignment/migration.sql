-- Assign a campaign character to a campaign member (a player).
-- A character holds at most one active assignment (single nullable column),
-- so changing the assigned player is a single UPDATE, never an ownership transfer.
-- When the member leaves/is removed, the assignment is cleared (SET NULL) and the
-- character survives; referential integrity is enforced by the FK below.

-- AlterTable
ALTER TABLE "CharacterSheet" ADD COLUMN "assignedMemberId" TEXT;

-- AddForeignKey
ALTER TABLE "CharacterSheet" ADD CONSTRAINT "CharacterSheet_assignedMemberId_fkey" FOREIGN KEY ("assignedMemberId") REFERENCES "CampaignMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddIndex
CREATE INDEX "CharacterSheet_assignedMemberId_idx" ON "CharacterSheet"("assignedMemberId");
