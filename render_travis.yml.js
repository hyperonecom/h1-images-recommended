const fs = require('fs');
const util = require('util');
const {join} = require('path');
const readDir = util.promisify(fs.readdir);
const writeFile = util.promisify(fs.writeFile);
const yaml = require('js-yaml');

const render = templates => ({
    language: "nodejs",
    env: templates.map(template => `TEMPLATE="${template}"`),
    script: [
        './buildTravis.sh',
    ],
    addons: {apt: {packages: ['docker']}}
});


const main = async () => {
    const path = './templates/qcow';
    const files = await readDir(path);
    const templates = files.filter(x => x.endsWith('.json')).map(file => join(path, file));
    const template = render(templates);
    const output_content = yaml.safeDump(template, null, 4);
    await writeFile('./.travis.yml', output_content);
};
main().then(console.log).catch(console.error);
