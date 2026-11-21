# Vanguard Trade & Vault — Security Specification (Phase 0)

## 1. Data Invariants
1. **Master Admin Isolation**: Only verified Super Admins (`request.auth.token.email == 'shakiljr323@gmail.com' && request.auth.token.email_verified == true` or existence of `/admins/{uid}`) may mutate `/config/{docId}`, approve KYC submissions, approve/reject crypto deposits, approve/reject manual capital withdrawals, or gift Mentor Accounts.
2. **Self-Role Escalation Prevention**: Normal users creating `/users/{userId}` MUST set `role == 'user'`, `usdBalance == 0`, `profitBalance == 0`, `totalInvested == 0`, `totalWithdrawn == 0`, `isMentor == false`, `mentorGiftedCapital == 0`, `mentorRequiredVolume == 0`, `mentorBroughtVolume == 0`, and `kycStatus` in `['unsubmitted', 'pending']`.
3. **PII Isolation**: User emails, ID numbers, and KYC photos in `/users/{userId}` are readable ONLY by the document owner or Super Admin. P2P transfer lookups use `/handles/{handle}` (public handle/displayName only) and `/emailHashes/{emailHash}` (SHA-256 hash get-only, no list).
4. **Secure List Queries**: Every `allow list` rule evaluates `resource.data` against `request.auth.uid` or `isAdmin()`—never blanket `isSignedIn()`.
5. **Immutable Ownership & Timestamps**: `uid` / `senderUid` / `fromUid` and `createdAt` are immutable after creation; `createdAt` and `updatedAt` are validated against `request.time`.
6. **Path ID Hardening**: Single-document operations validate `isValidId()` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).

## 2. The "Dirty Dozen" Payloads (All Must Return PERMISSION_DENIED)
1. **Admin Privilege Escalation on Signup**: `POST /users/attacker` with `{ role: "admin", usdBalance: 999999 }`.
2. **KYC Self-Approval**: `PATCH /users/attacker` with `{ kycStatus: "approved" }`.
3. **Mentor Account Self-Gifting**: `PATCH /users/attacker` with `{ isMentor: true, mentorGiftedCapital: 5000 }`.
4. **Ghost Field Injection (Shadow Update)**: `PATCH /users/attacker` with `{ fullName: "Bob", isVerifiedVip: true }`.
5. **Spoofed Admin Email (Unverified Token)**: Request with `token.email = "shakiljr323@gmail.com"`, `token.email_verified = false` trying to write `/config/platform`.
6. **Cross-User PII Scraping (List)**: `LIST /users` by non-admin authenticated user.
7. **Cross-User PII Read (Get)**: `GET /users/victimUid` by non-admin authenticated user.
8. **Fake Deposit Self-Approval**: `POST /cryptoDeposits/dep1` with `{ uid: "attacker", status: "approved" }`.
9. **Deposit Status Tampering**: `PATCH /cryptoDeposits/dep1` by owner changing `status: "pending"` to `"approved"`.
10. **P2P Negative Drain Attack**: `PATCH /users/victimUid` by attacker trying to decrease `usdBalance`.
11. **ID Poisoning**: `GET /investments/` with oversized or invalid characters in ID (`150+ chars` or `../`).
12. **Client Timestamp Forgery**: `POST /investments/inv1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `serverTimestamp()`.
