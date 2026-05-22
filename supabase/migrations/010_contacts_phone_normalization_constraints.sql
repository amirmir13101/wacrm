-- Enforce normalized contact phone storage for new and updated rows.
-- Existing rows are not validated by this CHECK until they are updated.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contacts_phone_digits_only'
  ) THEN
    ALTER TABLE contacts
      ADD CONSTRAINT contacts_phone_digits_only
      CHECK (phone ~ '^[1-9][0-9]{6,14}$') NOT VALID;
  END IF;
END $$;

-- Prevent duplicate normalized phone numbers per user/business.
-- If existing duplicate rows already exist, this statement will fail until
-- those duplicates are manually merged or corrected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_user_phone_unique
  ON contacts(user_id, phone);
