import { useTranslation } from 'react-i18next'

// Small trust signals shown on the product page and in the cart to reduce
// checkout friction (originality, warranty, delivery, payment options).
// Labels go through i18n with RU defaults so the EN locale can override them
// from src/locales/en.ts without touching this file.

type TrustBadgesProps = {
  variant?: 'row' | 'compact'
}

export default function TrustBadges({ variant = 'row' }: TrustBadgesProps) {
  const { t } = useTranslation()

  const badges = [
    {
      key: 'original',
      label: t('ui.trust.original', { defaultValue: 'Оригинал, гарантия подлинности' }),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      ),
    },
    {
      key: 'warranty',
      label: t('ui.trust.warranty', { defaultValue: 'Гарантия и возврат 14 дней' }),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 12a9 9 0 1 0 9-9" />
          <path d="M3 4v5h5" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      ),
    },
    {
      key: 'delivery',
      label: t('ui.trust.delivery', { defaultValue: 'Доставка CDEK и Почтой по РФ' }),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="1" y="3" width="15" height="13" rx="2" />
          <path d="M16 8h4l3 5v3h-7V8z" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      ),
    },
    {
      key: 'payment',
      label: t('ui.trust.payment', { defaultValue: 'Оплата: перевод, СБП, при получении' }),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      ),
    },
  ]

  return (
    <ul className={`trust-badges trust-badges--${variant}`}>
      {badges.map((b) => (
        <li key={b.key} className="trust-badge">
          <span className="trust-badge__icon" aria-hidden="true">{b.icon}</span>
          <span className="trust-badge__label">{b.label}</span>
        </li>
      ))}
    </ul>
  )
}
