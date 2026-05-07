# Admin Authentication Guide

This guide explains how to manage administrative users for the Britball Archive.

## Creating an Admin User

Since the admin section is private, you must manually create users via the Supabase Dashboard. There is no public registration form.

1.  **Log in to Supabase**: Go to the [Supabase Dashboard](https://supabase.com/dashboard).
2.  **Select Your Project**: Click on your project (e.g., `fbdctuiaegvdwtgtxhwv`).
3.  **Go to Authentication**: Click the **Authentication** icon (the lock symbol) in the left sidebar.
4.  **Add a New User**:
    -   Click the **Add User** button at the top right.
    -   Select **Create new user**.
5.  **Enter User Details**:
    -   **Email**: Enter the email address for the admin.
    -   **Password**: Set a secure password.
    -   **Auto-confirm User**: Ensure this is checked so the user doesn't have to wait for an email confirmation.
6.  **Save**: Click **Create user**.

## Logging In

Once the user is created, you can log in at:
[http://localhost:3000/login](http://localhost:3000/login) (or your production URL).

## Managing Existing Users

-   **Reset Password**: From the **Authentication > Users** list, click on a user and select **Send password reset** or manually change the password.
-   **Disable/Delete**: You can revoke access at any time by clicking the menu next to a user in the dashboard.

## Technical Notes

-   The authentication is managed via `@supabase/ssr` using cookies.
-   Protected routes are defined in `proxy.ts` (formerly `middleware.ts`).
-   To protect a new route, ensure its path starts with `/admin` or update the matcher in `proxy.ts`.
