'use strict';
const fs = require('fs');
const process = require('process');
const program = require('commander');
const { ensureState, fetchImage, safeDeleteFail } = require('./lib/api');
const {
    imageApi, vmApi, diskApi, ipApi,
} = require('./lib/api');
const core = require('@actions/core');
const arp = require('./lib/arp');
const { loadConfig } = require('./lib/config');

const scope = (process.env.SCOPE || 'h1').toLowerCase();

const olderThan = (resource, ageInMinutes) => new Date(resource.createdOn) < new Date() - ageInMinutes * 60 * 1000;

const ensureTag = (resource, tag) => tag in resource.tag;

const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT;
const githubOutput = (key, value) => {
    if (!GITHUB_OUTPUT) {
        console.warn(`No GITHUB_OUTPUT set to write: ${key}=${value}`);
        return;
    }
    fs.appendFileSync(GITHUB_OUTPUT, `${key}=${value}\n`);
    console.log(`GITHUB_OUTPUT: ${key}=${value}`);
};

const config = {
    rbx: {
        scope: 'rbx',
        ssh: 'builder-ssh',
        vm_gen1_test_service: 'light',
        vm_builder_service: 'medium',
        disk_type: 'ssd',
        repository: 'https://packages.rootbox.cloud',
        cli_package: 'rbx-cli',
        scope_name: 'Rootbox',
        project: '5c603254a5e06e1eb55d87cb', //WDC hyperonecom/rbx-images-recommended
    },
    h1: {
        scope: 'h1',
        ssh: 'builder-ssh',
        vm_gen1_test_service: 'a1.nano',
        vm_gen2_test_service: '_dev.gen2_1',
        vm_builder_service: 'm2.medium',
        // network: '/networking/pl-waw-1/project/5c5d7eb1a5e06e1eb5532770/network/5f369246524bfe7720c4c384', //builder-private-network
        network: 'public',
        disk_type: 'ssd',
        repository: 'https://packages.hyperone.cloud',
        cli_package: 'h1-cli',
        scope_name: 'HyperOne',
        project: '5c5d7eb1a5e06e1eb5532770', //WDC hyperonecom/h1-images-recommended
    },
};
const platformConfig = config[scope];

const publishImage = async (imageId, project) => {
    console.log(`Publishing image: ${imageId}`);
    await imageApi.imagePostAccessrights(imageId, { identity: project });
    await imageApi.imagePatchTag(imageId, { published: 'true' });
};

const cleanupVm = async () => {
    console.log('Fetching available VMs');
    const vms = await vmApi.vmList();
    console.log(`Found ${vms.length} VMs`);
    const vm = vms.find(resource =>
        !ensureTag(resource, 'protected') && // ignore protected
        olderThan(resource, 40) && // ignore fresh (40 min grace period)
        (!resource.name.includes('windows') || olderThan(resource, 6 * 60)) && // extend fresh grace period for windows
        ensureState(resource, ['Running']) // manage only 'Running' eg. ignore 'Unknown'
    );
    if (vm) {
        console.log(`Deleting VM ${vm._id}`);
        await vmApi.vmActionTurnoff(vm._id).catch(safeDeleteFail);
        await vmApi.vmDelete(vm._id, {}).catch(safeDeleteFail);
        await cleanupVm();
    }
};

const cleanupImage = async () => {
    console.log('Fetching available images');
    const images = await imageApi.imageList();
    console.log(`Found ${images.length} images`);
    // identify for each image name latest image
    const latest_image = {};
    images.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
    for (const image of images) {
        // find latest published image
        if (!latest_image[image.name] && image.accessRights.includes('*')) {
            latest_image[image.name] = image;
        }
    }

    const image = images.find(resource =>
        !ensureTag(resource, 'protected') && // ignore protected
        olderThan(resource, 40) && // ignore fresh
        ensureState(resource, ['Online']) && // manage only 'Online'
        latest_image[resource.name] && latest_image[resource.name]._id !== resource._id // keep latest
    );
    if (image) {
        console.log(`Deleting image '${image.name}' (ID: ${image._id}).`);
        await imageApi.imageDelete(image._id).catch(safeDeleteFail);
        await cleanupImage();
    }
};

const cleanupDisk = async () => {
    console.log('Fetching available disks.');
    const disks = await diskApi.diskList();
    console.log(`Found ${disks.length} disks`);
    const disk = disks.find(resource =>
        olderThan(resource, 30) && // ignore fresh to avoid race
        ensureState(resource, ['Detached']) // manage only 'Detached' eg. ignore 'Unknown' and 'Attached'
    );
    if (disk) {
        console.log(`Deleting disk ${disk._id}`);
        await diskApi.diskDelete(disk._id).catch(safeDeleteFail);
        await cleanupDisk();
    }
};

const cleanupIp = async () => {
    console.log('Fetching available IP.');
    const ips = await ipApi.ipList();
    console.log(`Found ${ips.length} IPs`);
    const ip = ips.find(resource =>
        olderThan(resource, 5) && // ignore fresh to avoid race
        ensureState(resource, ['Unallocated']) // manage only 'Detached' eg. ignore 'Unknown' and 'Attached'
    );
    if (ip) {
        console.log(`Deleting IP ${ip._id}`);
        await ipApi.ipDelete(ip._id).catch(safeDeleteFail);
        await cleanupIp();
    }
};

const groupWithStatus = (name, fn) => core.group(name, async () => {
    const start = Date.now();
    try {
        await fn();
        console.log(`${name}: pass in ${(Date.now() - start) / 1000} seconds`);
    } catch (err) {
        console.log(`${name}: failed in ${(Date.now() - start) / 1000} seconds`);
        core.setFailed(err.message);
        throw err;
    }
});

const main = async () => {
    program
        .version('0.1.0')
        .option('-c, --config <config>', 'Input config file')
        .option('-i, --image <imageId>', 'Image ID (skip build if present)')
        .option('--skip-test', 'Skip tests of image')
        .option('-p, --publish', 'Publish image')
        .option('--cleanup', 'Perform cleanup of old resources')
        .option('--mode <mode>', 'Mode of build images', /^(packer|windows)$/i)
        .option('--project <project>', 'Project for resources, override config')
        .option('--on-error <onError>', 'Action on error', /^(cleanup|abort|ask|run-cleanup-provisioner)$/i)
        .parse(process.argv);
    const options = program.opts();
    if (!options.config) {
        program.help();
    }
    if (options.project) {
        platformConfig.project = options.project;
    }
    platformConfig.onError = options.onError || 'cleanup';

    try {
        const imageConfig = await loadConfig(options.config);
        const mode = options.mode || imageConfig.mode;
        const mode_runtime = require(`./lib/build_modes/${mode}.js`);
        let imageId;

        await groupWithStatus('Clean ARP before build', () => arp.clean());
        await groupWithStatus('Build image', async () => {
            if (options.image) {
                imageId = options.image;
                console.log(`Choose image: ${imageId}`);
                return;
            }
            imageId = await mode_runtime.build(imageConfig, platformConfig, scope);
            console.log(`Builded image: ${imageId}`);
            // important for GitHub Actions to be able to pass IMAGE & PROJECT to next steps (eg. tests, publish)
            githubOutput('IMAGE', imageId);
            githubOutput('PROJECT', platformConfig.project);
            githubOutput('UEFI', imageConfig.uefi_support);
        });

        await groupWithStatus('Clean ARP before test', () => arp.clean());
        await groupWithStatus(`Test image ${imageId}`, async () => {
            if (options.skipTest) {
                console.log('Skip testing image');
                return;
            }
            try {
                await mode_runtime.test(imageConfig, platformConfig, imageId, scope);
            } catch (err) {
                if (options.cleanup) {
                    console.log(`Delete invalid image: ${imageId}`);
                    await imageApi.imageDelete(imageId).catch(safeDeleteFail);
                }
                throw err;
            }
        });

        await groupWithStatus(`Publish image ${imageId}`, async () => {
            if (!options.publish) {
                console.log(`Skip publishing image: ${imageId}`);
                return;
            }
            if (imageConfig.license) {
                const image = await fetchImage(imageId);
                if (!image.license || image.license.length === 0) {
                    throw new Error('Image not ready to publish - no licenses required');
                }
            }
            await publishImage(imageId, imageConfig.image_tenant_access || '*');
        });

    } finally {
        await groupWithStatus('Cleanup', async () => {
            if (options.cleanup) {
                await cleanupImage(); // clean up all images
                await cleanupVm(); // delete VM first to make disk and ip free
                await cleanupDisk(); // delete detached disks
                await cleanupIp(); // delete detached IP address
            }
        });
    }
};

main().then(console.log).catch(err => {
    console.error(err);
    console.error(err.stack);
    process.exit(1);
});
