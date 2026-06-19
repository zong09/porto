import { useStore } from '../store/useStore';
import { translations } from '../store/translations';

export function useTranslation() {
  const language = useStore((state) => state.language);
  const setLanguage = useStore((state) => state.setLanguage);

  const t = (key: string, defaultText?: string): string => {
    const keys = key.split('.');
    let current: any = translations;
    for (const k of keys) {
      if (current && current[k] !== undefined) {
        current = current[k];
      } else {
        return defaultText || key;
      }
    }
    if (current && typeof current === 'object') {
      if (current[language] !== undefined) {
        return current[language];
      }
      if (current['en'] !== undefined) {
        return current['en'];
      }
    }
    return typeof current === 'string' ? current : defaultText || key;
  };

  return { t, language, setLanguage };
}
