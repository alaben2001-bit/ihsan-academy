-- Additive: product image URL for store items (used by the store cards UI).
-- Safe to run on existing databases; column is nullable and has no default.
ALTER TABLE store_items ADD COLUMN image_url TEXT;
