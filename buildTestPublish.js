'use strict';
const runProcess = require('./lib/runProcess');

const setScope = require('./lib/setScope');
const HyperOneApi = require('hyper_one_api');
const defaultClient = HyperOneApi.ApiClient.instance;
setScope(defaultClient, process.env);

defaultClient.defaultHeaders = {
    'Prefer':`respond-async,wait=${60 * 60 * 24}`
};
defaultClient.timeout = 4 * 60 * 1000;

const imageApi = new HyperOneApi.ImageApi();
const vmApi = new HyperOneApi.VmApi();
const diskApi = new HyperOneApi.DiskApi();

const scopeActive = (process.env.SCOPE || 'h1').toLowerCase();

const olderThan = (resource, ageInMinutes) => new Date(resource.createdOn) < (new Date() - ageInMinutes * 60 * 1000);
const ensureState = (resource, states) => states.includes(resource.state);

const config = {
    rbx: {
        ssh: 'builder-ssh',
        netadp_service: '5899b0f8d44c81202ab51308',
        vm_test_service: 'light',
        vm_builder_service: 'medium',
    },
    h1: {
        ssh: 'builder-ssh',
        netadp_service: '561e7e30a8cfd461e469ad18',
        vm_test_service: 'a1.nano',
        vm_builder_service: 'a1.small'
    }
};

const configActive = config[scopeActive];

const buildImage = async (template_file) => {
    const output = await runProcess('packer', [
        'build',
        '-machine-readable',
        '-var', `ssh_name=${configActive.ssh}`,
        `-var`, `public_netadp_service=${configActive.netadp_service}`,
        '-var', `vm_type=${configActive.vm_builder_service}`,
        template_file
    ], {
        HYPERONE_TOKEN: defaultClient.authentications.ServiceAccount.apiKey,
        HYPERONE_API_URL: defaultClient.basePath
    });
    const match = output.match(/hyperone,artifact,0,id,(.+?)$/m);
    if (!match) {
        throw "Unable to identify image id from Packer";
    }
    return match[1];
};

const testImage = (imageId) => runProcess('./run_tests.sh', [
    '-i', imageId,
    '-s', scopeActive,
    '-v', configActive.vm_test_service,
    '-c', configActive.ssh
], {
    H1_TOKEN: defaultClient.authentications.ServiceAccount.apiKey,
});

const publishImage = (imageId) => {
    console.log(`Publishing image ${imageId}.`);
    return imageApi.imagePostAccessrights(imageId, HyperOneApi.ImagePostAccessrights.constructFromObject({identity: '*'}));
};

const cleanupImage = async () => {
    console.log("Fetching available images");
    const images = await imageApi.imageList();
    console.log(`Found ${images.length} images`);
    const image = images.find(image => olderThan(image, 3 * 24 * 60) && !image.name.includes('image-builder') && ensureState(image, ['Online']));
    if(image){
        await imageApi.imageDelete(image._id);
        await cleanupImage();
    }
};

const cleanupVm = async () => {
    console.log("Fetching available VMs");
    const vms = await vmApi.vmList();
    console.log(`Found ${vms.length} VMs`);
    const vm = vms.find(vm => olderThan(vm, 90) && ensureState(vm, ['Running']) && vm.name.includes('windows'));
    if(vm){
        console.log(`Deleting VM ${vm._id}`);
        await vmApi.vmActionTurnoff(vm._id);
        await vmApi.vmDelete(vm._id, new HyperOneApi.VmDelete());
        await cleanupVm();
    }
};

const cleanupDisk = async () => {
    console.log("Fetching available disks.");
    const disks = await diskApi.diskList();
    console.log(`Found ${disks.length} disks`);
    const disk = disks.find(disk => ensureState(disk, ['Detached']));
    if(disk){
        console.log(`Deleting disk ${disk._id}`);
        await diskApi.diskDelete(disk._id);
        await cleanupDisk();
    }
};

const main = async (template_file) => {
    try {
        const imageId = await buildImage(template_file);
        await testImage(imageId);
        await publishImage(imageId);
    } finally {
        await cleanupImage();
        await cleanupVm();
        await cleanupDisk();
    }
};

main(process.argv[2]).then(console.log).catch(err => {
    console.error(err);
    process.exit(1);
});
