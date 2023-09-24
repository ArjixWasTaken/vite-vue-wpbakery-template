// @ts-check

const { resolve } = require('path');
const { readFileSync, writeFileSync } = require('fs');

const isDev = process.argv.includes('--dev');

const pack = require('../package.json');
const phpFile = resolve(__dirname, '..', 'index.php');

let code = readFileSync(phpFile, 'utf8');

const regex = /define\((['\"])(\w+)\1,.*?\);/g;

for (const [match, __, name] of code.matchAll(regex)) {
    switch (name) {
        case "WPM_DEVELOPMENT": {
            code = code.replace(match, `define('WPM_DEVELOPMENT', '${isDev ? 'yes' : 'no'}');`);
            break;
        }
        case "WPM_VERSION": {
            code = code.replace(match, `define('WPM_VERSION', '${pack.version}');`);
            break;
        }
    }
}

writeFileSync(phpFile, code, 'utf8');
