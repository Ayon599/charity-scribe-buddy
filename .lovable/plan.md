## 1. Universal delete confirmation

Audit every `.delete()` call in the app and ensure each one is gated by an `AlertDialog` confirmation. Income and Expenses already have this; add it to the rest.

Pages to update:
- `src/pages/Members.tsx` — confirm before deleting a member
- `src/pages/MemberTypes.tsx` — confirm before deleting a member type
- `src/pages/Funds.tsx` — confirm before deleting a fund
- `src/components/MemberSubscriptionsDialog.tsx` — confirm before removing a fund subscription (if a delete exists there)

For consistency, each AlertDialog will:
- Title: "Delete [entity]?"
- Description: names the specific record (e.g. "Delete fund 'General'? This cannot be undone.")
- Cancel + destructive Delete buttons
- Hold a `deleteTarget` state object, same pattern already used in Income/Expenses

No backend changes needed.

## 2. Income: pay for multiple months at once

In `src/pages/Income.tsx`, replace the single "For month" field with **From month** and **To month** inputs.

Behavior (per your choice — one transaction per month):
- If From and To are empty or equal → behaves exactly as today (one transaction).
- If From and To are set and To > From → on submit, generate one transaction per month in the range, each with:
  - same fund, member, donor, payment method, amount, description, attachment URL
  - `txn_date` = the entered transaction date (unchanged)
  - `for_month` = first day of that month
- The amount field is the **per-month** amount (label updated to clarify).
- If "Issue receipt" is on, one receipt is created **per generated transaction** (each gets its own auto-numbered receipt).
- Attachment is uploaded once and the same stored path is reused across all generated rows (no duplicate uploads).
- A small helper text shows: "Will create N transactions totalling ৳X" when a range is selected.

Edit mode keeps a single "For month" field (editing an existing single row), since the range only makes sense at creation time.

Validation:
- To month must be ≥ From month
- Range capped at 24 months to prevent accidents

### Technical notes
- Form schema (`txnSchema`) gains `from_month` and `to_month` (both optional `YYYY-MM` strings). `for_month` stays for edit mode.
- New helper `monthsInRange(from, to)` returns an array of `YYYY-MM-01` dates.
- Insert path uses a single `supabase.from("transactions").insert([...])` with the array of payloads, then issues receipts in a follow-up insert.
- No schema migration required — existing `for_month` column on `transactions` is reused.
