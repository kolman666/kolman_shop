import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthError, login, register, type AuthErrorCode } from '../lib/auth'

type AuthModalProps = {
  open: boolean
  onClose: () => void
}

type Mode = 'login' | 'register'

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorCode, setErrorCode] = useState<AuthErrorCode | 'UNKNOWN' | ''>('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      setErrorCode('')
      setName('')
      setEmail('')
      setPassword('')
      setMode('login')
      setSubmitting(false)
    }
  }, [open])

  if (!open) {
    return null
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorCode('')
    setSubmitting(true)

    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(name, email, password)
      }
      onClose()
    } catch (error) {
      if (error instanceof AuthError) {
        setErrorCode(error.code)
      } else {
        setErrorCode('UNKNOWN')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const errorMessage = errorCode ? t(`ui.auth.errors.${errorCode}`) : ''

  return (
    <div className="auth-modal" role="dialog" aria-modal="true">
      <div className="auth-modal__overlay" onClick={onClose} />
      <div className="auth-modal__body">
        <h2 className="auth-modal__title">
          {mode === 'login' ? t('ui.auth.loginTitle') : t('ui.auth.registerTitle')}
        </h2>
        <p className="auth-modal__lead">
          {mode === 'login' ? t('ui.auth.loginLead') : t('ui.auth.registerLead')}
        </p>

        <form className="auth-modal__form" onSubmit={(e) => { void handleSubmit(e) }}>
          {mode === 'register' && (
            <label className="auth-modal__field">
              <span>{t('ui.auth.nameLabel')}</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
              />
            </label>
          )}

          <label className="auth-modal__field">
            <span>{t('ui.auth.emailLabel')}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="auth-modal__field">
            <span>{t('ui.auth.passwordLabel')}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </label>

          {errorMessage && <p className="auth-modal__error">{errorMessage}</p>}

          <div className="auth-modal__actions">
            <button type="button" className="auth-modal__cancel" onClick={onClose}>
              {t('ui.auth.cancel')}
            </button>
            <button type="submit" className="auth-modal__submit" disabled={submitting}>
              {mode === 'login' ? t('ui.auth.loginSubmit') : t('ui.auth.registerSubmit')}
            </button>
          </div>
        </form>

        <button
          type="button"
          className="auth-modal__switch"
          onClick={() => {
            setMode((prev) => (prev === 'login' ? 'register' : 'login'))
            setErrorCode('')
          }}
        >
          {mode === 'login' ? t('ui.auth.switchToRegister') : t('ui.auth.switchToLogin')}
        </button>
      </div>
    </div>
  )
}
