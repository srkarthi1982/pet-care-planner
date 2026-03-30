# App Spec: pet-care-planner

## 1) App Overview
- **App Name:** Pet Care Planner
- **Category:** Lifestyle / Care Tracking
- **Version:** V1
- **App Type:** DB-backed
- **Purpose:** Help an authenticated user manage pets, care routines, logs, and related pet-care records in one workspace.
- **Primary User:** A signed-in user managing care records for their own pets.

## 2) User Stories
- As a user, I want to create pet records with profile details, so that I can keep pet information organized.
- As a user, I want to manage care routines and logs for a pet, so that I can track regular care activity.
- As a user, I want to archive and restore pets, so that I can preserve history without deleting records.

## 3) Core Workflow
1. User signs in and opens `/app`.
2. User creates a pet from the workspace modal.
3. App stores the pet in the user-scoped database and lists it under active pets.
4. User opens the pet detail route to manage additional care records such as routines or logs.
5. User archives or restores pets from the workspace as needed.

## 4) Functional Behavior
- Pets are stored per user with profile fields such as type, breed, birthday, age label, notes, and status.
- The schema also supports routines, care logs, and vet visits tied back to the same user-owned pet records.
- `/app` and pet detail routes are protected and scoped to the authenticated user.
- Current implementation centers on private care tracking and does not expose public sharing or reminders outside the app.

## 5) Data & Storage
- **Storage type:** Astro DB on the app’s isolated Turso database
- **Main entities:** Pets, PetCareRoutines, PetCareLogs, VetVisits
- **Persistence expectations:** Pet records and related care data persist across refresh and future sessions for the authenticated owner.
- **User model:** Multi-user shared infrastructure with per-user isolation

## 6) Special Logic (Optional)
- Dashboard summary logic highlights active pets, routines, recent logs, and the most recently touched pet.
- Routines, logs, and vet visits are modeled as separate records rather than embedded inside the pet object.

## 7) Edge Cases & Error Handling
- Invalid IDs/routes: Missing or invalid pet routes should fail safely without exposing another user’s records.
- Empty input: Pet creation requires a name.
- Unauthorized access: Protected routes redirect to the parent login flow.
- Missing records: Non-owned pets and related child records are blocked by ownership checks.
- Invalid payload/state: Malformed dates or payloads should be rejected safely rather than corrupting records.

## 8) Tester Verification Guide
### Core flow tests
- [ ] Create a pet from the workspace, confirm it appears in Active pets, then open the detail route.
- [ ] Add or update a care-related record on the pet detail route, then confirm the data persists after refresh.

### Safety tests
- [ ] Archive a pet, confirm it moves to Archived, then restore it.
- [ ] Open an invalid or non-owned pet route and confirm the app fails safely.
- [ ] Attempt to save a pet without a name and confirm the request is rejected.

### Negative tests
- [ ] Confirm there is no hard-delete flow in V1.
- [ ] Confirm there is no public sharing or cross-user access to pet records.

## 9) Out of Scope (V1)
- Public pet profiles or caregiver sharing
- Automated reminder scheduling outside the app
- Permanent delete and recovery workflows

## 10) Freeze Notes
- V1 release freeze: this document reflects the current repo implementation before final browser verification.
- This spec was populated conservatively from current tables, workspace routes, and task-log context; detail-route behavior should be finalized during freeze verification.
- During freeze, only verification fixes and cleanup are allowed; no undocumented feature expansion.
