-- Rollback obligations migration
DROP TABLE IF EXISTS obligation_transition_history;
DROP TABLE IF EXISTS obligations;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'obligation_status') THEN
    DROP TYPE obligation_status;
  END IF;
END
$$;
