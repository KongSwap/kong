-- Application state table for storing metadata and checkpoints
CREATE TABLE IF NOT EXISTS application_state (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_application_state_key ON application_state(key);

-- Insert initial state for last_db_update_id if it doesn't exist
INSERT INTO application_state (key, value) 
VALUES ('last_db_update_id', '0')
ON CONFLICT (key) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE application_state IS 'Stores application metadata and checkpoint information';
COMMENT ON COLUMN application_state.key IS 'Unique identifier for the state value';
COMMENT ON COLUMN application_state.value IS 'The state value (stored as text for flexibility)';
COMMENT ON COLUMN application_state.updated_at IS 'Timestamp of last update';