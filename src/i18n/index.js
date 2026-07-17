// App-wide language setup. Same localStorage + persisted-preference pattern
// as utils/theme.js — the difference is i18next owns the "current value"
// and broadcasts changes itself (languageChanged event), so components use
// react-i18next's useTranslation() hook instead of a custom event.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ms from './locales/ms.json';

export const LANGUAGE_STORAGE_KEY = 'borneo-tracker:language';
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ms', label: 'Bahasa Melayu' },
];

function getStoredLanguage() {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (SUPPORTED_LANGUAGES.some((l) => l.code === stored)) return stored;
  } catch {
    /* ignore */
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ms: { translation: ms },
  },
  lng: getStoredLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    /* ignore */
  }
  document.documentElement.setAttribute('lang', lng);
});

document.documentElement.setAttribute('lang', i18n.language);

export default i18n;
