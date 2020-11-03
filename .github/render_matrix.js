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

const renderMatrix = async (name) => {
    const path = join(__dirname, './../config', name);
    const files = await readDir(path);
    const templates = {};

    for (const template of files.filter(x => x.endsWith('.yaml'))) {
        if(!template.includes('alpine-3.12-docker.yaml')) continue;
        templates[`./config/packer/${template}`] = yaml.safeLoad(await readFile(join(path, template)));
    }
    if (process.argv.includes('--github')) {
        console.log(`::set-output name=matrix-${name}::${JSON.stringify(render(templates))}`);
    } else {
        console.log(JSON.stringify(render(templates), null, 4));
    }
}
const main = async () => {
    await renderMatrix('packer');
    await renderMatrix('windows');
};

main().then(console.log).catch(err => {
    console.error(err);
    process.exit(-1);
});
