'use strict';

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const { qcow } = require('./naming');

const openDir = fs.promises.opendir;
const readFile = fs.promises.readFile;

const FAMILY = ['windows', 'packer'];

const listConfig = async (families) => {
    const image = [];

    for (const family of families || FAMILY) {
        const family_dir = path.join(__dirname, '../config', family);
        for await (const dirent of await openDir(family_dir)) {
            image.push(await loadConfig(path.join(family_dir, dirent.name)));
        }
    }
    return image;
};

const loadConfig = async (input_file) => {
    const content = await readFile(input_file);
    const imageConfig = yaml.load(content);
    return {
        uefi_support: false,
        cli_support: false,
        mode: 'packer',
        template_file: `templates/qcow/${qcow(imageConfig)}`,
        ...imageConfig,
    };

};

module.exports = {
    listConfig,
    loadConfig,
};
