-- ============================================================================
-- kolman.shop — полная схема базы данных (Supabase / PostgreSQL)
-- ============================================================================
--
-- Это ЕДИНЫЙ идемпотентный скрипт: его можно безопасно прогонять повторно
-- (везде IF NOT EXISTS / CREATE OR REPLACE). Запускать в Supabase →
-- SQL Editor → New query → вставить целиком → Run.
--
-- Что создаётся:
--   • все таблицы магазина + индексы
--   • RPC-функции для атомарных операций (склад, промокоды)
--   • Storage-бакет public-media для медиабиблиотеки
--   • RLS-политики (модель доступа описана ниже)
--   • публикация realtime для чата
--
-- МОДЕЛЬ ДОСТУПА (важно понимать перед изменением RLS):
--   • Бэкенд (api/*) ходит в БД под SERVICE_ROLE_KEY и ОБХОДИТ RLS — все
--     записи/чтения с проверкой прав делаются там.
--   • Фронтенд (браузер) ходит под ANON-ключом и читает НАПРЯМУЮ только
--     публичные данные: каталог (admin_products), блогеров (bloggers) и
--     контент (site_content). Для них ниже включены публичные SELECT-политики.
--   • Приватные таблицы (заказы, заявки, чаты, пользователи, промокоды, медиа,
--     аудит) закрыты для anon — их отдаёт только API. Service-role не зависит
--     от RLS, поэтому всё работает.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. ТАБЛИЦЫ
-- ─────────────────────────────────────────────────────────────────────────

-- Пользователи витрины (собственная авторизация, не Supabase Auth).
CREATE TABLE IF NOT EXISTS auth_users (
  id                  BIGSERIAL PRIMARY KEY,
  email               TEXT NOT NULL UNIQUE,
  name                TEXT,
  first_name          TEXT,
  last_name           TEXT,
  phone               TEXT,
  photo               TEXT,
  telegram            TEXT,
  password_hash       TEXT NOT NULL,
  password_salt       TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 150000,
  last_seen_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_users_email_idx     ON auth_users (lower(email));
CREATE INDEX IF NOT EXISTS auth_users_last_seen_idx ON auth_users (last_seen_at);

-- Каталог товаров (создаётся и редактируется из админки).
CREATE TABLE IF NOT EXISTS admin_products (
  id             BIGSERIAL PRIMARY KEY,
  slug           TEXT,
  brand          TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  price          NUMERIC NOT NULL DEFAULT 0,
  -- old_price: «цена до скидки». Если задана и больше price — товар показывается
  -- со скидкой (перечёркнутая старая цена + бейдж процента).
  old_price      NUMERIC,
  image          TEXT,
  gallery        JSONB NOT NULL DEFAULT '[]'::jsonb,
  availability   TEXT NOT NULL DEFAULT 'inStock',
  category_key   TEXT,
  specs          JSONB NOT NULL DEFAULT '[]'::jsonb,
  variant_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_featured    BOOLEAN NOT NULL DEFAULT false,
  quantity       INTEGER NOT NULL DEFAULT 0,
  -- Барахолка (б/у).
  is_used        BOOLEAN NOT NULL DEFAULT false,
  condition      TEXT,
  defects        TEXT,
  original_price NUMERIC,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_products_category_idx ON admin_products (category_key);
CREATE INDEX IF NOT EXISTS admin_products_featured_idx ON admin_products (is_featured);
CREATE INDEX IF NOT EXISTS admin_products_used_idx     ON admin_products (is_used);

-- Заказы.
CREATE TABLE IF NOT EXISTS orders (
  id               BIGSERIAL PRIMARY KEY,
  status           TEXT NOT NULL DEFAULT 'new',
  customer_name    TEXT,
  customer_contact TEXT,
  customer_email   TEXT,
  delivery         TEXT,
  comment          TEXT,
  total            NUMERIC NOT NULL DEFAULT 0,
  items            JSONB NOT NULL DEFAULT '[]'::jsonb,
  promo_code       TEXT,
  promo_discount   NUMERIC,
  tracking_number  TEXT,
  tracking_carrier TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_created_idx  ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx   ON orders (status);
CREATE INDEX IF NOT EXISTS orders_email_idx    ON orders (lower(customer_email));

-- Обращения в поддержку.
CREATE TABLE IF NOT EXISTS inquiries (
  id               BIGSERIAL PRIMARY KEY,
  category         TEXT NOT NULL DEFAULT 'other',
  status           TEXT NOT NULL DEFAULT 'new',
  customer_name    TEXT,
  customer_contact TEXT,
  customer_email   TEXT,
  message          TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inquiries_created_idx ON inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS inquiries_status_idx  ON inquiries (status);
CREATE INDEX IF NOT EXISTS inquiries_email_idx   ON inquiries (lower(customer_email));

-- Отзывы о товарах.
CREATE TABLE IF NOT EXISTS reviews (
  id           BIGSERIAL PRIMARY KEY,
  product_id   BIGINT NOT NULL,
  author_email TEXT NOT NULL,
  author_name  TEXT,
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text         TEXT,
  photos       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_product_idx ON reviews (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_author_idx  ON reviews (lower(author_email));

-- Треды чата (одна переписка клиента с магазином).
CREATE TABLE IF NOT EXISTS chat_threads (
  id                 BIGSERIAL PRIMARY KEY,
  user_email         TEXT NOT NULL,
  title              TEXT,
  status             TEXT NOT NULL DEFAULT 'open',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_admin_seen_at TIMESTAMPTZ,
  last_user_seen_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS chat_threads_email_idx    ON chat_threads (lower(user_email));
CREATE INDEX IF NOT EXISTS chat_threads_lastmsg_idx  ON chat_threads (last_message_at DESC);

-- Сообщения чата.
CREATE TABLE IF NOT EXISTS messages (
  id           BIGSERIAL PRIMARY KEY,
  thread_id    BIGINT REFERENCES chat_threads (id) ON DELETE CASCADE,
  thread_email TEXT NOT NULL,
  sender       TEXT NOT NULL,
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_thread_idx       ON messages (thread_id, created_at);
CREATE INDEX IF NOT EXISTS messages_thread_email_idx ON messages (thread_email, created_at);

-- Промокоды.
CREATE TABLE IF NOT EXISTS promo_codes (
  code        TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,            -- 'percent' | 'fixed'
  value       NUMERIC NOT NULL,
  min_total   NUMERIC NOT NULL DEFAULT 0,
  valid_from  TIMESTAMPTZ,
  valid_to    TIMESTAMPTZ,
  max_uses    INTEGER,                  -- NULL = безлимит
  used_count  INTEGER NOT NULL DEFAULT 0,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Блогеры / сетапы.
CREATE TABLE IF NOT EXISTS bloggers (
  id               BIGSERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT,
  image            TEXT,
  social_url       TEXT,
  gear_product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bloggers_sort_idx ON bloggers (sort_order);

-- Контент сайта (слайдер, категории, тексты страниц и т.д.) — ключ → JSON.
CREATE TABLE IF NOT EXISTS site_content (
  key        TEXT PRIMARY KEY,
  value      JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Медиабиблиотека (метаданные; сами файлы в Storage public-media).
CREATE TABLE IF NOT EXISTS media (
  id          BIGSERIAL PRIMARY KEY,
  path        TEXT NOT NULL UNIQUE,
  url         TEXT NOT NULL,
  mime        TEXT NOT NULL,
  size        INTEGER NOT NULL DEFAULT 0,
  alt         TEXT,
  width       INTEGER,
  height      INTEGER,
  external    BOOLEAN NOT NULL DEFAULT false,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_uploaded_idx ON media (uploaded_at DESC);

-- Журнал действий администратора.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id         BIGSERIAL PRIMARY KEY,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  summary    TEXT,
  meta       JSONB,
  ip         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. RPC-ФУНКЦИИ (атомарные операции — закрывают гонки)
-- ─────────────────────────────────────────────────────────────────────────

-- Атомарное списание остатка. Возвращает новый остаток, либо NULL если не
-- хватило. NULL-/отрицательный quantity = «безлимит», такие товары не трогаем
-- (UPDATE их не матчит — это ожидаемо, заказ всё равно проходит).
CREATE OR REPLACE FUNCTION decrement_product_quantity(p_id BIGINT, p_delta INTEGER)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE new_qty INTEGER;
BEGIN
  UPDATE admin_products
  SET quantity = quantity - p_delta
  WHERE id = p_id AND quantity >= p_delta
  RETURNING quantity INTO new_qty;
  RETURN new_qty;
END $$;
GRANT EXECUTE ON FUNCTION decrement_product_quantity(BIGINT, INTEGER) TO service_role;

-- Атомарный «захват» использования промокода с лимитом. Возвращает true только
-- если used_count удалось увеличить в пределах max_uses.
CREATE OR REPLACE FUNCTION claim_promo_use(p_code TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE rows_updated INTEGER;
BEGIN
  UPDATE promo_codes SET used_count = used_count + 1
  WHERE code = p_code
    AND (max_uses IS NULL OR used_count < max_uses);
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END $$;
GRANT EXECUTE ON FUNCTION claim_promo_use(TEXT) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. STORAGE: публичный бакет для медиабиблиотеки
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('public-media', 'public-media', true)
ON CONFLICT (id) DO NOTHING;

-- service_role и так может управлять объектами; политика на случай строгого RLS.
DO $$ BEGIN
  CREATE POLICY "service manages media" ON storage.objects
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public reads media" ON storage.objects
    FOR SELECT TO anon, authenticated USING (bucket_id = 'public-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. RLS (Row Level Security)
-- ─────────────────────────────────────────────────────────────────────────
-- Включаем RLS на всех таблицах. service_role (бэкенд) RLS не касается.
-- Для anon (браузер) открываем SELECT только на публичные таблицы.

ALTER TABLE auth_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews         ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_threads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloggers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content    ENABLE ROW LEVEL SECURITY;
ALTER TABLE media           ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Публичное чтение: каталог, блогеры, контент (фронт читает их напрямую).
DO $$ BEGIN
  CREATE POLICY "public read products" ON admin_products
    FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public read bloggers" ON bloggers
    FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public read site_content" ON site_content
    FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ⚠️ ПРИВАТНОСТЬ ЧАТА: orders / inquiries / chat_threads / messages / auth_users
-- НАМЕРЕННО без anon-политик — чтобы их нельзя было прочитать напрямую из
-- браузера. Чтение/запись идут через API под service_role.
--
-- Следствие: realtime-подписки на messages/chat_threads под anon-ключом не
-- получают строки (RLS режет доставку), поэтому чат у клиента обновляется при
-- открытии/обновлении через API, а не «вживую». Это безопасный дефолт.
-- Если нужен живой realtime для клиентов — переходите на Supabase Auth и
-- добавьте scoped-политику вида `using (user_email = auth.jwt()->>'email')`.

-- ─────────────────────────────────────────────────────────────────────────
-- 5. REALTIME: публикация для чата (нужно для админ-консоли под service_role)
-- ─────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_threads;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- Готово. Дальше: заведите переменные окружения (см. db/README.md),
-- задеплойте проект и наполните каталог через админку /admin.
-- ============================================================================
