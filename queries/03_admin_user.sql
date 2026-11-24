-- =====================================================================
-- Default admin account. Run AFTER 01_schema.sql and 02_seed_data.sql.
--
--   Email:    admin@advancedhomecare.in
--   Password: Admin@12345
--
-- CHANGE THIS PASSWORD right after your first login
-- (POST /api/auth/change-password from the admin panel).
-- The value below is a bcrypt hash, never a plain password.
-- =====================================================================

INSERT INTO admins (full_name, email, password_hash, role)
VALUES (
  'Super Admin',
  'admin@advancedhomecare.in',
  '$2b$12$Aq1xCM.rfPN8wnaWGxYTw.KRu/E.wbfrmiGKBSMAkmTo0vFSdNkQe',
  'super_admin'
);
