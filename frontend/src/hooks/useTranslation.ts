import { useCallback } from 'react';
import { useStore } from '../store/useStore';
import { translations, type TranslationTree } from '../store/translations';

export function useTranslation() {
  const language = useStore((state) => state.language);
  const setLanguage = useStore((state) => state.setLanguage);

  // Stable per language so components can list `t` in hook dependencies.
  const t = useCallback((key: string, defaultText?: string): string => {
    const keys = key.split('.');
    let current: string | TranslationTree = translations;
    for (const k of keys) {
      if (typeof current === 'object' && current[k] !== undefined) {
        current = current[k];
      } else {
        return defaultText || key;
      }
    }
    if (typeof current === 'object') {
      const localized = current[language] ?? current['en'];
      if (typeof localized === 'string') {
        return localized;
      }
    }
    return typeof current === 'string' ? current : defaultText || key;
  }, [language]);

  return { t, language, setLanguage };
}
