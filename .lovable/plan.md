## Goal

Allow attaching a receipt/voucher image to each Income and Expense entry, and remove the unused "Reports" sidebar link.

## Changes

### 1. Storage setup (migration)
- Create a public storage bucket `transaction-attachments`.
- Storage policies on `storage.objects` for bucket `transaction-attachments`:
  - Public SELECT (so thumbnails/links render without signed URLs).
  - Authenticated INSERT / UPDATE / DELETE (admin app is auth-gated).
- Add `attachment_url text` column to `public.transactions` (expenses already has `attachment_url`).

### 2. Income page (`src/pages/Income.tsx`)
- Add file input in the Add/Edit dialog ("Attachment (optional)") — accepts images (`image/*`).
- On submit: if a new file is picked, upload to `transaction-attachments/income/{uuid}-{filename}`, then save the resulting public URL into `transactions.attachment_url`. On edit, allow replacing or removing the existing attachment.
- In the table, show a small thumbnail / "View" link in a new "Attachment" column (opens the image in a new tab).

### 3. Expenses page (`src/pages/Expenses.tsx`)
- Same UX: file input in dialog, upload to `transaction-attachments/expense/...`, store URL in `expenses.attachment_url` (column already exists).
- Show thumbnail / "View" link in a new "Attachment" column.

### 4. Sidebar (`src/components/AppLayout.tsx`)
- Remove the `Reports` nav item (the `/reports` route doesn't exist anyway).

## Notes

- Images only, max ~5 MB (client-side check); stored in a public bucket so any user with the URL can view — appropriate for internal receipts shared among admins.
- No edit to the receipts table; the attachment is on the transaction itself.
