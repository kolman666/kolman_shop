-- ============================================================
-- Запустить в Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_products (
  id          BIGSERIAL PRIMARY KEY,
  slug        TEXT        NOT NULL UNIQUE,
  brand       TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  price       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  image       TEXT        NOT NULL DEFAULT '',
  gallery     JSONB       NOT NULL DEFAULT '[]',
  availability TEXT       NOT NULL DEFAULT 'inStock'
                CHECK (availability IN ('inStock', 'preorder')),
  category_key TEXT       NOT NULL,
  specs       JSONB       NOT NULL DEFAULT '[]',
  is_featured BOOLEAN     NOT NULL DEFAULT false,
  quantity    INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Начинаем id с 1000, чтобы не пересекаться со статическими товарами (id 1-6)
ALTER SEQUENCE admin_products_id_seq RESTART WITH 1000;

-- Row Level Security: включаем
ALTER TABLE admin_products ENABLE ROW LEVEL SECURITY;

-- Все могут читать
CREATE POLICY "public_select" ON admin_products
  FOR SELECT TO anon, authenticated USING (true);

-- Запись только через service role key (наш API) — отдельных политик для insert/update/delete не нужно,
-- service role автоматически обходит RLS.
