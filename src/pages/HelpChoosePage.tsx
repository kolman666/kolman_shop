import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePageContent } from '../hooks/usePageContent'

type Option = { id: string; label: string; hint?: string }
type Step = { question: string; options: Option[] }

export default function HelpChoosePage() {
  const { t } = useTranslation()
  const get = usePageContent('help_choose', 'helpChoose')
  const steps = t('helpChoose.steps', { returnObjects: true }) as Step[]
  const [answers, setAnswers] = useState<Record<number, string>>({})

  const selected = (idx: number) => answers[idx]
  const allAnswered = steps.every((_, idx) => answers[idx])

  const setAnswer = (stepIdx: number, optionId: string) =>
    setAnswers((prev) => ({ ...prev, [stepIdx]: optionId }))

  const selectionLabels = steps
    .map((step, idx) => step.options.find((o) => o.id === answers[idx])?.label)
    .filter((label): label is string => Boolean(label))

  return (
    <div className="page-shell">
      <div className="page-container">
        <section className="quiz-hero">
          <span className="page-eyebrow">{get('eyebrow')}</span>
          <h1 className="quiz-hero__title">{get('title')}</h1>
          <p className="quiz-hero__sub">{get('subtitle')}</p>
        </section>

        {steps.map((step, idx) => (
          <section key={step.question} className="quiz-step">
            <div className="quiz-step__head">
              <span className={`quiz-step__index ${selected(idx) ? 'quiz-step__index--done' : ''}`.trim()}>
                {idx + 1}
              </span>
              <h2 className="quiz-step__q">{step.question}</h2>
            </div>
            <div className="quiz-options">
              {step.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`quiz-option ${answers[idx] === option.id ? 'quiz-option--active' : ''}`.trim()}
                  onClick={() => setAnswer(idx, option.id)}
                >
                  <span className="quiz-option__label">{option.label}</span>
                  {option.hint && <span className="quiz-option__hint">{option.hint}</span>}
                </button>
              ))}
            </div>
          </section>
        ))}

        {Object.keys(answers).length > 0 && (
          <section className="quiz-result">
            <p className="page-eyebrow" style={{ color: 'var(--color-text-soft)' }}>
              {allAnswered ? t('helpChoose.eyebrow') : `${t('helpChoose.stepLabel')} ${Object.keys(answers).length} / ${steps.length}`}
            </p>
            <h2 className="quiz-result__title">{get('resultTitle')}</h2>

            {selectionLabels.length > 0 && (
              <div className="quiz-result__pills">
                {selectionLabels.map((label) => (
                  <span key={label} className="quiz-result__pill">{label}</span>
                ))}
              </div>
            )}

            <p className="quiz-result__text">{get('resultText')}</p>

            <div className="quiz-result__actions">
              <a
                href="https://t.me/kolman_shop_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="cta-btn"
                style={{ textDecoration: 'none' }}
              >
                {t('helpChoose.telegramBtn')}
              </a>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setAnswers({})}
              >
                {t('helpChoose.resetBtn')}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
