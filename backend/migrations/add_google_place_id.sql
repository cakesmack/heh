ALTER TABLE venues ADD COLUMN google_place_id VARCHAR(255);
CREATE UNIQUE INDEX ix_venues_google_place_id ON venues (google_place_id);
