-- Check existing tables and constraints
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('participants', 'session_participants');

-- Check existing constraints
SELECT constraint_name, table_name FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name IN ('participants', 'session_participants');
