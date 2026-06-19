# База данных и запуск проекта

## 1. Создать проект Supabase
1. Зарегистрируйтесь на [supabase.com](https://supabase.com), создайте новый проект.
2. Откройте **SQL Editor → New query**, вставьте целиком [`db/schema.sql`](./schema.sql) и нажмите **Run**.
   Скрипт идемпотентный — его можно прогонять повторно без вреда.
3. В **Project Settings → API** скопируйте:
   - `Project URL` → пойдёт в `SUPABASE_URL` и `VITE_SUPABASE_URL`
   - `anon public` ключ → `VITE_SUPABASE_ANON_KEY`
   - `service_role` ключ → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ секрет, только на сервере!)

## 2. Переменные окружения

### Серверные (Vercel/Netlify → Environment Variables) — НЕ публиковать
| Переменная | Назначение |
|---|---|
| `SUPABASE_URL` | URL проекта Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role ключ (полный доступ к БД) |
| `ADMIN_SECRET` | пароль входа в админку `/admin` (длинная случайная строка) |
| `AUTH_TOKEN_SECRET` | секрет для подписи токенов пользователей (длинная случайная строка) |
| `TG_BOT_TOKEN` | токен Telegram-бота от @BotFather |
| `TG_CHAT_ID` | ID чата, куда падают заказы/заявки/сообщения |
| `TG_WEBHOOK_SECRET` | **обязателен** — секрет вебхука бота (см. ниже) |
| `TG_ADMIN_USER_IDS` | через запятую — Telegram ID, кому можно управлять ботом |

### Фронтенд (префикс `VITE_`, попадают в браузер — это нормально)
| Переменная | Назначение |
|---|---|
| `VITE_SUPABASE_URL` | тот же URL проекта |
| `VITE_SUPABASE_ANON_KEY` | anon-ключ (публичный, только чтение публичных таблиц) |

> Сгенерировать случайный секрет: `openssl rand -hex 32`

## 3. Telegram-бот (опционально, но рекомендуется)
1. Создайте бота у [@BotFather](https://t.me/BotFather), получите `TG_BOT_TOKEN`.
2. Узнайте `TG_CHAT_ID` (например, написав боту и открыв `https://api.telegram.org/bot<TOKEN>/getUpdates`).
3. Придумайте `TG_WEBHOOK_SECRET` и зарегистрируйте вебхук:
   ```bash
   curl -X POST "https://api.telegram.org/bot<TG_BOT_TOKEN>/setWebhook" \
        -H "Content-Type: application/json" \
        -d '{"url":"https://ВАШ_ДОМЕН/api/telegram-webhook","secret_token":"<TG_WEBHOOK_SECRET>","allowed_updates":["message","callback_query"]}'
   ```
   > Без `TG_WEBHOOK_SECRET` вебхук-эндпоинт намеренно отвечает 503 (защита от неавторизованных вызовов).

## 4. Деплой
- **Сборка:** `npm install && npm run build` (выход в `dist/`).
- **Vercel:** импортируйте репозиторий, переменные окружения добавьте в настройках проекта. Конфиг и заголовки безопасности — в `vercel.json`.
- Зайдите на `/admin`, введите `ADMIN_SECRET`, наполните каталог и контент.

## 5. Что внутри схемы
Таблицы: `auth_users`, `admin_products`, `orders`, `inquiries`, `reviews`,
`chat_threads`, `messages`, `promo_codes`, `bloggers`, `site_content`, `media`,
`stock_notifications`, `admin_audit_log`. RPC: `decrement_product_quantity`, `claim_promo_use`.
Storage-бакет: `public-media`. RLS и модель доступа описаны в комментариях внутри `schema.sql`.

- `admin_products.old_price` — «цена до скидки»: если задана и больше `price`, на витрине показывается зачёркнутой + бейдж скидки.
- `stock_notifications` — лист ожидания «сообщить о поступлении» (форма на странице товара при отсутствии в наличии; админ видит спрос во вкладке «Заявки»).

Фичи на основе таблицы `site_content` (отдельная миграция не нужна, настраиваются из админки):
- `promo_banner` — полоса акции с таймером вверху всех страниц (Промокоды → Баннер акции).
- `bundles` — комплекты «Соберите сетап»; скидка вешается на промокод (Промокоды → Комплекты).

Реферальная программа отдельной таблицы не требует — персональные коды живут в `promo_codes` (с заметкой «Реферал …»).
