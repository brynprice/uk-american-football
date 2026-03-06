-- UK American Football Archive - SQL Schema
-- Production-grade historical archive schema

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES

-- Competitions (e.g., Budweiser League, BAFA National League)
CREATE TABLE competitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  level TEXT, -- Senior, Youth, Flag, University
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seasons (Specific year/iteration of a competition)
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE,
  year INT NOT NULL,
  name TEXT, -- e.g. "1986-87 Season"
  start_date DATE,
  end_date DATE,
  confidence_level TEXT DEFAULT 'high', -- high, medium, low
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(competition_id, year)
);

-- Phases (Recursive structure for Divisions, conferences, groups, playoffs)
CREATE TABLE phases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  parent_phase_id UUID REFERENCES phases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT, -- division, conference, group, playoffs, wild_card
  ordinal INT DEFAULT 0,
  confidence_level TEXT DEFAULT 'high',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Teams (Permanent entity, name changes handled via aliases)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, -- Current or last known primary name
  location TEXT,
  founded_year INT,
  folded_year INT,
  notes TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Team Aliases (Historical name changes)
CREATE TABLE team_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_year INT,
  end_year INT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- People (Coaches, players, officials)
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT,
  last_name TEXT,
  display_name TEXT NOT NULL,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Participations (Which team played in which phase/season)
CREATE TABLE participations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phase_id UUID REFERENCES phases(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  head_coach_id UUID REFERENCES people(id), -- Default coach for this phase
  wins INT,
  losses INT,
  ties INT,
  points_for INT,
  points_against INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Venues
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  city TEXT,
  address TEXT,
  coordinates POINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Games
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phase_id UUID REFERENCES phases(id) ON DELETE CASCADE,
  date DATE,
  date_precision TEXT DEFAULT 'full', -- full, month, year, season, unknown
  date_display TEXT,
  time TIME,
  home_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  home_score INT,
  away_score INT,
  venue_id UUID REFERENCES venues(id),
  status TEXT DEFAULT 'completed', -- completed, cancelled, postponed, awarded
  is_playoff BOOLEAN DEFAULT false,
  is_title_game BOOLEAN DEFAULT false,
  title_name TEXT,
  is_double_header BOOLEAN DEFAULT false,
  notes TEXT,
  confidence_level TEXT DEFAULT 'high',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Game Staff (Game-level overrides for coaches)
CREATE TABLE game_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'head_coach',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sources (Archival tracking)
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL, -- games, teams, people, etc.
  entity_id UUID NOT NULL,
  url TEXT,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notes (Generic attachable notes)
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS POLICIES (Read-only Public, Admin Write)

ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Public Read Policy
CREATE POLICY "Public read access" ON competitions FOR SELECT USING (true);
CREATE POLICY "Public read access" ON seasons FOR SELECT USING (true);
CREATE POLICY "Public read access" ON phases FOR SELECT USING (true);
CREATE POLICY "Public read access" ON teams FOR SELECT USING (true);
CREATE POLICY "Public read access" ON team_aliases FOR SELECT USING (true);
CREATE POLICY "Public read access" ON people FOR SELECT USING (true);
CREATE POLICY "Public read access" ON participations FOR SELECT USING (true);
CREATE POLICY "Public read access" ON venues FOR SELECT USING (true);
CREATE POLICY "Public read access" ON games FOR SELECT USING (true);
CREATE POLICY "Public read access" ON game_staff FOR SELECT USING (true);
CREATE POLICY "Public read access" ON sources FOR SELECT USING (true);
CREATE POLICY "Public read access" ON notes FOR SELECT USING (true);

-- 4. INDICES
CREATE INDEX idx_seasons_competition_id ON seasons(competition_id);
CREATE INDEX idx_phases_season_id ON phases(season_id);
CREATE INDEX idx_phases_parent_id ON phases(parent_phase_id);
CREATE INDEX idx_games_phase_id ON games(phase_id);
CREATE INDEX idx_games_date ON games(date);
CREATE INDEX idx_participations_phase_team ON participations(phase_id, team_id);
