import { createI18n } from "vue-i18n";

import el from "./el.json";
import en from "./en.json";

export const i18n = createI18n({
  locale: "el",
  legacy: false,
  fallbackLocale: "en",
  messages: { el, en },
});
