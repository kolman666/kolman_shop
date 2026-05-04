-- ─── New WLmouse products ─────────────────────────────────────────────────────
-- Run this in your Supabase SQL editor.
-- Images are placeholders — update via the Admin panel after inserting.

INSERT INTO admin_products (slug, brand, title, description, price, image, gallery, availability, category_key, specs, variant_groups, is_featured, quantity)
VALUES
(
  'wlmouse-huan63',
  'wlmouse',
  'huan63',
  'Компактная 65% клавиатура с поддержкой горячей замены свитчей, трёхрежимным подключением (USB / 2.4G / BT) и gasket-маунтом для мягкого тактильного отклика.',
  7990,
  'https://ae01.alicdn.com/kf/Sdf5307d2047f4386b59dde83ff7df080r.png',
  '["https://ae01.alicdn.com/kf/Sdf5307d2047f4386b59dde83ff7df080r.png"]',
  'inStock',
  'products.categories.keyboards',
  '["hot-swap", "tri-mode", "65%", "gasket mount", "rgb"]',
  '[{"key":"switches","label":"Свитчи","options":["Red","Brown","Blue"]}]',
  false,
  10
),
(
  'wlmouse-ying-mg',
  'wlmouse',
  'ying mg',
  'Симметричная игровая мышь с флагманским датчиком PAW3950 и магнитным энкодером колеса для плавной прокрутки.',
  5990,
  'https://polzarium.ru/content/images/2025/05/0-7.jpg',
  '["https://polzarium.ru/content/images/2025/05/0-7.jpg"]',
  'inStock',
  'products.categories.mice',
  '["PAW3950", "8K hz", "61g", "magnetic encoder", "tri-mode"]',
  '[]',
  false,
  10
),
(
  'wlmouse-qisha',
  'wlmouse',
  'qisha',
  'Профессиональный игровой коврик с выбором покрытия: Speed для быстрых свайпов, Control для точных микродвижений, Balanced для всего остального.',
  2490,
  'https://fbi.cults3d.com/uploaders/14107503/illustration-file/1080cada-90f7-4eef-a8fe-a112bfde6460/cyberpunk_edgerunners_keycaps_04.jpg',
  '[]',
  'inStock',
  'products.categories.mousepads',
  '["900x400mm", "3mm", "anti-slip base"]',
  '[{"key":"surface","label":"Покрытие","options":["Speed","Control","Balanced"]}]',
  false,
  15
)
ON CONFLICT (slug) DO NOTHING;

-- ─── site_content table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS site_content (
  key         TEXT        PRIMARY KEY,
  value       JSONB       NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default hero slides (mirrors the hardcoded fallback in App.tsx)
INSERT INTO site_content (key, value) VALUES (
  'hero_slides',
  '[
    {
      "tag": "новинка",
      "title": "atk gear ghost ultimate",
      "subtitle": "бескомпромиссная игровая мышь с уникальным дизайном",
      "accent": "никаких компромиссов в производительности",
      "image": "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80"
    },
    {
      "tag": "хит продаж",
      "title": "razer viper v4 pro",
      "subtitle": "ультралегкая беспроводная имба",
      "accent": "оптический сенсор 50k dpi",
      "image": "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&q=80"
    },
    {
      "tag": "лимитка",
      "title": "logitech g pro superlight 2 yellow edition",
      "subtitle": "создана вместе с киберспортсменами со всего мира",
      "accent": "сенсор hero 25600 внутри",
      "image": "https://images.unsplash.com/photo-1563297007-0686b7003af7?w=800&q=80"
    }
  ]'
) ON CONFLICT (key) DO NOTHING;

-- ─── bloggers table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bloggers (
  id                BIGSERIAL   PRIMARY KEY,
  name              TEXT        NOT NULL DEFAULT '',
  description       TEXT        NOT NULL DEFAULT '',
  image             TEXT        NOT NULL DEFAULT '',
  social_url        TEXT        NOT NULL DEFAULT '',
  gear_product_ids  INTEGER[]   NOT NULL DEFAULT '{}',
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed sample bloggers (gear_product_ids left empty — fill via admin panel)
INSERT INTO bloggers (name, description, image, social_url, gear_product_ids, is_active, sort_order)
VALUES
(
  'shadowkekw',
  'стример-миллионник с онлайн-аудиторией более 2М. играет на топовых сетапах и обозревает новейшую периферию',
  'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80',
  'https://t.me/kolman_shop_bot',
  '{}',
  true,
  1
),
(
  'kolman picks',
  'наш собственный выбор — топовая периферия, которую мы рекомендуем после длительного тестирования',
  'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=600&q=80',
  'https://t.me/kolman_shop_bot',
  '{}',
  true,
  2
)
ON CONFLICT DO NOTHING;
