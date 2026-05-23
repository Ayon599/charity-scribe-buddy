
# Super Admin & Invite-Only Admin Accounts

## Goal

Replace the current single-role auth with a two-tier system:
- **Super admin** — the very first user; can invite, approve, reject, deactivate, and promote others.
- **Admin** — created by super admin invitation; must verify email + be approved before logging in.

Public signup is **closed**. Accounts are created by invitation only.

---

## Flows

### 1. First-ever account (bootstrap)
- A one-time public `/signup` page is shown **only when zero users exist**.
- After the first user signs up + verifies email → automatically becomes `super_admin`, approved.
- Once a super_admin exists, `/signup` redirects to `/auth` ("Signup is by invitation only").

### 2. Inviting an admin (super admin only)
- New page `/users` (super admin only) with a "+ Invite admin" button.
- Form: full name + email.
- On submit: creates a pending invitation, sends an **invitation email** to the invitee containing a one-time signup link (`/accept-invite?token=…`).

### 3. Accepting an invite
- Invitee opens link → `/accept-invite` page → sets password.
- Account is created with role `admin`, status `pending_approval`, email auto-confirmed (since invite link proves email ownership).
- Super admin receives an **"admin awaiting approval"** email + sees the new row on `/users`.

### 4. Approval / rejection
- On `/users`, super admin sees pending admins → Approve / Reject (with reason).
- **Approve** → status flips to `approved`; admin receives **"you're approved, you can log in now"** email.
- **Reject** → status flips to `rejected`; admin receives **"rejected"** email with reason; cannot log in. Super admin can re-approve later.

### 5. Login
- Existing `/auth` sign-in. After successful Supabase auth, we check `admin_status`:
  - `approved` → allow.
  - `pending_approval` → sign out + show "Awaiting super admin approval".
  - `rejected` → sign out + show "Access denied".
- `ProtectedRoute` enforces the same check.

### 6. Ongoing super admin powers (on `/users`)
- Deactivate / reactivate any admin (soft block — `is_active=false` → cannot log in).
- Delete an admin (removes their auth user + role rows).
- Promote another approved admin to `super_admin` (with confirmation; multiple super admins allowed).
- View an **audit log** of all admin actions (invite, approve, reject, deactivate, promote, delete) with actor, target, timestamp, reason.

---

## Pages / UI changes

| Route | Change |
|---|---|
| `/signup` | NEW — bootstrap-only, shown when no users exist |
| `/accept-invite` | NEW — set password via invite token |
| `/auth` | Add post-login status check + friendly messages |
| `/users` | NEW — super admin: invite list, pending approvals, all admins, audit log tab |
| Sidebar | Add "Users" link, visible only to super admins |

---

## Technical section

### Database

Extend `app_role` enum: add `super_admin`.

New table `admin_profiles` (or extend logic on `user_roles`):
- `user_id uuid PK references auth.users on delete cascade`
- `status text not null check in ('pending_approval','approved','rejected')`
- `is_active boolean not null default true`
- `approved_by uuid`, `approved_at timestamptz`
- `rejected_reason text`, `rejected_at timestamptz`
- `invited_by uuid`, `invited_at timestamptz`

New table `admin_invitations`:
- `id uuid PK`, `email text`, `full_name text`
- `token text unique` (random, hashed)
- `invited_by uuid`, `created_at`, `expires_at` (e.g. 7 days)
- `accepted_at timestamptz nullable`

New table `admin_audit_log`:
- `id`, `actor_user_id`, `target_user_id`, `action text` (`invite|accept|approve|reject|deactivate|reactivate|promote|delete`), `reason text`, `created_at`.

Updated `handle_new_user()` trigger:
- If `auth.users` count == 1 → insert `(super_admin, approved, active)`.
- Else if the signup is via accept-invite path (detected via metadata `invite_token`) → insert `(admin, pending_approval, active)` and notify super admins.
- Else (no invite, not first) → reject (no row inserted; auth user will be deleted by a cleanup step). Cleanest path: disable public signup at the Supabase auth level once a super admin exists; the bootstrap `/signup` page calls a special edge function that gates on user count.

RLS:
- `admin_profiles`: every authenticated user can read **their own row**; only `super_admin` can update any row.
- `admin_invitations`: only `super_admin` can read/write; `/accept-invite` validates token via a SECURITY DEFINER RPC (no auth required) that returns invitation metadata if valid + unexpired + unaccepted.
- `admin_audit_log`: only `super_admin` can read; writes happen only inside SECURITY DEFINER RPCs (`approve_admin`, `reject_admin`, etc.).
- Add a helper `is_super_admin(uuid)` mirroring `has_role`.

All current "admins manage X" RLS policies stay; they continue to work because `super_admin` will *also* be granted `admin` role on creation (or we update the policies to check `has_role(uid,'admin') OR has_role(uid,'super_admin')`). Cleaner: give super_admins both roles in `user_roles` so all existing policies just work.

### Edge functions

- `create-invitation` (super admin only): validates input, generates token, inserts `admin_invitations`, invokes `send-transactional-email` with template `admin-invitation`.
- `accept-invitation`: token → creates auth user with `email_confirm: true` via service role, inserts pending `admin_profiles` row, notifies super admins (`send-transactional-email` template `super-admin-new-pending`).
- `approve-admin` / `reject-admin` (super admin only): updates status, writes audit log, sends `admin-approved` or `admin-rejected` email.
- `manage-admin` (super admin only): deactivate / reactivate / promote / delete actions, all audit-logged.

### Email templates (Lovable Emails, default sender)

1. `admin-invitation` — "You've been invited. Click to set your password."
2. `super-admin-new-pending` — "A new admin is awaiting your approval."
3. `admin-approved` — "Your account is approved, you can log in now."
4. `admin-rejected` — "Your access request was rejected. Reason: …"

Infrastructure: run email infra setup + scaffold transactional emails, default sender (no custom domain).

### Auth wiring

- `useAuth` hook: also load `admin_profiles` row → expose `status`, `isActive`, `isSuperAdmin`.
- `ProtectedRoute`: require `status === 'approved' && isActive`.
- Add `<SuperAdminRoute>` for `/users`.
- Disable public Supabase signups in dashboard once first super admin exists (or rely on the gated `/signup` page).

---

## Out of scope (call out)

- No magic-link login, no password reset flow (can add later).
- No 2FA.
- No per-admin granular permissions — only `admin` vs `super_admin`.
- No bulk invite / CSV import.

---

## Order of work (once approved)

1. Migration: enum, tables, RLS, trigger, RPCs.
2. Email infra + 4 templates, deploy.
3. Edge functions for invite / accept / approve / reject / manage.
4. Pages: `/signup` (bootstrap), `/accept-invite`, `/users`, updates to `/auth`, `ProtectedRoute`, sidebar.
5. Audit log UI.
6. Manual end-to-end test of every flow.
