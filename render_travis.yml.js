'use strict';
const fs = require('fs');
const util = require('util');
const {join} = require('path');
const readDir = util.promisify(fs.readdir);
const writeFile = util.promisify(fs.writeFile);
const yaml = require('js-yaml');

const readFile = util.promisify(fs.readFile);

const scope_list = ['H1', 'RBX'];

const templateByStage = (templates, test) => {
    const stages = [];

    for (const [template, config] of Object.entries(templates)) {
        if (!test(config)) {
            continue;
        }
        const scopes = config.scope || scope_list;
        for (const scope of scopes) {
            stages.push({
                stage: config.stage || 'primary',
                env:`CONFIG="${template}" MODE="packer" SCOPE=${scope}`,
            });
        }
    }
    return stages;
};

const render = templates => ({
    services: ['docker'],
    language: 'minimal',
    dist: 'xenial',
    jobs: {
        include: [
            ...templateByStage(templates, config => !config.stage || config.stage === 'primary'),
            ...templateByStage(templates, config => config.stage === 'secondary'),
            ...templateByStage(templates, config => config.stage === 'apps'),
        ],
    },
    script: [
        './buildTravis.sh',
    ],
    before_install: [
        './installTravis.sh "$ENCRYPT_KEY"',
    ],
});

const main = async () => {
    const path = join('./config/packer');
    const files = await readDir(path);
    const templates = {};
    for (const template of files.filter(x => x.endsWith('.yaml')).map(file => join(path, file))) {
        templates[template] = yaml.safeLoad(await readFile(template));
    }
    const output_content = yaml.safeDump(render(templates), null, 4);
    await writeFile('./.travis.yml', output_content);
};
main().then(console.log).catch(console.error);
