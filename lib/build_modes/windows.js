const {vmApi, createPrivateIp, ipApi, token, waitState} = require('./../api');
const {getIp} = require('./../ip');
const delay = require('./../delay');
const runProcess = require('./../runProcess');

const buildWindowsImage = async (imageConfig, platformConfig) => {
    // create VM with disks and attach iso
    // wait in loop until it is shutdown
    const vm = await vmApi.vmCreate({
        name: `build-iso-${imageConfig.name}`,
        iso: imageConfig.iso,
        image: imageConfig.base_image,
        netadp: [{
            network: platformConfig.network,
            service: platformConfig.netadp_service
        }],
        password: 'not_used_anyway',
        disk: [{
            size: imageConfig.disk_size,
            service: imageConfig.disk_type || platformConfig.disk_type,
        }],
        service: imageConfig.vm_type || platformConfig.vm_builder_service,
    });
    try {
        await waitState(vm, ['Off']);
        const metadata = {
            arch: imageConfig.arch,
            distro: imageConfig.distro,
            release: imageConfig.release,
            edition: imageConfig.edition,
            codename: imageConfig.codename,
            recommended: {},
        };
        if (imageConfig.image_recommended_disk_size) {
            metadata.recommended.disk = {size: imageConfig.image_recommended_disk_size}
        }
        if (imageConfig.image_recommended_vm_type) {
            metadata.recommended.vm_service = {type: imageConfig.image_recommended_vm_type}
        }
        const image = await imageApi.imageCreate({
            vm: vm._id,
            name: imageConfig.pname,
            description: JSON.stringify(metadata),
            tags: metadata
        });
        return image._id;
    } finally {
        await vmApi.vmDelete(vm._id, {});
    }
};

const testWindowsImage = async (imageConfig, platformConfig, imageId) => {
    const user = 'Administrator';
    const external_ip = await ipApi.ipCreate({});
    const internal_ip = await createPrivateIp(platformConfig.network);
    try {
        const ip = await getIp();
        const cmd = [
            `winrm set winrm/config/service/auth '@{Basic="true"}';`,
            `New-NetFirewallRule -DisplayName "WinRM-HTTP" -Direction Inbound -LocalPort 5985 -Protocol TCP -Action Allow -RemoteAddress ${ip}/32;`,
            `New-NetFirewallRule -DisplayName "WinRM-HTTPS" -Direction Inbound -LocalPort 5986 -Protocol TCP -Action Allow -RemoteAddress ${ip}/32;`,
            `New-NetFirewallRule -DisplayName "Allow inbound ICMPv4" -Direction Inbound -Protocol ICMPv4 -IcmpType 8 -RemoteAddress ${ip}/32 -Action Allow;`,
        ];
        const vmCreate = {
            name: `test-image-${imageConfig.name}`,
            image: imageId,
            ip: internal_ip._id,
            netadp: [{
                ip: internal_ip._id,
                service: platformConfig.netadp_service
            }],
            password: 'not_used_anyway',
            disk: [{
                size: platformConfig.disk_size || imageConfig.disk_size || 10,
                service: platformConfig.disk_type || platformConfig.disk_type,
            }],
            service: platformConfig.vm_builder_service,
            userMetadata: Buffer.from(cmd.join("\n")).toString('base64')
        };
        const vm = await vmApi.vmCreate(vmCreate);
        console.log(`VM ${vm._id} created`);
        try {
            await delay(150 * 1000);
            const new_pass = await runProcess(platformConfig, [
                'vm', 'passwordreset',
                '--user', user,
                '--vm', vm._id,
                '--output', 'tsv'
            ], {
                stderr: false,
                env: {
                    H1_TOKEN: token,
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

module.exports = {
    build: buildWindowsImage,
    test: testWindowsImage,
};
