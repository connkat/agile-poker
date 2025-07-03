-- Check existing tables and constraints
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('participants', 'session_participants');

-- Check existing constraints
SELECT constraint_name, table_name FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name IN ('participants', 'session_participants');

-- Ensure votes table can handle null values for "?" votes
-- This allows the value column to be null when users vote "?"
ALTER TABLE votes ALTER COLUMN value DROP NOT NULL;
