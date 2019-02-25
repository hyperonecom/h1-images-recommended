'use strict';
const runProcess = require('./lib/runProcess');

const setScope = require('./lib/setScope');
const HyperOneApi = require('hyper_one_api');
const defaultClient = HyperOneApi.ApiClient.instance;
setScope(defaultClient, process.env);

defaultClient.defaultHeaders = {
    'Prefer':`respond-async,wait=${60 * 60 * 24}`
};

const imageApi = new HyperOneApi.ImageApi();
const vmApi = new HyperOneApi.VmApi();
const diskApi = new HyperOneApi.DiskApi();

const scopeActive = (process.env.SCOPE || 'h1').toLowerCase();

const olderThan = (resource, ageInMinutes) => new Date(resource.createdOn) < (new Date() - ageInMinutes * 60 * 1000);
const state = states => resource => states.includes(resource.state);

const config = {
    rbx: {
        ssh: 'builder-ssh',
        netadp_service: '5899b0f8d44c81202ab51308',
        vm_test_service: 'light',
        vm_builder_service: 'small',
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

const publishImage = (imageId) => imageApi.imagePostAccessrights(imageId, HyperOneApi.ImagePostAccessrights.constructFromObject({identity: '*'}));

const cleanupImage = async () => {
    const images = await imageApi.imageList();
    for (const image of images.filter(image => olderThan(image, 3 * 24 * 60)) && image.name.includes('image-builder')) {
        await imageApi.imageDelete(image._id);
    }
};

const cleanupVm = async () => {
    const vms = await vmApi.vmList();
    for (const vm of vms.filter(vm => olderThan(vm, 90))) {
        await vmApi.vmDelete(vm._id, new HyperOneApi.VmDelete());
    }
};

const cleanupDisk = async () => {
    const disks = await diskApi.diskList();
    for (const vm of disks.filter(state(['Detached']))) {
        await diskApi.diskDelete(vm._id);
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
