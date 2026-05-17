## Goal

1. Make Member Types, Funds, and Members fully manageable (delete + activate/deactivate).
2. Allow a member to belong to **multiple member types**.
3. Add edit and delete actions on Income and Expense entries.

---

## 1. Member Types page (`src/pages/MemberTypes.tsx`)

- Replace the single Power button with two actions:
  - **Toggle Active/Inactive** (Power icon) — already exists, keep but confirm via AlertDialog.
  - **Delete** (Trash icon) — opens AlertDialog. Blocks deletion if any member still references that type (checked client-side via the new `member_member_types` join), otherwise removes the row.
- Inactive types are excluded from the multi-select in the Add Member dialog (but still shown in filters).

## 2. Funds page (`src/pages/Funds.tsx`)

- Add to each row, next to Edit:
  - **Toggle Active/Inactive** (Power icon, AlertDialog confirm) — flips `is_active`.
  - **Delete** (Trash icon, AlertDialog confirm) — blocks if any transaction, expense, or subscription references the fund; otherwise deletes.

## 3. Members page — multi-type support

### Database changes (migration)

- New join table `member_member_types`:
  - `member_id uuid not null`
  - `member_type_id uuid not null`
  - composite primary key `(member_id, member_type_id)`
  - `created_at timestamptz default now()`
  - RLS: admins manage; authenticated read.
- Backfill: for every existing `members.member_type_id` that is not null, insert one row into `member_member_types`.
- Keep `members.member_type_id` column for now (deprecated; UI stops writing to it). No drop in this pass.
- Also add **delete** support for members: no schema change needed (RLS already allows admin delete).

### UI changes (`src/pages/Members.tsx`)

- Replace the single-select Member type `<Select>` in the Add/Edit dialog with a **multi-select** built from a `Popover` + checkbox list of active types (chips render selected types above the trigger).
- Load and save selections through the join table:
  - On open-edit: fetch `member_member_types` for that member, prefill selected ids.
  - On submit: upsert members row (without `member_type_id`), then diff & apply inserts/deletes on `member_member_types`.
- Members list shows all assigned types as small `Badge`s in the Type column.
- Type filter dropdown still single-select; a member matches if **any** of its types equals the filter.
- Add a third row action: **Delete** (Trash icon, AlertDialog confirm). Cascades cleanup of `member_member_types` rows for that member; subscriptions are left untouched (with a warning if any exist) — actually for safety, delete is blocked if the member has transactions; otherwise proceed and remove join rows + member.

## 4. Income page (`src/pages/Income.tsx`)

- Convert the existing create flow into create/edit:
  - Per row: **Edit** (Pencil) and **Delete** (Trash) buttons.
  - Edit reopens the dialog prefilled; submit performs `update` instead of `insert`. The "Issue receipt" switch is hidden on edit (existing receipt is preserved; amount changes update the linked receipt's amount).
  - Delete (AlertDialog confirm) removes the transaction and any linked receipt row.

## 5. Expenses page (`src/pages/Expenses.tsx`)

- Same pattern: per row **Edit** and **Delete** with AlertDialog confirm. Dialog reused for both modes.

---

## Technical notes

- Multi-select UI: lightweight implementation using `Popover` + `Command` (already in shadcn set) or simply a `Popover` with a list of `Checkbox` rows + a chip area — second option is simpler and avoids new deps.
- All destructive actions go through `AlertDialog` for confirmation.
- Fund and member-type delete handlers run a pre-check query (`count` on referencing tables) and surface a friendly toast when blocked.
- After the migration runs, `src/integrations/supabase/types.ts` regenerates automatically and gives typed access to `member_member_types`.

## Files touched

- `supabase/migrations/<new>.sql` — create `member_member_types`, RLS, backfill.
- `src/pages/MemberTypes.tsx` — add delete action.
- `src/pages/Funds.tsx` — add toggle + delete actions.
- `src/pages/Members.tsx` — multi-type select, delete action, multi-type display.
- `src/pages/Income.tsx` — edit + delete actions, reused dialog.
- `src/pages/Expenses.tsx` — edit + delete actions, reused dialog.
