'use strict';
const fs = require('fs');
const util = require('util');
const execFile = util.promisify(require('child_process').execFile);
const { join } = require('path');
const readDir = fs.promises.readdir;
const readFile = fs.promises.readFile;
const yaml = require('js-yaml');

const GITHUB_OUTPUT = process.argv.includes('--github');
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
        ])
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

const renderMatrix = async (name, touched) => {
    const path = join(__dirname, './../config', name);
    const files = await readDir(path);
    const templates = {};

    for (const template of files
        .reverse()
        .filter(x =>
            x.endsWith('.yaml') &&
            touched.some(y => x.startsWith(y))
        )
    ) {
        templates[`./config/${name}/${template}`] = yaml.safeLoad(await readFile(join(path, template)));
    }
    if (GITHUB_OUTPUT) {
        console.log(`::set-output name=matrix-${name}::${JSON.stringify(render(templates))}`);
    } else {
        console.log(JSON.stringify(render(templates), null, 4));
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
                `./tests/**`
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
