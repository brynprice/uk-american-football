# UK American Football Archive

A web application built to archive, catalog, and display the history of American Football in the United Kingdom. This project tracks competitions, seasons, phases, teams, venues, people, and game results across the history of the sport in the UK.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Data Fetching**: Server Components and Supabase JS Client

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Create a `.env.local` file in the root directory and add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```
   > **Note**: The `SUPABASE_SERVICE_ROLE_KEY` is required for running the data import scripts to bypass Row Level Security (RLS).

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Data Schema & Migrations

The database schema is defined in `supabase/schema.sql`. It includes tables for:
- `competitions`
- `seasons`
- `phases`
- `teams`
- `team_aliases`
- `venues`
- `people`
- `games`
- `game_staff`
- `participations` (season-level team and coach enrollments)
- `awards` (e.g., retired jerseys, hall of fame)

## Data Imports

We provide a suite of Node.js scripts for bulk-loading historical CSV data into the database. These are located in the `scripts/` directory.

Please refer to the **[Data Import Guide](DATA_IMPORT_GUIDE.md)** for detailed usage instructions, CSV formats, and the recommended import sequence.
