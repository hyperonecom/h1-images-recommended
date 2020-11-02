'use strict';
const fs = require('fs');
const { join } = require('path');
const readDir = fs.promises.readdir;
const readFile = fs.promises.readFile;
const yaml = require('js-yaml');

const scope_list = ['h1', 'rbx'];

const render = (templates) => {
    const include = [];

    for (const [template, config] of Object.entries(templates)) {
        const scopes = config.scope || scope_list;
        for (const scope of scopes) {
            include.push({
                config: template,
                scope,
            });
        }
    }

    return {
        include,
    };
};

const main = async () => {
    const path = join('./config/packer');
    const files = await readDir(path);
    const templates = {};
    for (const template of files.filter(x => x.endsWith('.yaml')).map(file => join(path, file))) {
        templates[template] = yaml.safeLoad(await readFile(template));
    }
    if (process.argv.includes('--github')) {
        console.log(`::set-output name=matrix::${JSON.stringify(render(templates))}`);
    } else {
        console.log(JSON.stringify(render(templates), null, 4));
    }
};
main().then(console.log).catch(console.error);
