'use strict';
const fs = require('fs');
const util = require('util');
const execFile = util.promisify(require('child_process').execFile);
const { join } = require('path');
const readDir = fs.promises.readdir;
const readFile = fs.promises.readFile;
const yaml = require('js-yaml');

const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT;
const DIFF_MODE = process.argv.includes('--diff');
const FAMILIES = ['alpine', 'centos', 'debian', 'rhel', 'ubuntu', 'fedora', 'freebsd', 'windows'];

const hasChanged = async (paths) => {
    try {
        // Compare committed to master
        await execFile('git', [
            'diff',
            '--quiet',
            'master',
            'HEAD',
            '--',
            ...paths,
        ]);
        // Compare uncommitted to HEAD
        await execFile('git', [
            'diff-index',
            '--quiet',
            'HEAD',
            '--',
            ...paths
        ]);
        return false;
    } catch (err) {
        console.log(err);
        return true;
    }
}

const scope_list = ['h1', 'rbx'];

const render = (templates) => {
    const include = [];

    for (const [template, config] of Object
        .entries(templates)
        .sort(([, a], [, b]) => (a.priority || 50) > (b.priority || 50))
    ) {
        const scopes = config.scope || scope_list;
        for (const scope of scopes) {
            if (scope !== 'h1') continue; //temporary, until the full flow is working
            include.push({
                name: config.name,
                config: template,
                scope,
            });
        }
    }

    return {
        include,
    };
};

const renderMatrix = async (name, touched) => {
    const path = join(__dirname, './../config', name);
    const files = await readDir(path);
    const templates = {};

    for (const templateFile of files
        .reverse()
        .filter(x =>
            x.endsWith('.yaml') &&
            touched.some(y => x.startsWith(y))
        )
    ) {
        const config = yaml.load(await readFile(join(path, templateFile)));
        if(config.build) {
            templates[`./config/${name}/${templateFile}`] = config;
        }
    }

    const out = render(templates);

    if (GITHUB_OUTPUT) {
        fs.appendFileSync(GITHUB_OUTPUT, `matrix-${name}=${JSON.stringify(out)}`);
    } else {
        console.log(out);
    }
}
const main = async () => {
    const touched = [];

    for (const family of FAMILIES) {
        let status = true;
        if (DIFF_MODE) {
            status = await hasChanged([
                `./config/*/${family}-*`,
                `./templates/*/${family}-*`,
                `./scripts/${family}/*`,
                './.github/**',
                './resources/**',
                `./tests/**`,
                './Dockerfile*',
            ]);
        }
        if (status) {
            touched.push(family);
        }
    };
    console.log('Families accepted:', touched);

    await renderMatrix('packer', touched);
    await renderMatrix('windows', touched);
};

main().catch(err => {
    console.error(err);
    process.exit(-1);
});
