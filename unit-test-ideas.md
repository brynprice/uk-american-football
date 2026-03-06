# Unit Testing Plan & Ideas for UK American Football Archive

*Note: This is a living document of ideas for future unit testing. Currently, the project does not have a testing framework installed.*

## Recommended Stack
- **Framework:** Vitest (fast, works seamlessly with Next.js/TypeScript)
- **Component Testing:** React Testing Library (`@testing-library/react`, `@testing-library/dom`, `jsdom`)

## Core Business Logic to Test

The most critical parts of the application where bugs could easily hide or break features are the data import scripts and the complex data aggregations/calculations in the UI.

### A. Data Import Scripts (`scripts/*.mjs`)
The import scripts handle deduplication, fuzzy matching, and entity resolution. These should be tested to ensure they don't create duplicate records or drop data.

*   **Slugification & Normalization (`slugify`, `trim`)**
    *   *Test:* Ensure team names like `London Olympians` and `London Olympians ` parse identical slugs.
    *   *Test:* Ensure competition names with special characters are slugified correctly.
*   **Entity Lookup Logic (`getOrCreatePerson`, `getOrCreateTeam`, etc.)**
    *   *Test:* Ensure `.maybeSingle()` is used correctly and handles both "found" and "not found" scenarios.
    *   *Test:* Ensure person name splitting (first/last) works correctly for edge cases (e.g., "John Smith", "John", "John Quincy Adams").
*   **Game Import Logic Details**
    *   *Test:* Ensure missing required columns (team, year) gracefully skip the row.
    *   *Test:* Ensure `is_double_header` boolean parsing correctly handles "yes", "true", "1", and empty values.
    *   *Test:* Ensure `date_precision` defaults correctly when dates are missing vs present.
*   **Game Staff Override Logic**
    *   *Test:* Ensure game staff are *not* added if a season-level participation record already holds that coach.
    *   *Test:* Ensure game staff *are* added if a season-level participation record exists but *lacks* a head coach.

### B. UI & Standings Calculations (`app/(public)/phases/[id]/page.tsx`)
The phase page calculates complex standings strictly on the frontend based on the fetched games array. This logic should ideally be extracted into a pure utility function (`lib/standings.ts`) so it can be thoroughly unit-tested without rendering the React component.

*   **Basic Win/Loss Calculation**
    *   *Test:* Correctly tallies Wins, Losses, and Ties from a standard array of game objects.
*   **Double Header Multiplier**
    *   *Test:* Ensure an `is_double_header: true` game counts as two wins, two losses, or two ties.
    *   *Test:* Ensure Points For and Points Against are doubled for double header games.
*   **Points Calculation**
    *   *Test:* Correctly sums `home_score` and `away_score` into `PF` and `PA`.
    *   *Test:* Handles null/missing scores gracefully without throwing `NaN` errors.
*   **Standings Sorting**
    *   *Test:* Teams are sorted by Win Percentage (`(W + T/2) / Games Played`) highest to lowest.

### C. Alias Rendering & UI Components (`app/(public)/teams/[id]/page.tsx`)
*   **Known Aliases Component**
    *   *Test:* Renders placeholder text if a team has no aliases.
    *   *Test:* Renders the alias name and year correctly.
    *   *Test:* Successfully renders the `<img>` tag with the correct Supabase storage URL when an alias has a `logo_url`.
*   **Badges**
    *   *Test:* Ensure "DH" / "Double Header" badges render when `is_double_header` is true.
