'use strict';

const fs = require('fs');

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

const repos = [
    'alpine_edge',
    'alpine_3_12',
    'centos_7',
    'centos_8',
    'debian_stable',
    'debian_oldstable',
    'debian_testing',
    'debian_unstable',
    'fedora_30',
    'fedora_31',
    'fedora_32',
    'fedora_rawhide',
    'freebsd',
    'ubuntu_16_04',
    'ubuntu_18_04',
    'ubuntu_20_04',
    'ubuntu_20_10',
];

const latest = (pkg) => `[![latest packaged version(s)](https://repology.org/badge/latest-versions/${pkg}.svg?header=)](https://repology.org/project/${pkg}/versions)`;

const badge = (repo, pkg) => `[![${repo} package](https://repology.org/badge/version-for-repo/${repo}/${pkg}.svg?header=)](https://repology.org/project/${pkg}/versions)`;

const main = async () => {
    const content = ['# Packages versions for distros\n'];

    const header = ['-', ...packages];
    const rows = [];

    rows.push([
        'latest',
        ...packages.map(pkg => latest(pkg)),
    ]);

    for (const repo of repos) {
        rows.push([
            repo,
            ...packages.map(pkg => badge(repo, pkg)),
        ]);
    }

    content.push(header.join(' | '));
    content.push(header.map(() => '---').join(' | '));
    for (const row of rows) {
        content.push(row.join(' | '));
    }
    await fs.promises.writeFile('./packages.md', content.join('\n'));
};
main().then(console.log).catch(console.error);
