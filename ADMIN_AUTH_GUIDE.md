# Admin Authentication Guide

This guide explains how to manage administrative users for Britball.io.

## Creating an Admin or Contributor User

The preferred way to create new accounts is through the in-app **User & Permissions Manager** at `/admin/users` (requires an existing Super Admin session), which automatically configures `app_metadata.role` and `app_metadata.permissions` with a strong password (minimum 10 characters).

If bootstrapping the very first Super Admin directly via the Supabase Dashboard:

1.  **Log in to Supabase**: Go to the [Supabase Dashboard](https://supabase.com/dashboard).
2.  **Select Your Project**: Click on your project (e.g., `fbdctuiaegvdwtgtxhwv`).
3.  **Go to Authentication**: Click the **Authentication** icon (the lock symbol) in the left sidebar.
4.  **Add a New User**:
    -   Click the **Add User** button at the top right.
    -   Select **Create new user**.
5.  **Enter User Details**:
    -   **Email**: Enter the email address for the admin.
    -   **Password**: Set a secure password (at least 10 characters).
    -   **Auto-confirm User**: Ensure this is checked so the user doesn't have to wait for an email confirmation.
6.  **Save & Assign Super Admin Role**: Click **Create user**, then ensure the user's `raw_app_meta_data` includes `"role": "admin"` (accounts without `app_metadata.role === "admin"` default to zero privileges under fail-closed RBAC).

## Logging In

Once the user is created, you can log in at:
[http://localhost:3000/login](http://localhost:3000/login) (or your production URL).

## Managing Existing Users

-   **Reset Password**: From the **Authentication > Users** list, click on a user and select **Send password reset** or manually change the password.
-   **Disable/Delete**: You can revoke access at any time by clicking the menu next to a user in the dashboard.

## Managing User Permissions & Roles

Admins can manage granular tool permissions at `/admin/users`:

- **Super Admin**: Unrestricted access to all tools, user management, and sensitive operations.
- **Role Presets**:
  - **Media & Intelligence Analyst**: Access to Weekly Facts (`/admin/facts`), Score Predictor, and Writer's Poll.
  - **Gameday & Poll Contributor**: Access to Gameday Scoreboard, Writer's Poll, Score Predictor, and Weekly Facts.
  - **Poll Voter**: Access only to the Uniball Writer's Poll.
  - **Historical Archivist**: Access to archive management tools (games, coaches, champions, proposals, anomalies).
- **Individual Tool Toggles**: Toggle individual permissions (e.g. `facts`, `gameday`, `poll`, `predictions`, `proposals`, `add_game`, `walkovers`, `set_coach`, `anomalies`, `game_counts`, `champions`).

## Technical Notes

-   The authentication is managed via `@supabase/ssr` using cookies.
-   Protected routes are defined in `proxy.ts` (formerly `middleware.ts`).
-   To protect a new route, ensure its path starts with `/admin` or update the matcher in `proxy.ts`.
