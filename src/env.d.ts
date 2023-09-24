/// <reference types="vite/client" />
/// <reference types="vue-i18n/vue-i18n.d.ts" />

import type { App } from "vue";

declare global {
  interface Window {
    __VARS__: { isAdmin: boolean; nonce: string };
    _app_: {
      with(
        cb: (
          app: typeof window._app_.create,
          components: typeof window._app_.components
        ) => void
      );

      create(elem: Element): App<Element>;
      components: Record<string, Element>;

      adminComponents?: Record<string, Element>;
    };
  }
}

export {};
