'use strict';

const { listRecommendedImage } = require('./lib/api');
const { listConfig } = require('./lib/config');

const main = async () => {
    const published = await listRecommendedImage().then(images => images.filter(x => x.tag && x.tag.published).map(x => x.name));
    const configs = await listConfig();
    const available = configs.map(image => image.pname);
    // const available = await imageApi.imageList()
    console.log('Published & available:', published.filter(x => available.includes(x)));
    console.log('Published-only:', published.filter(x => !available.includes(x)));
    console.log('Available-only:', available.filter(x => !published.includes(x)));
    console.log('UEFI exclusion:', configs.filter(x => !x.uefi_support).map(x => x.pname));
    console.log('CLI exclusion:', configs.filter(x => !x.cli_support).map(x => x.pname));
    console.log('Repology exclusion:', configs.filter(x => !x.repology_repo).map(x => x.pname));
};

main().catch(err => {
    console.error(err);
    console.error(err.stack);
    process.exit(-1);
});
