# Security Specification & Payload TDD (`security_spec.md`)

## 1. Data Invariants
1. **Default-Deny Catch-All**: Root rule `match /{document=**} { allow read, write: if false; }` denies every undeclared path.
2. **Master Gate Relational Sync**: Every write or `get` on `/companies/{companyId}/...` subcollections verifies parent company existence (`companyExists(companyId)` on `get`/`update`/`delete`, `companyAfterExists(companyId)` on batched `create`). Subcollection `list` queries validate `isValidId(companyId)` without incurring per-document `get()` cost.
3. **Immutable Ownership & Audit Fields**: `id`, `companyId`, `ownerUid`, and `createdAt` are immutable across updates. Transactions are strictly immutable (`allow update: if false;`), and transaction `create` enforces atomic `existsAfter(...)` on the referenced `stickerId`.
4. **Strict Schema Keys & Boundary Limits**: Every collection enforces `keys().hasAll(...)`, `keys().hasOnly(...)`, `affectedKeys().hasOnly(...)`, string `.size()` limits, numeric bounds (`bcvRate >= 0.01`, `price >= 0.01`, `balance >= 0`), PIN regex `^[0-9]{4,8}$`, hex color regex, raster image URL/data-URI validation (`https://` or bounded base64 `png/jpeg/jpg/webp` without SVG/script schemes), and `cartSnapshot.size() <= 50`.
5. **Temporal Integrity**: `createdAt` and `updatedAt` MUST equal `request.time` (`serverTimestamp()`).
6. **SuperAdmin Secret Isolation**: `/platform/config` (storing `masterPin`) and `/admins/{uid}` remain strictly restricted to verified bootstrapped admin (`andresomana3@gmail.com` with `email_verified == true`), while `/platform_public/config` locks document ID strictly to `'config'` with `allow list: if false`.

## 2. "Dirty Dozen" Attack Payloads (Must Return PERMISSION_DENIED)
1. **Shadow/Ghost Field Injection**: Create/update `/companies/comp-1` containing extra unknown field `isSuperUser: true` -> rejected by `hasOnly()`.
2. **Unverified Email Spoof**: Write `/platform/config` with `email: "andresomana3@gmail.com"` and `email_verified: false` -> rejected.
3. **ID Poisoning (Oversized Document ID)**: Create `/companies/A...1500chars` -> rejected by `isValidId()`.
4. **Denial-of-Wallet Oversized String**: Create product with `name` of 5,000 characters -> rejected by `.size() <= 120`.
5. **Non-numeric PIN Injection**: Create provider or company with `pin: "abcd"` -> rejected by `isValidPin()`.
6. **Negative Balance / Price Injection**: Update sticker with `balance: -50` or product with `price: 0` -> rejected.
7. **Orphan Subcollection Record**: Create `/companies/non-existent-id/products/p1` -> rejected by `companyAfterExists()` Master Gate.
8. **Transaction Tampering (Update)**: Update any `/companies/{id}/transactions/{txId}` -> rejected by `allow update: if false`.
9. **Immutable Field Tampering**: Update `/companies/comp-1` changing `ownerUid` or `createdAt` -> rejected.
10. **Timestamp Spoofing**: Create/update any entity with client-forged `createdAt` or `updatedAt` not equal to `request.time` -> rejected.
11. **Blocked Sticker Balance Mutation**: Update `balance` on a sticker whose `status == 'blocked'` -> rejected.
12. **Arbitrary `platform_public` Document Injection**: Write `/platform_public/rogueDoc` or `list /platform_public` -> rejected by `configId == 'config'` and `allow list: if false`.
