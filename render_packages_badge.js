'use strict';

const fs = require('fs');
const { listConfig } = require('./lib/config');
const packages = [
    'cloud-init',
    'chrony',
    'openntpd',
    'bash',
    'curl',
    'openssh',
    'nano',
    'grep',
    'python',
    'h1-cli',
    'php',
    'ruby',
    'go',
    'nodejs',
    'systemd',
    'rsyslog',
    'docker',
];

const latest = (pkg) => `[![latest packaged version(s) of ${pkg}](https://repology.org/badge/latest-versions/${pkg}.svg?header=)](https://repology.org/project/${pkg}/versions)`;

const badge = (repo, pkg) => `[![${repo} package of ${pkg}](https://repology.org/badge/version-for-repo/${repo}/${pkg}.svg?header=)](https://repology.org/project/${pkg}/versions)`;

const toRow = (cells) => `${cells.map(x => `| ${x} `).join('')} |`;

const main = async () => {
    const content = ['# Packages versions for distros\n'];

    const header = ['-', ...packages];
    const rows = [];

    rows.push([
        'latest',
        ...packages.map(pkg => latest(pkg)),
    ]);

    const repos = [];
    for (const image of await listConfig()) {
        if (!image.repology_repo) {
            console.log(`Missing 'repology_repo' in '${image.pname}'`);
            continue;
        }
        if (repos.includes(image.repology_repo)) continue;
        repos.push(image.repology_repo);
    }
    for (const repo of repos) {
        rows.push([
            repo,
            ...packages.map(pkg => badge(repo, pkg)),
        ]);
    }

    content.push(toRow(header));
    content.push(toRow(header.map(() => '---')));
    for (const row of rows) {
        content.push(toRow(row));
    }
    await fs.promises.writeFile('./packages.md', content.join('\n'));
};
main().then(console.log).catch(console.error);
