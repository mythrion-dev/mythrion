# Privilege Escalation & Authorization Matrix

Security analysis of the Mythrion permission system (backend + frontend).
Assumes a fully hostile client: the attacker can manipulate frontend code, React
state, LocalStorage, cookies, query parameters, campaign/sheet/plan IDs, and any
value the server echoes back. All conclusions verified against the current source.

## Trust model

| Layer | Trusted? | Notes |
| --- | --- | --- |
| JWT signature + `sub` / `email` claims | Yes | Issued server-side; verified by `JwtAuthGuard`. |
| JWT `role` claim | **Never** (server) | Written at token-issue, consumed only by the frontend. All server authz derives identity from `sub`/`email`, then recomputes role via env vars / DB. |
| React state / LocalStorage / cookies | **Never** | UX-only optimistic checks; server re-verifies every request. |
| Query parameters / request body IDs | **Never** | Every `campaignId` / `sheetId` / `templateId` / `userId` is validated against DB ownership or membership. |
| `ADMIN_EMAILS` / `EARLY_ACCESS_EMAILS` env vars | Yes | Server-side only; never serialized to the client. |
| PostgreSQL | Yes (authoritative) | Role/subscription/plan/limits/ownership all live here. |
| Redis | Cache only | Fast path for entitlement reads. Never authoritative. Writes fail-open to DB; reads fail-closed (dates re-evaluated against `now`). |

## Attack vectors

### 1. Role escalation (user → early_access → admin)

| # | Attack | Defending mechanism | Location |
| --- | --- | --- | --- |
| 1.1 | Forge `role: "admin"` in JWT / LocalStorage | Server never reads the JWT `role` claim for authz. `AdminGuard` resolves admin-ness from `ADMIN_EMAILS` env (server-side), not the token. | `auth/admin.guard.ts`, `auth/admin.service.ts` |
| 1.2 | Set `role: "early_access"` client-side | Same principle: Early Access is derived from `EARLY_ACCESS_EMAILS` env via `AdminService.isEarlyAccess`, then surfaced through the server-computed `/auth/me` permission result. | `auth/admin.service.ts`, `auth/permission.service.ts` |
| 1.3 | Replay a stolen admin token | Token remains cryptographically signed; the stolen identity is the only one honored. Revocation/expiry is orthogonal to this matrix. | `auth/jwt-auth.guard.ts` |
| 1.4 | Supply an admin email as `?email=` / in body to get admin rights | Identity never comes from request params; it is the verified JWT `email` claim. | `auth/jwt-auth.guard.ts` |
| 1.5 | Read `ADMIN_EMAILS` from the frontend | Env vars are never exposed; the permission result only ships booleans (`role`, `earlyAccess`), never the raw email list. | `auth/permission.service.ts`, `client/lib/auth-context.tsx` |

### 2. Subscription / entitlement escalation

| # | Attack | Defending mechanism | Location |
| --- | --- | --- | --- |
| 2.1 | Claim an active subscription via LocalStorage / React state | `SubscriptionGuard` and `PermissionService` recompute entitlement from the DB subscription row (status + `currentPeriodEnd`) on every request/read. Client state is never consulted. | `auth/subscription.guard.ts`, `auth/permission.service.ts` |
| 2.2 | Tamper the Redis entitlement cache to fabricate an active sub | Redis is a cache only. `classifyEntitlement` re-evaluates stored dates against `now`; a poisoned cache cannot create a valid status or grant access after `currentPeriodEnd`. | `subscription/subscription.service.ts` (`getEntitlementData`, `classifyEntitlement`) |
| 2.3 | Let Redis stay stale after a subscription expires | The cache READ path rehydrates ISO dates and re-checks them; expired → `subscriptionExpired`. Stale Redis never grants post-expiry write access. | `subscription/subscription.service.ts` |
| 2.4 | Cancel, then keep claiming access forever | Cancel preserves entitlement until `currentPeriodEnd` (cancelled-but-entitled); after that the DB row's period end makes it expired. This is the intended behavior, not a bypass. | `subscription/subscription.service.ts` |
| 2.5 | Use a player's own active sub to override a read-only campaign | Read-only is derived solely from the **GM's** subscription (`hasActiveSubscription(adventure.ownerId)`), and it cascades to every member regardless of their own plan. | `membership/membership.service.ts` (`assertCampaignWritable`, `getUserAdventures`, `getAccessState`) |
| 2.6 | Replay an old `/auth/me` permission response | The client may cache it, but every guarded route re-derives permissions server-side. The response is UX, not an authorization grant. | `auth/permission.service.ts`, `client/lib/auth-context.tsx` |

### 3. Campaign IDOR / role / read-only bypass

| # | Attack | Defending mechanism | Location |
| --- | --- | --- | --- |
| 3.1 | Guess another user's `campaignId` to read/edit | Membership rows are checked (`campaignMember` composite key `adventureId_userId`); non-members get `Forbidden`/`NotFound`. | `membership/membership.service.ts` (`requireRole`, `requireWriteAccess`) |
| 3.2 | Edit a campaign as a non-GM | GM-only routes call `requireWriteRole(id, userId, 'GM')`. | `adventure/adventure.service.ts` (lines ~104, 126, 426, 516, 620, 645) |
| 3.3 | GM-only sub-operations (convert to NPC, NPC sheet edits) | All gated on `requireWriteRole(..., 'GM')` plus NPC-ownership checks. | `adventure/adventure.service.ts` |
| 3.4 | As template owner, edit/delete a template in a read-only campaign | The owner short-circuit is deliberately ordered **after** `assertCampaignWritable`; a lapsed GM cannot edit or delete templates attached to the campaign. | `template/template.service.ts` (lines 641, 1370) |
| 3.5 | Admin-edits-template to bypass read-only | Admins bypass subscription gates by design, but campaign read-only originates in `MembershipService` (not the subscription guard), so the cascade still applies unless the admin is also the GM with an active sub. | `membership/membership.service.ts`, `template/template.service.ts` |

### 4. Character sheet IDOR / book leak

| # | Attack | Defending mechanism | Location |
| --- | --- | --- | --- |
| 4.1 | Read/update/delete another user's sheet by guessing `sheetId` | Owner path requires `sheet.ownerId === userId`; else a membership `requireWriteAccess` on the linked campaign; otherwise `Forbidden`. | `character-sheet/character-sheet.service.ts` (lines 572-588, 731-747, 768-776) |
| 4.2 | Link a sheet to a campaign the user doesn't belong to | Linking requires `sheet.ownerId === userId` **and** `requireWriteAccess(adventureId, userId)`. | `character-sheet/character-sheet.service.ts` (lines 755-756) |
| 4.3 | Leak book content through a sheet endpoint (B5 fix) | Sheet reads/writes are scoped to owner or campaign member; non-members can never reach campaign-linked data. Cache keys are invalidated on ownership/link changes. | `character-sheet/character-sheet.service.ts` |

### 5. Plan limits bypass

| # | Attack | Defending mechanism | Location |
| --- | --- | --- | --- |
| 5.1 | Create a campaign/template past the plan cap | `PlanLimitGuard` reads `limits` **fresh** from the `subscription_plan` row (never cached) and counts owned resources via Prisma `count`. Exceeding → `403 CAMPAIGN_LIMIT_REACHED` / `TEMPLATE_LIMIT_REACHED`. | `auth/plan-limit.guard.ts`, `subscription/plan-limits.ts` |
| 5.2 | Send a crafted `limits` value in an admin request | Admin plan routes are behind `AdminGuard`; `normalizeLimits`/`parsePlanLimits` drop invalid keys leniently. | `admin/admin-plans.controller.ts`, `subscription/plan-limits.ts` |
| 5.3 | Bypass the paywall by editing instead of creating (template) | By approved design: create/clone are paywalled (`SubscriptionGuard`), manage (PATCH/DELETE) is owner-only with no paywall. This is intended, not a hole. | `template/template.controller.ts` (line 27), `standalone-template.controller.ts` (lines 35, 100) |
| 5.4 | Clone a template without a subscription | `POST /templates/:id/clone` runs `SubscriptionGuard` (admin/EA bypass, then access reason). | `standalone-template.controller.ts` (line 100) |

### 6. Admin surface

| # | Attack | Defending mechanism | Location |
| --- | --- | --- | --- |
| 6.1 | Hit an admin route without being on `ADMIN_EMAILS` | `AdminGuard` requires the verified JWT email to match the env list. | `auth/admin.guard.ts` |
| 6.2 | Non-admin mutates plans / prices / limits | All `/admin/subscription-plans` mutations are `AdminGuard`-gated. | `admin/admin-plans.controller.ts` |
| 6.3 | Admin reaches another user's private data via admin routes | Admin bypasses subscription/limits by design; data isolation still holds because admin routes do not expose user content wholesale. | `admin/*` |

## Cache invalidation

Invalidation triggers cover any change to role/subscription/plan/status/
expiration/entitlements/campaign ownership; every write path clears the affected
Redis keys (with `.catch(() => {})` so a Redis outage degrades to DB reads rather
than corrupting the cache). See the cache-invalidation architecture notes.

## Residual notes

- **Token theft** (full JWT compromise) is outside this matrix; it depends on
  signing-secret hygiene, not per-route authz.
- **Rate limiting / abuse** of public community endpoints is a separate concern
  from authorization and is not evaluated here.
- Every failure above is **fail-closed**: missing cache, missing membership,
  missing entitlement, and invalid input all deny rather than grant.
