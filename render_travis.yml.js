const fs = require('fs');
const util = require('util');
const {join} = require('path');
const readDir = util.promisify(fs.readdir);
const writeFile = util.promisify(fs.writeFile);
const yaml = require('js-yaml');

const readFile = util.promisify(fs.readFile);

const scope_list = ['H1', 'RBX'];

const buildEnv = templates => [].concat(
    ...scope_list.map(scope =>
        templates.map(template => `CONFIG="${template}" MODE="packer" SCOPE=${scope}`)
    )
);

const templateByStage = (templates, test) => Object.entries(templates)
    .filter(([, config]) => test(config))
    .map(([template]) => {
        console.log({template});
        return template
    });

const render = templates => ({
    language: "nodejs",
    jobs: {
        include: [
            {
                stage: "basic",
                env: buildEnv([
                    'templates/builder-fedora.json'
                ])
            },
            {
                stage: "primary",
                env: buildEnv(templateByStage(templates, config => config.stage !== 'secondary'))
            },
            {
                stage: "apps",
                env: buildEnv(templateByStage(templates, config => config.stage === 'secondary'))
            }
        ]
    },
    script: [
        'travis_retry ./buildTravis.sh',
    ],
    before_install: [
        './installTravis.sh "$ENCRYPT_KEY"'
    ]
});

const main = async () => {
    const path = join('./config/packer');
    const files = await readDir(path);
    const templates = {};
    for (const template of files.filter(x => x.endsWith('.yaml')).map(file => join(path, file))) {
        templates[template] = await readFile(template);
    }
    const output_content = yaml.safeDump(render(templates), null, 4);
    await writeFile('./.travis.yml', output_content);
};
main().then(console.log).catch(console.error);
