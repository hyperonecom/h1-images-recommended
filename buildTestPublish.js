'use strict';
const runProcess = require('./lib/runProcess');
const superagent = require('superagent');
const setScope = require('./lib/setScope');
const {getIp} = require('./lib/ip');
const HyperOneApi = require('hyper_one_api');
const defaultClient = HyperOneApi.ApiClient.instance;
setScope(defaultClient, process.env);
const yaml = require('js-yaml');
const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);

defaultClient.defaultHeaders = {
    'Prefer': `respond-async,wait=${60 * 60 * 24}`
};
defaultClient.timeout = 10 * 60 * 1000;


const imageApi = new HyperOneApi.ImageApi();
const vmApi = new HyperOneApi.VmApi();
const diskApi = new HyperOneApi.DiskApi();
const networkApi = new HyperOneApi.NetworkApi();
const ipApi = new HyperOneApi.IpApi();

const scopeActive = (process.env.SCOPE || 'h1').toLowerCase();

const olderThan = (resource, ageInMinutes) => new Date(resource.createdOn) < (new Date() - ageInMinutes * 60 * 1000);
const ensureState = (resource, states) => states.includes(resource.state);

const config = {
    rbx: {
        ssh: 'builder-ssh',
        netadp_service: '5899b0f8d44c81202ab51308',
        vm_test_service: 'light',
        vm_builder_service: 'medium',
        disk_type: 'ssd'
    },
    h1: {
        ssh: 'builder-ssh',
        netadp_service: '561e7e30a8cfd461e469ad18',
        vm_test_service: 'a1.nano',
        vm_builder_service: 'a1.small',
        network: 'builder-private-network',
        disk_type: 'ssd'
    }
};

const configActive = config[scopeActive];

const createPrivateIp = (networkId) => {
    // Workaround for https://github.com/hyperonecom/h1-client-js/issues/1
    return superagent
        .post(`${defaultClient.basePath}/network/${networkId}/ip`)
        .set('x-auth-token', defaultClient.authentications['ServiceAccount'].apiKey)
        .then(resp => resp.body);
};

const buildPackerImage = async ({template_file}) => {
    const packer_var = [
        '-var', `ssh_name=${configActive.ssh}`,
        `-var`, `public_netadp_service=${configActive.netadp_service}`,
        '-var', `vm_type=${configActive.vm_builder_service}`,
    ];
    const packer_env = {
        HYPERONE_TOKEN: defaultClient.authentications.ServiceAccount.apiKey,
        HYPERONE_API_URL: defaultClient.basePath
    };
    await runProcess('packer', [
        'validate',
        ...packer_var,
        template_file
    ], {env: packer_env});
    const output = await runProcess('packer', [
        'build',
        '-machine-readable',
        ...packer_var,
        template_file
    ], {env: packer_env});
    const match = output.match(/hyperone,artifact,0,id,(.+?)$/m);
    if (!match) {
        throw "Unable to identify image id from Packer";
    }
    return match[1];
};

const delay = (time) => new Promise(resolve => {
    console.log(`Delay ${time / 1000} seconds`);
    return setTimeout(resolve, time)
});

const waitState = async (vm, states) => {
    if (ensureState(vm, states)) {
        return vm
    }
    console.log(`Waiting. The Virtual Machine status is ${vm.state}.`);
    const fresh_vm = await vmApi.vmShow(vm._id);
    await delay(60 * 1000);
    return waitState(fresh_vm, states)
};

const buildWindowsImage = async (config) => {
    // create VM with disks and attach iso
    // wait in loop until it is shutdown
    const vm = await vmApi.vmCreate({
        name: `build-iso-${config.name}`,
        iso: config.iso,
        // image: config.base_image,
        netadp: [{
            network: configActive.network,
            service: configActive.netadp_service
        }],
        password: 'not_used_anyway',
        disk: [
            {
                size: config.disk_size,
                service: config.disk_type || configActive.disk_type,
            }
        ],
        service: configActive.vm_builder_service,
    });
    try {
        await waitState(vm, ['Off']);
        const metadata = {
            arch: config.arch,
            distro: config.distro,
            release: config.release,
            edition: config.edition,
            codename: config.codename,
            recommended: {},
        };
        if (config.image_recommended_disk_size) {
            metadata.recommended.disk = {size: config.image_recommended_disk_size}
        }
        if (config.image_recommended_vm_type) {
            metadata.recommended.vm_service = {type: config.image_recommended_vm_type}
        }
        const image = await imageApi.imageCreate({
            vm: vm._id,
            name: config.name,
            description: JSON.stringify(metadata),
            tags: metadata
        });
        return image._id;
    } finally {
        await vmApi.vmDelete(vm._id, {});
    }
};

const testPackerImage = (config, imageId) => runProcess('./run_tests.sh', [
    '-i', imageId,
    '-s', scopeActive,
    '-o', config.mode,
    '-v', configActive.vm_test_service,
    '-c', configActive.ssh
], {
    env: {
        H1_TOKEN: defaultClient.authentications.ServiceAccount.apiKey,
    }
});

const testWindowsImage = async (config, imageId) => {
    const user = 'Administrator';
    const external_ip = await ipApi.ipCreate({});
    const internal_ip = await createPrivateIp(configActive.network);
    try {
        const ip = await getIp();
        const cmd = [
            `winrm set winrm/config/service/auth '@{Basic="true"}';`,
            `New-NetFirewallRule -DisplayName "WinRM-HTTP" -Direction Inbound -LocalPort 5985 -Protocol TCP -Action Allow -RemoteAddress ${ip}/32;`,
            `New-NetFirewallRule -DisplayName "WinRM-HTTPS" -Direction Inbound -LocalPort 5986 -Protocol TCP -Action Allow -RemoteAddress ${ip}/32;`,
            `New-NetFirewallRule -DisplayName "Allow inbound ICMPv4" -Direction Inbound -Protocol ICMPv4 -IcmpType 8 -RemoteAddress ${ip}/32 -Action Allow;`,
        ];
        const vmCreate = {
            name: `test-image-${config.name}`,
            image: imageId,
            ip: internal_ip._id,
            netadp: [{
                ip: internal_ip._id,
                service: configActive.netadp_service
            }],
            password: 'not_used_anyway',
            disk: [{
                size: config.disk_size || 10,
                service: config.disk_type || configActive.disk_type,
            }],
            service: configActive.vm_builder_service,
            userMetadata: Buffer.from(cmd.join("\n")).toString('base64')
        };
        const vm = await vmApi.vmCreate(vmCreate);
        console.log(`VM ${vm._id} created`);
        try {
            await delay(150 * 1000);
            console.log(`Delay finished`);
            const new_pass = await runProcess(scopeActive, [
                'vm', 'passwordreset',
                '--user', user,
                '--vm', vm._id,
                '--output', 'tsv'
            ], {
                // quiet: true,
                stderr: false,
                env: {
                    H1_TOKEN: defaultClient.authentications.ServiceAccount.apiKey,
                }
            });
            if (!new_pass) {
                throw new Error(`Unable to achieve password for VM: ${vm._id}`)
            }
            console.log(`Password reset done.`);
            await ipApi.ipActionAssociate(external_ip._id, {
                ip: internal_ip._id
            });
            console.log(`FIP created.`);
            await delay(10 * 1000);
            await runProcess('pwsh', [
                "tests/tests.ps1",
                "-IP", external_ip.address,
                "-Hostname", vm.name,
                "-User", user,
                "-Pass", new_pass.trim()
            ]);
        } finally {
            await vmApi.vmDelete(vm._id, {});
        }
    } finally {
        await ipApi.ipActionDisassociate(external_ip._id).catch(() => {
        });
        console.log(`IP disassociated: ${external_ip._id}`);
        // await delay(1 * 1000);
        await ipApi.ipDelete(external_ip._id);
        console.log(`External IP deleted`);
        // await delay(3 * 1000);
        await ipApi.ipDelete(internal_ip._id);
        console.log(`Internal IP deleted`);
    }
};

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
    const vm = vms.find(vm => olderThan(vm, 90) && ensureState(vm, ['Running']));
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

const buildImage = (mode, config) => {
    if (mode === 'windows') {
        return buildWindowsImage(config)
    } else if (mode === 'packer') {
        return buildPackerImage(config)
    } else {
        throw new Error("Unknown mode of image")
    }
};

const testImage = (mode, config, imageId) => {
    if (mode === 'windows') {
        return testWindowsImage(config, imageId)
    } else if (mode === 'packer') {
        return testPackerImage(config, imageId)
    } else {
        throw new Error("Unknown mode of test of image")
    }
};
const main = async (mode, input_file) => {
    try {
        const content = await readFile(input_file);
        const config = yaml.safeLoad(content);
        config.template_file = config.template_file || input_file.replace('config', 'templates').replace('.yaml','.json');
        const imageId = await buildImage(mode, config);
        await testImage(mode, config, imageId);
        await publishImage(imageId, config.image_tenant_access || '*');
    } finally {
        await cleanupImage();
        await cleanupVm();
        await cleanupDisk();
    }
};

main(process.argv[2], process.argv[3]).then(console.log).catch(err => {
    console.error(err);
    process.exit(1);
});
