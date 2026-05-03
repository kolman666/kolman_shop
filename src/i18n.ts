import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en'
import ru from './locales/ru'

const isBrowser = typeof window !== 'undefined'
const savedLanguage = isBrowser ? localStorage.getItem('language') : null
const browserLanguage = isBrowser && navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en'

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
    },
    lng: savedLanguage ?? browserLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
