'use strict';

const { listRecommendedImage } = require('./lib/api');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const readDir = fs.promises.readdir;
const readFile = fs.promises.readFile;

const FAMILY = ['windows', 'packer'];

const listAvailable = async () => {
    const image = [];

    for (const family of FAMILY) {
        const family_dir = path.join(__dirname, 'config', family);
        for (const fname of await readDir(family_dir)) {
            const content = await readFile(path.join(family_dir, fname), { encoding: 'utf-8' });
            const imageConfig = yaml.safeLoad(content);
            image.push(imageConfig);
        }
    }
    return image;
};

const main = async () => {
    const published = await listRecommendedImage().then(images => images.filter(x => x.tag && x.tag.published).map(x => x.name));
    const available = await listAvailable().then(images => images.map(image => image.pname));
    // const available = await imageApi.imageList()
    console.log('Published & available:', published.filter(x => available.includes(x)));
    console.log('Published-only:', published.filter(x => !available.includes(x)));
    console.log('Available-only:', available.filter(x => !published.includes(x)));
};

main().catch(err => {
    console.error(err);
    console.error(err.stack);
    process.exit(-1);
});
