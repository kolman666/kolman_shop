export default function PrivacyPolicyPage() {
  return (
    <div className="catalog-shell">
      <div className="catalog-hero" style={{ gridTemplateColumns: '1fr', marginBottom: 24 }}>
        <div>
          <span className="catalog-hero__eyebrow">юридическая информация</span>
          <h1 className="catalog-hero__title">политика конфиденциальности</h1>
          <p className="catalog-hero__note">последнее обновление: май 2026</p>
        </div>
      </div>

      <div
        style={{
          width: 'min(860px, calc(100% - 32px))',
          margin: '0 auto 64px',
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
        }}
      >
        <section
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-soft)',
            borderRadius: 20,
            padding: '32px 36px',
          }}
        >
          <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>1. Общие положения</h2>
          <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Настоящая Политика конфиденциальности описывает, как интернет-магазин <strong style={{ color: 'var(--color-text)' }}>kolman.shop</strong> собирает,
            использует и защищает персональные данные пользователей при использовании сайта и оформлении заказов.
            Используя наш сайт, вы соглашаетесь с условиями настоящей политики.
          </p>
        </section>

        <section
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-soft)',
            borderRadius: 20,
            padding: '32px 36px',
          }}
        >
          <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>2. Какие данные мы собираем</h2>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 2, color: 'var(--color-text-secondary)', fontSize: 14 }}>
            <li>Имя и контактные данные (email, номер телефона) — при оформлении заказа или обращении в поддержку</li>
            <li>Адрес доставки — для отправки заказа</li>
            <li>Технические данные (IP-адрес, тип браузера, cookie) — автоматически при посещении сайта</li>
            <li>История заказов и обращений — для улучшения сервиса</li>
          </ul>
        </section>

        <section
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-soft)',
            borderRadius: 20,
            padding: '32px 36px',
          }}
        >
          <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>3. Как мы используем данные</h2>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 2, color: 'var(--color-text-secondary)', fontSize: 14 }}>
            <li>Обработка и доставка заказов</li>
            <li>Связь с покупателем по вопросам заказа и поддержки</li>
            <li>Улучшение работы сайта и пользовательского опыта</li>
            <li>Отправка уведомлений о статусе заказа (только технические, не рекламные)</li>
          </ul>
        </section>

        <section
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-soft)',
            borderRadius: 20,
            padding: '32px 36px',
          }}
        >
          <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>4. Передача данных третьим лицам</h2>
          <p style={{ margin: '0 0 12px', lineHeight: 1.7, color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Мы не продаём и не передаём ваши персональные данные третьим лицам в коммерческих целях.
            Данные могут быть переданы только:
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 2, color: 'var(--color-text-secondary)', fontSize: 14 }}>
            <li>Службам доставки (СДЭК и другие) — для отправки заказа</li>
            <li>Платёжным системам — для обработки оплаты</li>
            <li>По требованию закона или государственных органов</li>
          </ul>
        </section>

        <section
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-soft)',
            borderRadius: 20,
            padding: '32px 36px',
          }}
        >
          <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>5. Защита данных</h2>
          <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Мы применяем технические и организационные меры для защиты ваших данных от несанкционированного доступа,
            изменения, раскрытия или уничтожения. Сайт использует HTTPS для шифрования передаваемых данных.
          </p>
        </section>

        <section
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-soft)',
            borderRadius: 20,
            padding: '32px 36px',
          }}
        >
          <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>6. Cookie</h2>
          <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Сайт использует cookie-файлы для корректной работы (например, сохранение товаров в корзине и языковых настроек).
            Вы можете отключить cookie в настройках браузера, однако некоторые функции сайта могут перестать работать.
          </p>
        </section>

        <section
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-soft)',
            borderRadius: 20,
            padding: '32px 36px',
          }}
        >
          <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>7. Ваши права</h2>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 2, color: 'var(--color-text-secondary)', fontSize: 14 }}>
            <li>Запросить доступ к своим персональным данным</li>
            <li>Потребовать исправления неточных данных</li>
            <li>Запросить удаление своих данных</li>
            <li>Отозвать согласие на обработку данных</li>
          </ul>
          <p style={{ margin: '16px 0 0', lineHeight: 1.7, color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Для реализации своих прав напишите нам на{' '}
            <a href="mailto:hello@kolman.shop" style={{ color: 'var(--color-main)' }}>hello@kolman.shop</a>
          </p>
        </section>

        <section
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-soft)',
            borderRadius: 20,
            padding: '32px 36px',
          }}
        >
          <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>8. Контакты</h2>
          <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--color-text-secondary)', fontSize: 14 }}>
            По всем вопросам, связанным с обработкой персональных данных, обращайтесь:{' '}
            <a href="mailto:hello@kolman.shop" style={{ color: 'var(--color-main)' }}>hello@kolman.shop</a>
            <br />
            Telegram: <a href="https://t.me/kolman_shop_bot" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-main)' }}>@kolman_shop_bot</a>
          </p>
        </section>
      </div>
    </div>
  )
}
