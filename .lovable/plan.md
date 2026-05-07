## Goal

Two related changes:
1. Replace the hard-coded **Member Type** enum (`founding / executive / general`) with a manageable list so admins can add/edit types from the UI.
2. Add **per-member fund subscriptions** so each member can be subscribed to one or more funds with an expected monthly amount — enabling member-wise due tracking per fund.

---

## 1. Member Types — manageable list

### Database
New table `member_types`:
- `id uuid pk`
- `name text unique not null` (e.g. "Founding", "Executive", "General", "Honorary"…)
- `description text`
- `is_active boolean default true`
- `sort_order int default 0`
- timestamps + `updated_at` trigger
- RLS: admins manage, authenticated read

Migrate `members.member_type`:
- Add `member_type_id uuid` column referencing `member_types(id)`
- Seed `member_types` with the existing three enum values
- Backfill `member_type_id` from current enum values
- Keep the old enum column for now (drop later) to avoid breaking other pages; new code reads `member_type_id`

### UI
- New page **`/member-types`** (`src/pages/MemberTypes.tsx`): CRUD list (name, description, active toggle, sort order) — same pattern as Funds page
- Add link in `AppLayout` sidebar under Members
- Update **Members page** Add/Edit dialog and filter dropdown to load types from `member_types` table instead of the hard-coded list

---

## 2. Member ↔ Fund subscriptions (member-wise dues)

### Database
New table `member_fund_subscriptions`:
- `id uuid pk`
- `member_id uuid not null` → members.id
- `fund_id uuid not null` → funds.id
- `monthly_amount numeric not null default 0` (expected per-month contribution to this fund)
- `start_date date not null default current_date`
- `end_date date null` (null = ongoing)
- `is_active boolean default true`
- timestamps, `updated_at` trigger
- unique `(member_id, fund_id)` while active
- RLS: admins manage

### UI
- On the Members page, add a **"Funds"** action button per row → opens a dialog listing all active funds with checkboxes + monthly amount input + start date, persisting to `member_fund_subscriptions`
- New page **`/dues`** (`src/pages/Dues.tsx`):
  - Filter by member and/or fund and month range
  - For each (member, fund) subscription:
    - **Expected** = months between `start_date` (or filter start) and selected end month × `monthly_amount`
    - **Paid** = sum of `transactions.amount` where `member_id` and `fund_id` match in that range
    - **Due** = Expected − Paid (highlight if > 0)
  - Totals row per member and grand total
- Sidebar link "Dues"

### Income page tweak (small)
When a member is selected, default the fund dropdown to one of their active subscriptions and pre-fill `amount` with the subscription's `monthly_amount` (falls back to existing `members.monthly_fee` behavior if no subscription).

---

## Files

**Created**
- `supabase/migrations/<ts>_member_types_and_subscriptions.sql`
- `src/pages/MemberTypes.tsx`
- `src/pages/Dues.tsx`
- `src/components/MemberSubscriptionsDialog.tsx`

**Edited**
- `src/pages/Members.tsx` — load types from DB, add "Funds" action button
- `src/pages/Income.tsx` — auto-fill from subscription when available
- `src/components/AppLayout.tsx` — add "Member Types" and "Dues" nav links
- `src/App.tsx` — add `/member-types` and `/dues` routes

---

## Notes / assumptions

- Keeping the existing `member_type` enum column during this change (deprecated, not displayed). A follow-up can drop it once we confirm nothing else reads it.
- `monthly_fee` on `members` becomes informational only; dues are calculated from `member_fund_subscriptions`. We won't remove the column.
- Dues math is simple "months × amount"; partial months count as a full month from `start_date`. Good enough for a foundation; can refine later.