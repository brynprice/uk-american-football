## 1. Setup

First, install the required dependencies in your project:

```bash
npm install csv-parse dotenv
```

**CRITICAL**: Since the database is protected by security policies (RLS), you must add your **Service Role Key** to your `.env.local` file. This key bypasses security and allows the script to write data.

1.  Go to your **Supabase Dashboard** $\rightarrow$ **Project Settings** $\rightarrow$ **API**.
2.  Copy the `service_role` (secret) key.
3.  Add it to `/Users/brynprice/uk-football-history/.env.local` like this:
    ```bash
    SUPABASE_SERVICE_ROLE_KEY=your_secret_key_here
    ```

> [!WARNING]
> NEVER commit the `service_role` key to GitHub. It has full system access.

## 2. Prepare your Data

Ensure your spreadsheet has the following columns (in any order, but named exactly like this):

- `competition`: The name of the league (e.g. Budweiser League)
- `year`: The starting year of the season (e.g. 1986)
- `phase`: The division or phase (e.g. Division 1)
- `date`: YYYY-MM-DD
- `away_team`: Team name
- `home_team`: Team name
- `away_score`: Number (or empty if unknown)
- `home_score`: Number (or empty if unknown)
- `venue`: Venue name (optional)
- `notes`: Any archival notes (optional)

Export this sheet as a **CSV** file (e.g. `my_data.csv`).

## 3. Run the Import

Run the following command in your terminal:

```bash
node scripts/import_data.mjs data/sample_games.csv
```

(Replace `data/sample_games.csv` with the path to your own file).

## 4. Verification

Once the script finishes, refresh your website. The new competitions and games will appear automatically on the homepage and detail pages.
