import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// English is the default and fallback language, statically loaded to prevent screen flickering
import enTranslations from '../locales/en.json';

const isBrowser = typeof window !== 'undefined';
const MANUAL_LANG_KEY = 'app_manual_lang';

// Always start in English so server-rendered HTML and the client's first (hydration) render match.
// The visitor's preferred language is applied right after hydration via applyUserLanguage().
i18n
  .use(initReactI18next)
  .init({
    lng: 'en',
    resources: {
      en: { translation: enTranslations }
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes values to prevent XSS
    }
  });

// Set of loaded languages to keep track of lazy-loaded locales
const loadedLanguages = new Set(['en']);

export async function loadLanguageResources(lang: string) {
  const cleanLang = lang.split('-')[0].toLowerCase();
  
  // If already loaded or unsupported, exit early
  if (loadedLanguages.has(cleanLang)) return;
  if (cleanLang !== 'fr' && cleanLang !== 'ar') return;

  try {
    if (cleanLang === 'fr') {
      const frTranslations = await import('../locales/fr.json');
      i18n.addResourceBundle('fr', 'translation', frTranslations.default || frTranslations);
      loadedLanguages.add('fr');
    } else if (cleanLang === 'ar') {
      const arTranslations = await import('../locales/ar.json');
      i18n.addResourceBundle('ar', 'translation', arTranslations.default || arTranslations);
      loadedLanguages.add('ar');
    }
    // Re-trigger a state update in react-i18next
    i18n.changeLanguage(i18n.language);
  } catch (error) {
    console.error(`Failed to lazy-load language resource for: ${cleanLang}`, error);
  }
}

// Prioritize a manually selected language first, then the device language
export function detectUserLanguage(): string {
  try {
    const manual = window.localStorage.getItem(MANUAL_LANG_KEY);
    if (manual) return manual;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies)
  }
  return (typeof navigator !== 'undefined' && navigator.language) || 'en';
}

export function setManualLanguage(lang: string) {
  try {
    window.localStorage.setItem(MANUAL_LANG_KEY, lang);
  } catch {
    // Ignore storage failures; the language still changes for this session
  }
  i18n.changeLanguage(lang);
}

export function applyUserLanguage() {
  const detected = detectUserLanguage();
  if (detected !== i18n.language) {
    i18n.changeLanguage(detected);
  }
}

// Helper to set up document direction (RTL/LTR) and lang attribute
const handleLanguageSetup = (lang: string) => {
  if (!isBrowser) return;
  const cleanLang = lang.split('-')[0].toLowerCase();
  const dir = cleanLang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = cleanLang;
};

i18n.on('languageChanged', (lang) => {
  loadLanguageResources(lang).then(() => {
    handleLanguageSetup(lang);
  });
});

export default i18n;
