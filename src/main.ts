import "./assets/style.css";

import { createApp } from "vue";
import { defaults } from "mande";
import { i18n } from "./i18n";

import Vuetify from "./vuetify.conf";

import Dashboard from "@/Admin/Dashboard.vue";

defaults.credentials = "include";
defaults.headers["X-WP-Nonce"] = window.__VARS__.nonce;

if (!("_app_" in window)) {
   // @ts-ignore
   window._app_ = {};
}

Object.assign(window._app_, {
   with: (cb: (create: any, components: Record<string, Element>) => void) =>
      cb(window._app_.create, window._app_.components),

   create: (...params: Parameters<typeof createApp>) =>
      createApp(...params)
         .use(Vuetify)
         .use(i18n),
});

// @ts-ignore
if (window.__VARS__.isAdmin) window._app_.adminComponents = { Dashboard };
