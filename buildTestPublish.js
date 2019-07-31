'use strict';
const yaml = require('js-yaml');
const fs = require('fs');
const util = require('util');
const process = require('process');
const program = require('commander');
const {ensureState} = require('./lib/api');
const {qcow} = require('./lib/naming');
const {
    imageApi, vmApi, diskApi, ipApi
} = require('./lib/api');

const scope = (process.env.SCOPE || 'h1').toLowerCase();

const readFile = util.promisify(fs.readFile);

const olderThan = (resource, ageInMinutes) => new Date(resource.createdOn) < (new Date() - ageInMinutes * 60 * 1000);

const config = {
    rbx: {
        scope: 'rbx',
        ssh: 'builder-ssh',
        netadp_service: '5899b0f8d44c81202ab51308',
        vm_test_service: 'light',
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
        vm_test_service: 'a1.nano',
        vm_builder_service: 'a1.small',
        network: 'builder-private-network',
        disk_type: 'ssd',
        repository: 'https://packages.hyperone.cloud',
        cli_package: 'h1-cli',
        scope_name: 'HyperOne',
    }
};
const platformConfig=config[scope];

const publishImage = (imageId, project) => {
    console.log(`Publishing image ${imageId}.`);
    return imageApi.imagePostAccessrights(imageId, ({identity: project}));
};

const cleanupImage = async () => {
    console.log("Fetching available images");
    const images = await imageApi.imageList();
    console.log(`Found ${images.length} images`);
    const keep_images = {};
    images.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
    for (const image of images) {
        if (!keep_images[image.name] && (image.accessRights.includes('*') || image.name.includes('image-builder'))) {
            keep_images[image.name] = image;
        }
    }
    const image = images.find(x => x.state === 'Online' && keep_images[x.name] && keep_images[x.name]._id !== x._id && olderThan(x, 90));
    if (image) {
        console.log(`Deleting image '${image.name}' (ID: ${image._id}).`);
        await imageApi.imageDelete(image._id);
        await cleanupImage();
    }
};

const cleanupVm = async () => {
    console.log("Fetching available VMs");
    const vms = await vmApi.vmList();
    console.log(`Found ${vms.length} VMs`);
    const vm = vms.find(vm => olderThan(vm, 90) && ensureState(vm, ['Running']) && !vm.name.includes('windows'));
    if (vm) {
        console.log(`Deleting VM ${vm._id}`);
        await vmApi.vmActionTurnoff(vm._id);
        await vmApi.vmDelete(vm._id, {});
        await cleanupVm();
    }
};

const cleanupDisk = async () => {
    console.log("Fetching available disks.");
    const disks = await diskApi.diskList();
    console.log(`Found ${disks.length} disks`);
    const disk = disks.find(disk => ensureState(disk, ['Detached']));
    if (disk) {
        console.log(`Deleting disk ${disk._id}`);
        await diskApi.diskDelete(disk._id);
        await cleanupDisk();
    }
};

const cleanupIp = async () => {
    console.log("Fetching available ip.");
    const ips = await ipApi.ipList();
    console.log(`Found ${ips.length} ips`);
    const ip = ips.find(ip => ensureState(ip, ['Unallocated']));
    if (ip) {
        console.log(`Deleting ip ${ip._id}`);
        await ipApi.ipDelete(ip._id);
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
        if(!program.config){
            program.help()
        }
    try {
        const input_file = program.config;
        const content = await readFile(input_file);
        const imageConfig = yaml.safeLoad(content);
        const mode = program.mode || imageConfig.mode || 'packer';
        const mode_runtime = require(`./lib/build_modes/${mode}.js`);
        imageConfig.template_file = imageConfig.template_file || `templates/qcow/${qcow(imageConfig)}`;
        let imageId;
        if(!program.image) {
            imageId = await mode_runtime.build(imageConfig, platformConfig);
        }else{
            imageId = program.image;
        }
        if(!program.skipTest){
            await  await mode_runtime.test(imageConfig, platformConfig, imageId);
        }
        if(program.publish) {
            await publishImage(imageId, imageConfig.image_tenant_access || '*');
        }
    } finally {
        if(program.cleanup) {
            await cleanupImage();
            await cleanupVm();
            await cleanupDisk();
            await cleanupIp();
        }
    }
};

main().then(console.log).catch(err => {
    console.error(err);
    console.error(err.stack);
    process.exit(1);
});
