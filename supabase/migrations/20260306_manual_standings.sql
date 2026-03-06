-- Add manual standings stats to participations table
ALTER TABLE participations 
ADD COLUMN wins INT,
ADD COLUMN losses INT,
ADD COLUMN ties INT,
ADD COLUMN points_for INT,
ADD COLUMN points_against INT;

-- Add a comment to explain these columns
COMMENT ON COLUMN participations.wins IS 'Manual override for wins if game data is missing';
COMMENT ON COLUMN participations.losses IS 'Manual override for losses if game data is missing';
COMMENT ON COLUMN participations.ties IS 'Manual override for ties if game data is missing';
COMMENT ON COLUMN participations.points_for IS 'Manual override for points scored if game data is missing';
COMMENT ON COLUMN participations.points_against IS 'Manual override for points conceded if game data is missing';
