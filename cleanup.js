'use strict';
const {
    imageApi, vmApi, diskApi, ipApi, safeDeleteFail, ensureState,
} = require('./lib/api');
const olderThan = (resource, ageInMinutes) => new Date(resource.createdOn) < new Date() - ageInMinutes * 60 * 1000;

const ensureTag = (resource, tag) => tag in resource.tag;

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

const main = async () => {
    await cleanupImage(); // clean up all images
    await cleanupVm(); // delete VM first to make disk and ip free
    await cleanupDisk(); // delete detached disks
    await cleanupIp(); // delete detached IP address
};

main().catch(err => {
    console.log(err);
    process.exit(-1);
});
