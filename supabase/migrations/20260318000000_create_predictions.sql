-- Migration: Create predictions table

CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    home_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    away_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    predicted_home_score INT NOT NULL,
    predicted_away_score INT NOT NULL,
    win_probability INT,
    confidence TEXT,
    game_id UUID REFERENCES games(id) ON DELETE SET NULL,
    weights JSONB, -- Stores { h2hWeight: 0.6, commonWeight: 0.4, recencyModifier: 1.5 }
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON predictions FOR SELECT USING (true);
-- Assuming admin has full access (consistent with other tables)

-- Indices
CREATE INDEX idx_predictions_home_team ON predictions(home_team_id);
CREATE INDEX idx_predictions_away_team ON predictions(away_team_id);
CREATE INDEX idx_predictions_game_id ON predictions(game_id);
