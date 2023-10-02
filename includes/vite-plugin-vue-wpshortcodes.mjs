import { readFile, readdir, unlink, writeFile, mkdir, stat } from "fs/promises";
import { join, resolve, basename } from "node:path";

import { createFilter } from "@rollup/pluginutils";

import { parse as parseSFC } from "@vue/compiler-sfc";
import { parse as parseAst } from "@babel/parser";
import { transform } from "@babel/core";

const existsAsync = async path => !!(await stat(path).catch(e => false));

function extractValue(node) {
   switch (node.type) {
      case "NumericLiteral":
         return node.value;
      case "StringLiteral":
      case "BooleanLiteral":
         return node.value;
      case "ArrayExpression":
         return node.elements
            .map((element) => extractValue(element));
      case "ObjectProperty":
         return [extractValue(node.key), extractValue(node.value)]
      case "ObjectExpression":
         return node.properties
            .map(prop => extractValue(prop))
            .reduce((acc, [key, value]) => {
               acc[key] = value;
               return acc;
            }, {});
      case "BinaryExpression":
         const leftValue = extractValue(node.left);
         const rightValue = extractValue(node.right);
         let result;

         switch (node.operator) {
            case "+":
               result = leftValue + rightValue;
               break;
            case "-":
               result = leftValue - rightValue;
               break;
            case "*":
               result = leftValue * rightValue;
               break;
            case "/":
               result = leftValue / rightValue;
               break;
         }

         return result;
      case "Identifier":
         return node.name;
      default:
         console.error("[vite-plugin-vue-wpshortcodes] Unhandled AST node", node.type);
         return null;
   }
}

export default function wordPressShortCodeGen() {
   const isMain = createFilter("src/main.ts");

   const componentsDir = resolve(__dirname, "../src/components");
   let components = {};

   return {
      name: "vite-plugin-vue-wpshortcodes",

      /**
       * Note:
       * Here we are inserting imports for all the components into src/main.ts
       * By doing that, we can export them to the global `_app_`,
       * which is what the generated PHP code uses to render a component.
       */
      async load(/**@type {string} */ id) {
         if (!isMain(id)) return;
         let code = await readFile(id.split("?")[0], "utf-8");

         // prettier-ignore
         const components = await readdir(componentsDir)
            .then(comps => comps.filter((c) => c.endsWith(".vue")))

         // prettier-ignore
         code = components
                  .map((c) => `import ${c.split(".")[0]} from "@/components/${c}";`)
                  .join("\n")
               + "\n\n" + code;

         code +=
            "\n\n" +
            `window._app_.components = { ${components
               .map((c) => c.split(".")[0])
               .join(", ")} }`;

         return { code };
      },

      /**
       * Note:
       * Here we are using `@vue/compiler-sfc` to extract the script tag from each component.
       * Then we are using `@babel/core` and `@babel/parse` to get the AST of the script.
       * After that we are visiting each AST node until we encounter `defineProps()`,
       * once found we are parsing the AST of the props, to extract the details we need.
       */
      async buildStart() {
         // vite-dev might be re-using plugin instances, so we reset the components just in case
         components = {};

         for (const file of await readdir(componentsDir)) {
            if (!file.endsWith(".vue")) continue;

            let code = await readFile(resolve(componentsDir, file), "utf-8");
            const { descriptor, errors } = parseSFC(code, { filename: file });

            if (errors.length) continue;
            code = descriptor.scriptSetup.content;

            code = transform(code, {
               sourceType: "module",
               plugins: ["@babel/plugin-transform-typescript"],
            }).code;

            const ast = parseAst(code, { sourceType: "module" });

            let propsNode = null;
            astLoop: for (const node of ast.program.body) {
               if (node.type !== "VariableDeclaration") continue;
               for (const decl of node.declarations) {
                  if (
                     decl.type !== "VariableDeclarator" ||
                     decl.init.type !== "CallExpression" ||
                     decl.init.callee.type !== "Identifier" ||
                     decl.init.callee.name !== "defineProps"
                  )
                     continue;

                  propsNode = decl.init.arguments[0];
                  break astLoop;
               }
            }

            /**
             * TODO: Should we allow components without props?
             *       Although it can still be done, by simply using `defineProps({})`.
             */
            if (!propsNode) continue;
            components[file] = extractValue(propsNode);
         }
      },

      /**
       * Note:
       * Here we are using all the gathered props to generate PHP glue-code,
       * that allows us to use our components with WPBakery.
       */
      async buildEnd() {
         const out = resolve(__dirname, "../includes/Classes/ShortCodes");

         if (!await existsAsync(out)) await mkdir(out);
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
               .replace(
                  "{{AsIntUtil}}",
                  useIntUtil ? indent(AsIntUtil, 20) : "",
               )
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

const camelCaseToSnakeCase = (/**@type {String} */ str) =>
   str.replace(/(?<=[a-z0-9])([A-Z])/g, "_$1").toLowerCase();

const indent = (string, size) =>
   string
      .split("\n")
      .map((e) => " ".repeat(size) + e)
      .join("\n");

/// Templates

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
        add_shortcode('vc_myplugin_{{ComponentName}}', array($this, 'render_shortcode'));
    }

    public function create_shortcode()
    {
        // Stop all if VC is not enabled
        if (!defined('WPB_VC_VERSION')) { return; }

        vc_map(
            [
                'name' => '{{ComponentName}}',
                'base' => 'vc_myplugin_{{ComponentName}}',
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
                window._app_.with((create, { {{ComponentName}} }) => {\
{{AsIntUtil}}
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
