# Fix: Preview stuck on loading spinner

## Problem
You're signed in to the preview with an old Google account (`opunurullah@gmail.com`) that no longer has a row in `user_roles` or `admin_profiles` (only the new `nurullah` admin does). `ProtectedRoute` waits for `adminProfile` to become non-null, but for accounts with no profile it stays `null` forever — so the spinner never goes away and you never reach the login screen.

## Changes

### 1. `src/hooks/useAuth.tsx`
- Add a `profileLoaded: boolean` state, exposed via the context.
- Reset it to `false` whenever auth state changes to a signed-in user.
- After the `user_roles` + `admin_profiles` queries both resolve (even when they return no rows), set it to `true`.
- When there is no user, set `profileLoaded = true`.

### 2. `src/components/ProtectedRoute.tsx`
- Replace the `adminProfile === null` loading check with `user && !profileLoaded`.
- If `!canAccessApp`, redirect to `/auth` (Auth page already signs the stale session out and shows a message).

## Result
- Old `opunurullah@gmail.com` session gets bounced to `/auth`, which signs it out and shows the "account has been deactivated / no access" message.
- You can then log in as `nurullah` / `Nurullah@2923` and reach the dashboard.
- No DB or business-logic changes — frontend only.
