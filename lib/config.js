'use strict';

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const { qcow } = require('./naming');

const readDir = fs.promises.readdir;
const readFile = fs.promises.readFile;

const FAMILY = ['windows', 'packer'];

const listConfig = async (families) => {
    const image = [];

    for (const family of families || FAMILY) {
        const family_dir = path.join(__dirname, '../config', family);
        for (const fname of await readDir(family_dir)) {
            image.push({
                uefi_support: false,
                cli_support: false,
                ...await loadConfig(path.join(family_dir, fname)),
            });
        }
    }
    return image;
};

const loadConfig = async (input_file) => {
    const content = await readFile(input_file);
    const imageConfig = yaml.safeLoad(content);
    imageConfig.template_file = imageConfig.template_file || `templates/qcow/${qcow(imageConfig)}`;
    imageConfig.mode = imageConfig.mode || 'packer';
    return imageConfig;

};

module.exports = {
    listConfig,
    loadConfig,
};
