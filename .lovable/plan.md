
# Reset & Simplify Auth Flow

## Goal

Replace the invitation + approval system with a much simpler model:

1. **Wipe all existing data** (auth users + all app tables).
2. **Public `/signup`** — open only until the first super admin exists, then closes.
3. **First signup → super admin**, auto-approved, can log in immediately.
4. **Super admin creates other admins directly** from `/users` dashboard by entering email + full name + password. No invitation email, no approval, no pending state.
5. **Created admins log in directly** with the credentials super admin gave them.

---

## What gets removed

- Invitation flow (`/accept-invite` page, `admin-invite` + `accept-invitation` edge functions, `admin_invitations` table).
- Approval flow (pending / approved / rejected statuses, approve/reject UI, rejection emails).
- Audit log table & UI (out of scope for this simpler model — can re-add later if needed).
- All status-blocking UI in `/auth` (no "awaiting approval" messages).

## What stays / changes

- `user_roles` table — keeps `admin` and `super_admin` roles.
- `admin_profiles` — simplified to just `is_active` (no status field). Used to deactivate admins without deleting them.
- `is_super_admin()` and `has_role()` helpers — unchanged.
- `handle_new_user()` trigger — first user becomes super_admin + admin; subsequent users (created by super admin) become admin.
- `bootstrap_needed()` — still gates `/signup`.

---

## Flows

### 1. Bootstrap super admin
- Open `/signup` → email + full name + password.
- Trigger detects first user → assigns `super_admin` + `admin` roles, `admin_profiles.is_active = true`.
- Email auto-confirmed (no verification step — user asked for direct login).
- Redirect to `/auth` or straight into app.

### 2. Super admin creates admin
- On `/users`, "Create admin" button → modal with email + full name + password.
- Calls an edge function `create-admin` (service role): creates auth user with `email_confirm: true` and the given password, trigger inserts admin role + active profile.
- Super admin shares the credentials manually with the new admin.

### 3. Admin logs in
- Goes to `/auth` → enters email + password → straight into app. No status check beyond `is_active`.

### 4. Super admin manages admins
- On `/users`: list of admins with actions: deactivate / reactivate, reset password (sets a new one super admin provides), delete, promote to super admin.

---

## Technical section

### Database migration

```sql
-- 1. Wipe app data
TRUNCATE TABLE
  public.receipts,
  public.transactions,
  public.expenses,
  public.member_fund_subscriptions,
  public.member_member_types,
  public.members,
  public.member_types,
  public.funds,
  public.admin_audit_log,
  public.admin_invitations,
  public.admin_profiles,
  public.user_roles,
  public.profiles
RESTART IDENTITY CASCADE;

-- 2. Wipe auth users (cascades through FKs above)
DELETE FROM auth.users;

-- 3. Drop invitation + audit tables
DROP TABLE public.admin_invitations;
DROP TABLE public.admin_audit_log;

-- 4. Simplify admin_profiles: drop status + rejection + invitation columns
ALTER TABLE public.admin_profiles
  DROP COLUMN status,
  DROP COLUMN approved_by, DROP COLUMN approved_at,
  DROP COLUMN rejected_by, DROP COLUMN rejected_at, DROP COLUMN rejected_reason,
  DROP COLUMN invited_by, DROP COLUMN invited_at;

-- 5. Drop validate_invitation_token() RPC

-- 6. Rewrite handle_new_user(): first user -> super_admin+admin+active;
--    subsequent users -> admin + active (no pending state).
```

### Edge functions

- **Delete:** `admin-invite`, `accept-invitation`.
- **Add:** `create-admin` (super admin only; service role; creates auth user with `email_confirm: true`).
- **Keep / adjust:** `admin-action` — keep deactivate/reactivate/delete/promote; remove approve/reject branches.

### Frontend changes

| File | Change |
|---|---|
| `src/hooks/useAuth.tsx` | Drop `status`; `canAccessApp = isAdmin && is_active`. |
| `src/components/ProtectedRoute.tsx` | Simplify check (no status). |
| `src/pages/Auth.tsx` | Remove pending/rejected messages; just check `is_active`. |
| `src/pages/Signup.tsx` | Stays, but unconditional auto-confirm via Supabase auth settings. |
| `src/pages/AcceptInvite.tsx` | **Delete.** |
| `src/pages/Users.tsx` | Rewrite: "Create admin" modal + list with deactivate/promote/delete actions. |
| `src/App.tsx` | Remove `/accept-invite` route. |
| `src/components/AppLayout.tsx` | Remove pending-approval badge. |

### Supabase auth settings

- Enable `auto_confirm_email` so both the bootstrap super admin and super-admin-created admins can log in immediately without verifying email (matches "direct log in no sign up" requirement).
- Public signup stays enabled (gated client-side by `bootstrap_needed`).

---

## Out of scope

- Email notifications (not needed in this flow).
- Password reset flow (super admin can re-set passwords via dashboard for now).
- Audit logging (removed; can re-add later).

---

## Order of work (once approved)

1. Migration: truncate data, drop tables/columns, rewrite trigger.
2. Enable auto-confirm in Supabase auth settings.
3. Delete `admin-invite`, `accept-invitation` edge functions; create `create-admin`; trim `admin-action`.
4. Update frontend: `useAuth`, `ProtectedRoute`, `Auth`, `Users`, `AppLayout`, `App.tsx`; delete `AcceptInvite.tsx`.
5. Manual test: signup first super admin → create an admin → log in as that admin → deactivate → log in blocked.

---

**⚠️ Confirm before I run this:** the migration will permanently delete every user, member, transaction, fund, expense, and receipt currently in the database. There is no undo.
