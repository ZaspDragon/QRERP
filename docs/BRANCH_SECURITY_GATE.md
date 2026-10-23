# QRERP Branch Security — Production Import Gate

## Scope
Production import reads and writes now require a signed-in lead/admin, plus a matching branch assignment in the trusted Firestore `users/{uid}` profile. A `platformOwner` can access branches across the organization. Client-side filtering alone is **not** the security boundary; Firestore rules enforce the branch. This change is limited to `productionImports` — other QRERP collections still require a separate branch-isolation migration.

## Deployment prerequisites
1. Assign user profile `branch` values (e.g. `OH01`) using a trusted admin process. **Do not let users edit their own branch/role.**
2. Verify that each test supervisor's stored `users/{uid}` role is lead/admin and branch matches exactly.
3. Before deploying rules, test with Firebase Emulator Suite: OH01 supervisor can read/write OH01 imports, cannot read/write PA11; PA11 supervisor cannot query OH01; picker cannot read or publish; platformOwner can view any branch; missing-branch lead is denied.
4. Create necessary composite Firestore index for `productionImports` branch equality + importedAt descending if Firestore requests one.
5. Deploy security rules through the approved Firebase project release process. Never run these against an unconfirmed Firebase project.
6. After publishing, test workday averages and production import persistence across two browsers and different authenticated staff.
7. Note import IDs are computed from content: identical content overwrites timestamps if re-published. This is **not** a complete immutable audit mechanism. Server-controlled issuance + versioned correction records are required before financial-grade use.

## Security caveats
- No general company-wide multi-tenant protection is established until *all* related collections have branch fields and matching rules/queries.
- Existing user accounts without branch assignment will be denied production import access.
- This branch has not deployed the rules; only the tracked `firestore.rules` file changed.
- Only approved administrators should attach a branch to a user; do not expose branch editing directly in client forms.
