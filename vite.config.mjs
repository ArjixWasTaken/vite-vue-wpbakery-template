import { defineConfig } from "vite";

import vue from "@vitejs/plugin-vue";
import copy from "rollup-plugin-copy";
import generateShortcodes from "./includes/generate-shortcodes.mjs";

import { fileURLToPath, URL } from "node:url";

let dirname = __dirname.split("wp-content")[1]?.split("\\")?.join("/");
if (dirname?.[0] == "/") dirname = dirname?.substring(1);
if (dirname?.[(dirname?.length || 0) - 1] == "/")
   dirname = dirname.substring(0, dirname.length - 1);

if (!dirname) {
   console.error("Error: Could not find wp-content directory.");
   process.exit(1);
}

export default defineConfig({
   base: `/wp-content/${dirname}/assets/`,
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
