-- Add Hall of Fame and Retired Jerseys tables

-- Hall of Fame Table
CREATE TABLE IF NOT EXISTS hall_of_fame (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  person_name TEXT NOT NULL, -- Display name for when person record might not exist or for historical accuracy
  year_inducted INT,
  seasons_with_team TEXT, -- e.g. "1986-1992"
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Retired Jerseys Table
CREATE TABLE IF NOT EXISTS retired_jerseys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  jersey_number TEXT NOT NULL,
  year_retired INT,
  honoured_person_name TEXT NOT NULL,
  honoured_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE hall_of_fame ENABLE ROW LEVEL SECURITY;
ALTER TABLE retired_jerseys ENABLE ROW LEVEL SECURITY;

-- Public Read access
CREATE POLICY "Public read access" ON hall_of_fame FOR SELECT USING (true);
CREATE POLICY "Public read access" ON retired_jerseys FOR SELECT USING (true);

-- Indices
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_team_id ON hall_of_fame(team_id);
CREATE INDEX IF NOT EXISTS idx_retired_jerseys_team_id ON retired_jerseys(team_id);
