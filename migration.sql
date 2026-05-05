-- ============================================================================
--  kolman_shop — schema migration
--  Запустите этот SQL в Supabase → SQL Editor → New query → Run.
--  Это идемпотентно: можно запускать повторно без потери данных.
-- ============================================================================

-- 1) Хранилище контента сайта (баннер, категории, преимущества)
CREATE TABLE IF NOT EXISTS site_content (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Блогеры
CREATE TABLE IF NOT EXISTS bloggers (
  id               BIGSERIAL PRIMARY KEY,
  name             TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  image            TEXT NOT NULL DEFAULT '',
  social_url       TEXT NOT NULL DEFAULT '',
  gear_product_ids INTEGER[] NOT NULL DEFAULT '{}',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3) Заказы (приходят с фронта в /api/orders)
CREATE TABLE IF NOT EXISTS orders (
  id               BIGSERIAL PRIMARY KEY,
  status           TEXT NOT NULL DEFAULT 'new',
  customer_name    TEXT NOT NULL DEFAULT '',
  customer_contact TEXT NOT NULL DEFAULT '',
  delivery         TEXT NOT NULL DEFAULT '',
  comment          TEXT NOT NULL DEFAULT '',
  total            INTEGER NOT NULL DEFAULT 0,
  items            JSONB NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status, created_at DESC);

-- 4) Заявки в поддержку (приходят с фронта в /api/inquiries)
CREATE TABLE IF NOT EXISTS inquiries (
  id               BIGSERIAL PRIMARY KEY,
  category         TEXT NOT NULL DEFAULT 'other',
  status           TEXT NOT NULL DEFAULT 'new',
  customer_name    TEXT NOT NULL DEFAULT '',
  customer_contact TEXT NOT NULL DEFAULT '',
  message          TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS inquiries_category_idx ON inquiries(category, created_at DESC);
CREATE INDEX IF NOT EXISTS inquiries_status_idx ON inquiries(status, created_at DESC);

-- ============================================================================
--  Row-Level Security
--  orders и inquiries содержат персональные данные клиентов — закрываем для
--  anon/authenticated. Service-role key (используется в API на сервере) RLS не
--  блокирует, поэтому /api/orders и /api/inquiries продолжат работать.
--
--  site_content тоже закрываем: фронт читает контент через /api/site-content
--  (service-role), напрямую anon-клиент в нём не используется.
--
--  bloggers и admin_products НЕ трогаем — фронт использует anon-клиент как
--  fallback, и публичные данные о товарах/блогерах читаются именно так.
-- ============================================================================

ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries    ENABLE ROW LEVEL SECURITY;
