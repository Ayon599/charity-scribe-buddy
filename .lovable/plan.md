## Scope
Two focused UI changes on the Users page (`/users`) with no backend or data-model changes.

### 1. Replace email with username everywhere on the page
- **Table column**: change header from "Email" to "Username" and display the local part before `@prottoy.local`.
- **Create-admin dialog**: rename the "Email" field to "Username", switch input from `type="email"` to a normal text input, and send `username` to the `create-admin` edge function (it currently incorrectly sends `email`).
- **Reset-password dialog**: update the description to reference the user’s username.
- **Delete confirmation**: reference username instead of raw email.
- **Success toasts**: show username where email is currently shown.

### 2. Add a password view icon to the reset-password dialog
- Reuse the same Eye/EyeOff toggle pattern already used on the login page (`Auth.tsx`).
- Toggle the reset-password input between `type="password"` and `type="text"`.

### Files to edit
- `src/pages/Users.tsx` — only file changed.

### No database migrations, no edge-function changes.
All data stays as-is; username is derived from the stored synthetic email in the frontend.