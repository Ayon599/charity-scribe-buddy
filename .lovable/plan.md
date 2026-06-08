## Goal

Support funds that are a **one-time payment** (e.g. "Registration Fee") so they don't accrue monthly dues after the member has paid once.

## Changes

### 1. Database (migration)
- Add `is_one_time boolean NOT NULL DEFAULT false` to `public.funds`.
- Mark the existing "Registration Fee" fund as `is_one_time = true` (via a data update after the column is added, in the same migration).

### 2. Funds page (`src/pages/Funds.tsx`)
- Add a "One-time payment" checkbox/switch in the create/edit fund form.
- Show a badge ("One-time") next to such funds in the list.

### 3. Subscriptions dialog (`src/components/MemberSubscriptionsDialog.tsx`)
- For one-time funds, relabel "Monthly (৳)" → "Amount (৳)" and hide/ignore the start-date semantics (still store start_date = subscription date).
- No behavioral change to save logic.

### 4. Dues calculation (`src/pages/Dues.tsx`)
- For one-time funds:
  - `expected = monthly_amount` (a single payment, not multiplied by months).
  - `months` column shows `—` or `1`.
  - `paid` = sum of all transactions for that member+fund (regardless of date).
  - `due = max(expected - paid, 0)` — once paid in full, never shows due again; overpayment shown as credit like today.
- Monthly funds keep current behavior.

### 5. Members page (optional, if a one-time fee is normally auto-charged at registration)
- Out of scope unless you want a registration-fee auto-subscription on new member creation. Confirm if needed.

## Technical notes
- `funds.is_one_time` will appear in generated types after the migration runs; Dues/Funds code that joins funds will read it from the existing `funds` query (extend `select` to include `is_one_time`).
- No edge-function changes.
- No RLS changes (existing `funds` policies cover the new column).

## Out of scope
- Auto-creating a registration-fee transaction or subscription when a new member is added.
- Reporting changes beyond the Dues page.
