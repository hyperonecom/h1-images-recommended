const fs = require('fs');
const util = require('util');
const {join} = require('path');
const readDir = util.promisify(fs.readdir);
const writeFile = util.promisify(fs.writeFile);
const yaml = require('js-yaml');


const updateDocker = [
    'curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -',
    'sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"',
    'sudo apt-get update',
    'sudo apt-get -y install docker-ce'
];

const render = templates => ({
    language: "nodejs",
    env: templates.map(template => `TEMPLATE="${template}"`),
    script: [
        'source ./buildTravis.sh',
    ],
    before_install: [
        'openssl aes-256-cbc -k "$ENCRYPT_KEY" -in ./resources/secrets/id_rsa.enc -out ./resources/secrets/id_rsa -d;',
        ...updateDocker
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
