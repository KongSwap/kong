import i18n from 'sveltekit-i18n';

/** @type {import('sveltekit-i18n').Config} */
const config = {
  loaders: [
    {
      locale: 'en',
      key: 'common',
      loader: async () => (await import('./en/common.json')).default,
    },
    {
      locale: 'en',
      key: 'stats',
      loader: async () => (await import('./en/stats.json')).default,
    },
    {
      locale: 'en',
      key: 'swap',
      loader: async () => (await import('./en/swap.json')).default,
    },
    {
      locale: 'es',
      key: 'common',
      loader: async () => (await import('./es/common.json')).default,
    },
    {
      locale: 'es',
      key: 'stats',
      loader: async () => (await import('./es/stats.json')).default,
    },
  ],
};

const i18nInstance = new i18n(config);
export const { t, locale, locales, loading, loadTranslations } = i18nInstance; 