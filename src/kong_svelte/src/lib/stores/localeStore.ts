import { writable } from "svelte/store";
import { browser } from "$app/environment";
import { locale as i18nLocale, loadTranslations } from "$lib/locales/translations";

const supportedLocales = ["en", "es"];
const defaultLocale = "en";

function getValidLocale(locale: string | null): string {
  if (!locale) return defaultLocale;
  return supportedLocales.includes(locale) ? locale : defaultLocale;
}

// Initialize the locale immediately
let initialLocale = defaultLocale;

if (browser) {
  const storedLocale = localStorage.getItem("locale");
  const browserLocale = navigator.language.split("-")[0];
  initialLocale = getValidLocale(storedLocale || browserLocale);
  localStorage.setItem("locale", initialLocale);
}

export const localeStore = writable<string>(initialLocale);

// Sync with sveltekit-i18n's locale store and load translations
localeStore.subscribe(async (value) => {
  i18nLocale.set(value);
  await loadTranslations(value);
});

export function switchLocale(newLocale: string) {
  if (!browser) return;

  const validLocale = getValidLocale(newLocale);
  localeStore.set(validLocale);
  localStorage.setItem("locale", validLocale);
}
