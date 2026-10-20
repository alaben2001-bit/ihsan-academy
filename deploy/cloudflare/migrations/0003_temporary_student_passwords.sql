-- Require newly issued student credentials to be changed at first sign-in.
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1));
CREATE INDEX IF NOT EXISTS idx_users_password_change ON users(must_change_password, active);
