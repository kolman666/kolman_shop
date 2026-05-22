import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// Catch-all 404 — shown for any path not matched by the explicit routes.
export default function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <main className="page-shell">
      <div className="page-container" style={{ alignItems: 'center', justifyItems: 'center', textAlign: 'center' }}>
        <span className="page-eyebrow">404</span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 7vw, 80px)', letterSpacing: '-0.04em', margin: 0 }}>
          {t('ui.notFound.title')}
        </h1>
        <p style={{ color: 'var(--color-text-dim)', fontSize: 16, lineHeight: 1.6, maxWidth: '52ch', margin: 0 }}>
          {t('ui.notFound.text')}
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 16 }}>
          <Link to="/" className="cta-btn" style={{ textDecoration: 'none' }}>
            {t('ui.notFound.toHome')}
          </Link>
          <Link to="/catalog" className="ghost-btn">
            {t('ui.notFound.toCatalog')}
          </Link>
        </div>
      </div>
    </main>
  )
}
