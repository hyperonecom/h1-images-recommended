'use strict';
const yaml = require('js-yaml');
const fs = require('fs');
const util = require('util');
const process = require('process');
const program = require('commander');
const { ensureState, fetchImage } = require('./lib/api');
const { qcow } = require('./lib/naming');
const {
    imageApi, vmApi, diskApi, ipApi,
} = require('./lib/api');

const scope = (process.env.SCOPE || 'h1').toLowerCase();

const readFile = util.promisify(fs.readFile);

const olderThan = (resource, ageInMinutes) => new Date(resource.createdOn) < new Date() - ageInMinutes * 60 * 1000;

const ensureTag = (resource, tag) => tag in resource.tag;

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

const cleanupVm = async () => {
    console.log('Fetching available VMs');
    const vms = await vmApi.vmList();
    console.log(`Found ${vms.length} VMs`);
    const vm = vms.find(resource =>
        !ensureTag(resource, 'protected') && // ignore protected
        olderThan(resource, 40) && // ignore fresh
        !resource.name.includes('windows') && // ignore windows
        ensureState(resource, ['Running']) // manage only 'Running' eg. ignore 'Unknown'
    );
    if (vm) {
        console.log(`Deleting VM ${vm.id}`);
        await vmApi.vmActionTurnoff(vm.id);
        await vmApi.vmDelete(vm.id, {});
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
        if (!latest_image[image.name] && image.accessRights.includes('*')) {
            latest_image[image.name] = image;
        }
    }
    const image = images.find(resource =>
        !ensureTag(resource, 'protected') && // ignore protected
        olderThan(resource, 40) && // ignore fresh
        ensureState(resource, ['Online']) && // manage only 'Online'
        latest_image[resource.name] && latest_image[resource.name].id !== resource.id // keep latest
    );
    if (image) {
        console.log(`Deleting image '${image.name}' (ID: ${image.id}).`);
        await imageApi.imageDelete(image.id);
        await cleanupImage();
    }
};

const cleanupDisk = async () => {
    console.log('Fetching available disks.');
    const disks = await diskApi.diskList();
    console.log(`Found ${disks.length} disks`);
    const disk = disks.find(resource =>
        olderThan(resource, 15) && // ignore fresh to avoid race
        ensureState(resource, ['Detached']) // manage only 'Detached' eg. ignore 'Unknown' and 'Attached'
    );
    if (disk) {
        console.log(`Deleting disk ${disk.id}`);
        await diskApi.diskDelete(disk.id);
        await cleanupDisk();
    }
};

const cleanupIp = async () => {
    console.log('Fetching available IP.');
    const ips = await ipApi.ipList();
    console.log(`Found ${ips.length} IPs`);
    const ip = ips.find(resource =>
        olderThan(resource, 15) && // ignore fresh to avoid race
        ensureState(resource, ['Unallocated']) // manage only 'Detached' eg. ignore 'Unknown' and 'Attached'
    );
    if (ip) {
        console.log(`Deleting IP ${ip.id}`);
        await ipApi.ipDelete(ip.id);
        await cleanupIp();
    }
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
    if (!program.config) {
        program.help();
    }
    try {
        const input_file = program.config;
        const content = await readFile(input_file);
        const imageConfig = yaml.safeLoad(content);
        const mode = program.mode || imageConfig.mode || 'packer';
        const mode_runtime = require(`./lib/build_modes/${mode}.js`);
        imageConfig.template_file = imageConfig.template_file || `templates/qcow/${qcow(imageConfig)}`;
        let imageId;
        if (!program.image) {
            imageId = await mode_runtime.build(imageConfig, platformConfig);
            console.log(`Builded image: ${imageId}`);
        } else {
            imageId = program.image;
            console.log(`Choose image: ${imageId}`);
        }
        if (!program.skipTest) {
            console.log(`Testing image: ${imageId}`);
            try {
                await mode_runtime.test(imageConfig, platformConfig, imageId);
            } catch (err) {
                if (program.cleanup) {
                    console.log(`Delete invalid image: ${imageId}`);
                    await imageApi.imageDelete(imageId);
                }
                throw err;
            }
            console.log(`Tested image: ${imageId}`);
        } else {
            console.log(`Skip testing image: ${imageId}`);
        }
        if (program.publish) {
            if (imageConfig.license) {
                const image = await fetchImage(imageId);
                if (!image.license || image.license.length == 0) {
                    throw new Error('Image not ready to publish - no licenses required');
                }
            }
            console.log(`Publishing image: ${imageId}`);
            await publishImage(imageId, imageConfig.image_tenant_access || '*');
            console.log(`Published image: ${imageId}`);
        } else {
            console.log(`Skip publishing image: ${imageId}`);
        }
    } finally {
        if (program.cleanup) {
            await cleanupImage(); // clean up all images
            await cleanupVm(); // delete VM first to make disk and ip free
            await cleanupDisk(); // delete detached disks
            await cleanupIp(); // delete detached IP address
        }
    }
};

main().then(console.log).catch(err => {
    console.error(err);
    console.error(err.stack);
    process.exit(1);
});
