// @ts-check
import { createFilter } from "@rollup/pluginutils";
import { readFile, readdir, unlink, writeFile, mkdir } from "fs/promises";
import { join, resolve, basename } from "node:path";
import { existsSync } from "fs";

const propDefRegex = /defineProps\({.*?}\)/s;
const whitespaceRegex = /\s+(?=([^"]*"[^"]*")*[^"]*$)/g;
const propRegex = /(\w+):({.*?})/g;

const camelCaseToSnakeCase = (/**@type {String} */ str) =>
   str.replace(/(?<=[a-z0-9])([A-Z])/g, "_$1").toLowerCase();

const shortCodeTemplate = `\
<?php

namespace MyPlugin\\Classes\\ShortCodes;

use MyPlugin\\Classes\\Utils;

if (!defined('ABSPATH')) { exit; }

class {{ComponentName}}
{
    function __construct()
    {
        add_action('init', array($this, 'create_shortcode'), 999);
        add_shortcode('vc_MyPlugin_{{ComponentName}}', array($this, 'render_shortcode'));
    }

    public function create_shortcode()
    {
        // Stop all if VC is not enabled
        if (!defined('WPB_VC_VERSION')) { return; }

        vc_map(
            [
                'name' => '{{ComponentName}}',
                'base' => 'vc_MyPlugin_{{ComponentName}}',
                'description' => '',
                'category' => 'MyPlugin',
                'params' => [
{{ParamDecl}}
                ],
            ]
        );
    }

    public function render_shortcode($atts, $content, $tag)
    {
        $atts = (shortcode_atts(
            [
{{AttrDecl}}
            ],
            $atts
        ));

        $uuid4 = '_' . Utils::guidv4();
        return str_replace(
          [
            '[uuid4]',
{{AttrKeys}}
          ],
          [
            $uuid4,
{{AttrValues}}
          ],
          '
            <div id="[uuid4]"></div>
            <script type="module">
                await window._app_.load;
                window._app_.with((create, { {{ComponentName}} }) => {
{{AsIntUtil}}\
\
                    create({{ComponentName}}, {
{{AttrPassthru}}
                    }).mount("#[uuid4]");
                })
            </script>
          '
        );
    }
}
`;

const AsIntUtil = `
/**
* @param {string} v
* @returns {number}
*/
const asInt = (v) => {
    try {
    const num = parseInt(v, 10);
      return isNaN(num) ? 0 : num;
    } catch { return 0 }
};
`;

const indexFileTemplate = `\
<?php

namespace MyPlugin\\Classes;

{{ShortCodeImports}}
class Shortcodes
{
    public function Init()
    {
{{ShortCodeInit}}    }
}
`;

const objRegex = /(\w+):((?:(['"]).*?\3)|\w+|(\[).*?]),?/g;
const parseObj = (/**@type {String}*/ obj) => {
   const /**@type {Object.<String, any>} */ propDef = {};

   for (const [_, key, value, isString, isArray] of obj.matchAll(objRegex)) {
      // prettier-ignore
      propDef[key] = !!isString
      ? value.substring(1, value.length - 1)
      : !!isArray
        ? (0, eval)(value)
        : ["true", "false"].includes(value)
          ? value === "true"
          : value;
   }

   return propDef;
};

export default function generateShortcodes() {
   const filter = createFilter("src/components/*.vue");
   const isMain = createFilter("src/main.ts");

   const /**@type {{[key: String]: {[key: String]: { type: String }}}} */
      components = {};

   return {
      name: "vite-plugin-vue-wpbakery",

      async load(/**@type {string} */ id) {
         if (!isMain(id)) return;
         let code = await readFile(id.split("?")[0], "utf-8");

         const components = await readdir(
            resolve(__dirname, "..", "src", "components"),
         ).then((cs) => cs.filter((c) => c.endsWith(".vue")));

         code =
            components
               .map(
                  (c) => `import ${c.split(".")[0]} from "@/components/${c}";`,
               )
               .join("\n") +
            "\n\n" +
            code;
         code +=
            "\n\n" +
            `window._app_.components = { ${components
               .map((c) => c.split(".")[0])
               .join(", ")} }`;

         return { code };
      },

      async buildStart() {
         const componentsDir = resolve(__dirname, "../src/components");
         for (const file of await readdir(componentsDir)) {
            const code = await readFile(resolve(componentsDir, file), "utf-8");

            let /**@type {any} */ props = code
                  .match(propDefRegex)?.[0]
                  ?.replace(whitespaceRegex, "");

            if (!props) continue;

            try {
               props = Array.from(props.matchAll(propRegex)).reduce(
                  (a, [_, key, obj]) => {
                     a[key] = parseObj(obj);
                     return a;
                  },
                  {},
               );
            } catch (e) {
               const /**@type {Error} */ error = e;
               console.log(
                  `Failed to parse the props for '${file}', reason: ${error.message}`,
               );
               continue;
            }

            components[file] = props;
         }
      },
      async buildEnd() {
         const out = resolve(__dirname, "../includes/Classes/ShortCodes");

         if (!existsSync(out)) await mkdir(out);
         for (const file of await readdir(out)) {
            await unlink(join(out, file));
         }

         let compInit = "";
         let compImports = "";

         for (let [id, props] of Object.entries(components)) {
            const name = basename(id).replace(".vue", "");

            let useIntUtil = false;

            compImports += `use MyPlugin\\Classes\\ShortCodes\\${name};\n`;
            compInit += `        new ${name}();\n`;

            let code = shortCodeTemplate.replace(/{{ComponentName}}/g, name);

            let attrDecl = "";
            let attrPassthru = "";
            let paramDecl = "";
            let attrKeys = "";
            let attrValues = "";

            let i = 0;

            for (const [prop, { type, ...extra }] of Object.entries(props)) {
               i++;
               const /**@type {any}*/ extras = extra;

               {
                  extras.title = extras.title || prop;
                  extras.description = extras.description || `type: ${type}`;
               }

               attrDecl += `                '${camelCaseToSnakeCase(
                  prop,
               )}' => '',`;

               if (type === "Number") {
                  useIntUtil = true;
                  attrPassthru += `                        ${prop}: asInt("[${prop}]")`;
               } else {
                  attrPassthru += `                        ${prop}: "[${prop}]"`;
               }

               paramDecl += `[
    'type' => '${Array.isArray(extras.enum) ? "dropdown" : "textfield"}',
    'holder' => 'div',
    'class' => 'MyPlugin_${name}_${prop}',
    'heading' => '${extras.title}',
    'param_name' => '${camelCaseToSnakeCase(prop)}',
    'save_always' => true,
    'value' => ${
       Array.isArray(extras.enum)
          ? JSON.stringify(extras.enum)
          : `'${extras.default || ""}'`
    },${
       Array.isArray(extras.enum)
          ? `\n    'std' => '${extras.default || extras.enum[0]}',`
          : ""
    }
    'description' => '${extras.description}'
],`.replace(/^/gm, "                    ");

               attrKeys += `            '[${prop}]'`;
               attrValues += `            $atts['${camelCaseToSnakeCase(
                  prop,
               )}']`;

               // @ts-ignore
               if (i < Object.keys(props).length) {
                  attrKeys += ",\n";
                  attrValues += ",\n";

                  attrDecl += "\n";
                  paramDecl += "\n";

                  attrPassthru += ",\n";
               } else {
                  attrPassthru += "";
               }
            }

            code = code
               .replace("{{AsIntUtil}}", useIntUtil ? AsIntUtil : "")
               .replace("{{AttrDecl}}", attrDecl)
               .replace("{{AttrPassthru}}", attrPassthru)
               .replace("{{ParamDecl}}", paramDecl)
               .replace("{{AttrKeys}}", attrKeys)
               .replace("{{AttrValues}}", attrValues);

            await writeFile(join(out, `${name}.php`), code, {
               encoding: "utf-8",
            });
         }

         await writeFile(
            join(resolve(out, ".."), "Shortcodes.php"),
            indexFileTemplate
               .replace("{{ShortCodeInit}}", compInit)
               .replace("{{ShortCodeImports}}", compImports),
            { encoding: "utf-8" },
         );
      },
   };
}
