import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// English is the default and fallback language, statically loaded to prevent screen flickering
import enTranslations from '../locales/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations }
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes values to prevent XSS
    },
    detection: {
      // Prioritize manually selected language first, then device language (navigator)
      order: ['localStorage', 'navigator'],
      // We will only cache to localStorage MANUALLY when the user clicks the language button,
      // so we remove 'localStorage' from the auto-caches array.
      caches: [],
      lookupLocalStorage: 'app_manual_lang',
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

// Automatically load the detected language
const detectedLang = i18n.language || 'en';
const cleanDetected = detectedLang.split('-')[0].toLowerCase();
loadLanguageResources(cleanDetected);

// Helper to set up document direction (RTL/LTR) and lang attribute
const handleLanguageSetup = (lang: string) => {
  const cleanLang = lang.split('-')[0].toLowerCase();
  const dir = cleanLang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = cleanLang;
};

i18n.on('languageChanged', (lang) => {
  const cleanLang = lang.split('-')[0].toLowerCase();
  loadLanguageResources(cleanLang).then(() => {
    handleLanguageSetup(lang);
  });
});

// Setup initial document attributes
handleLanguageSetup(detectedLang);

export default i18n;
