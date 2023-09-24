import { defineConfig } from "vite";

import vue from "@vitejs/plugin-vue";
import copy from "rollup-plugin-copy";
import generateShortcodes from "./includes/generate-shortcodes.mjs";

import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";

const dirname = resolve(__dirname).replace(/\\/g, "/").split("/").pop();
export default defineConfig({
   base: `/wp-content/plugins/${dirname}/assets/`,
   plugins: [
      generateShortcodes(),
      vue(),
      copy({
         targets: [{ src: "src/assets/*", dest: "assets/" }],
      }),
   ],
   build: {
      manifest: true,
      assetsInlineLimit: 0,
      outDir: "assets",
      assetsDir: "assetsDIR",

      emptyOutDir: true,
      sourcemap: true,

      rollupOptions: {
         input: ["src/main.ts"],
         output: {
            chunkFileNames: "js/[name].js",
            entryFileNames: "js/[name].js",

            assetFileNames: ({ name }) => {
               if (/\.css$/.test(name ?? "")) {
                  return "css/[name][extname]";
               }

               if (/\.(?:png|jpg|jpeg|PNG|JPG|JPEG)/.test(name ?? "")) {
                  return "images/[name][extname]";
               }

               // default value
               // ref: https://rollupjs.org/guide/en/#outputassetfilenames
               return "[name][extname]";
            },
         },
      },
   },
   resolve: {
      alias: {
         "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
   },
});
