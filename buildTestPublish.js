'use strict';
const yaml = require('js-yaml');
const fs = require('fs');
const process = require('process');
const program = require('commander');
const { qcow } = require('./lib/naming');
const {
    imageApi, safeDeleteFail, fetchImage,
} = require('./lib/api');
const core = require('@actions/core');

const scope = (process.env.SCOPE || 'h1').toLowerCase();

const config = {
    rbx: {
        scope: 'rbx',
        ssh: 'builder-ssh',
        netadp_service: '5899b0f8d44c81202ab51308',
        vm_gen1_test_service: 'light',
        vm_builder_service: 'medium',
        disk_type: 'ssd',
        repository: 'https://packages.rootbox.cloud',
        cli_package: 'rbx-cli',
        scope_name: 'Rootbox',
    },
    h1: {
        scope: 'h1',
        ssh: 'builder-ssh',
        netadp_service: '561e7e30a8cfd461e469ad18',
        vm_gen1_test_service: 'a1.nano',
        vm_gen2_test_service: '_dev.gen2_1',
        vm_builder_service: 'a1.small',
        network: 'builder-private-network',
        disk_type: 'ssd',
        repository: 'https://packages.hyperone.cloud',
        cli_package: 'h1-cli',
        scope_name: 'HyperOne',
    },
};
const platformConfig = config[scope];

const publishImage = async (imageId, project) => {
    console.log(`Publishing image: ${imageId}`);
    await imageApi.imagePostAccessrights(imageId, { identity: project });
    await imageApi.imagePatchTag(imageId, { published: 'true' });
};

const main = async () => {
    program
        .version('0.1.0')
        .option('-c, --config <config>', 'Input config file')
        .option('-i, --image <imageId>', 'Image ID (skip build if present)')
        .option('--skip-test', 'Skip tests of image')
        .option('-p, --publish', 'Publish image')
        .option('--cleanup', 'Perform cleanup of old resources')
        .option('--mode <mode>', 'Mode of build images', /^(packer|windows)$/i)
        .parse(process.argv);

    const input_file = program.config;
    const content = await fs.promises.readFile(input_file);
    const imageConfig = yaml.safeLoad(content);
    const mode = program.mode || imageConfig.mode || 'packer';
    const mode_runtime = require(`./lib/build_modes/${mode}.js`);
    imageConfig.template_file = imageConfig.template_file || `templates/qcow/${qcow(imageConfig)}`;
    let imageId;

    await core.group('Build image', async () => {
        if (program.image) {
            imageId = program.image;
            console.log(`Choose image: ${imageId}`);
            return;
        }
        imageId = await mode_runtime.build(imageConfig, platformConfig, scope);
        console.log(`Builded image: ${imageId}`);
    });

    await core.group(`Test image ${imageId}`, async () => {
        if (program.skipTest) {
            console.log('Skip testing image');
            return;
        }
        try {
            await mode_runtime.test(imageConfig, platformConfig, imageId, scope);
        } catch (err) {
            if (program.cleanup) {
                console.log(`Delete invalid image: ${imageId}`);
                await imageApi.imageDelete(imageId).catch(safeDeleteFail);
            }
            throw err;
        }
    });

    await core.group(`Publish image ${imageId}`, async () => {
        if (!program.publish) {
            console.log(`Skip publishing image: ${imageId}`);
            return;
        }
        if (imageConfig.license) {
            const image = await fetchImage(imageId);
            if (!image.license || image.license.length == 0) {
                throw new Error('Image not ready to publish - no licenses required');
            }
        }
        await publishImage(imageId, imageConfig.image_tenant_access || '*');
    });
};

main().then(console.log).catch(err => {
    console.error(err);
    console.error(err.stack);
    process.exit(1);
});
