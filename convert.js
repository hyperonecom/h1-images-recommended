#!/bin/node
const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const readDir = util.promisify(fs.readdir);
const writeFile = util.promisify(fs.writeFile);
const {join} = require('path');
const yaml = require('js-yaml');
const unquote = text => text.trim().replace(/"(.+?)"/, '$1');

const load_config = async (file) => {
    const content = await readFile(file, {encoding: 'utf-8'});
    const lines = content.split("\n");
    const config = {};
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().length === 0) {
            continue;
        }
        const match_num = lines[i].match('^([A-Z_]+)=([0-9]+?|".+?")$');
        if (match_num) {
            config[match_num[1].toLowerCase()] = unquote(match_num[2]);
            continue;
        }
        const match_multiline = lines[i].match('^([A-Z_]+)=\\(');
        if (match_multiline) {
            const elements = [];
            i += 1;
            while (lines[i].trim() !== ')') {
                elements.push(unquote(lines[i]));
                i += 1;
            }
            config[match_multiline[1].toLowerCase()] = elements;
            continue;
        }
        throw new Error(`Failed to parse line:${lines[i]}`);
    }
    return config;
};
const main = async() => {
    const path = '../config/images/';
    const files = await readDir(path);
    for(const file of files.filter(x => x.endsWith('.cfg'))){
        const config = await load_config(join(path, file));
        const content = yaml.safeDump(config);
        await writeFile(join('./config/qcow', `${file.split('.')[0]}.yaml`), content);
    }
};
main().then(console.log).catch(console.error);
