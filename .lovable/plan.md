## Auth + App Shell + Dashboard

The database is already set up. The first person to sign up is automatically made the admin (via the `handle_new_user` database trigger we already created).

### What gets built

**1. Auth context (`src/hooks/useAuth.tsx`)**
- Wraps the app, tracks session + user + admin role
- Subscribes to auth state changes (listener set BEFORE getSession to avoid race conditions)
- Exposes `user`, `loading`, `isAdmin`, `signOut`

**2. Auth page (`src/pages/Auth.tsx`) at `/auth`**
- Tabs for **Sign In** and **Sign Up** (email + password)
- Sign-up form collects full name, email, password (stored in `user_metadata.full_name`, picked up by the DB trigger to create the profile)
- Zod validation on both forms (email format, min 6-char password, max lengths)
- On signup: shows "check email to confirm" toast (Cloud requires email confirmation by default)
- Note: First account to sign up automatically gets the `admin` role

**3. Protected route wrapper (`src/components/ProtectedRoute.tsx`)**
- Shows spinner while loading
- Redirects unauthenticated users to `/auth`

**4. App shell (`src/components/AppLayout.tsx`)**
- Left sidebar with navigation: Dashboard, Members, Funds, Income, Expenses, Reports
- Shows current user email + Sign Out button at bottom
- Mobile-friendly top bar

**5. Real dashboard (`src/pages/Index.tsx`)**
- Three top KPI cards: Total Income, Total Expense, Net Balance (in BDT ৳)
- Per-fund cards showing income / expense / balance for each of the 7 funds
- Pulls live data from `funds`, `transactions`, `expenses` tables

**6. Wire up routes (`src/App.tsx`)**
- `/auth` → Auth page (public)
- `/` → Dashboard (protected)
- Wrap the Routes with `<AuthProvider>`

### A couple of things worth noting

- **Email confirmation is ON by default.** That means after you sign up, you'll get a confirmation email and must click the link before you can sign in. If you'd like me to disable that for faster testing (auto-confirm signups), tell me — but for a real charity admin app, keeping it on is safer.
- **Google sign-in not included** — your previous answer specified single admin only. Easy to add later if you change your mind.
- **No "forgot password" flow yet** — can add in a follow-up if you want.
- The remaining tabs (Members, Funds, Income, Expenses, Reports) will route to "Coming soon" placeholders for now — I'll build them in the next steps after you can sign in and see the dashboard.

Approve and I'll implement it.