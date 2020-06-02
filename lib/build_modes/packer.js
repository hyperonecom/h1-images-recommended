'use strict';
const { token, url } = require('./../api');
const runProcess = require('./../runProcess');

const buildPackerImage = async (imageConfig, platformConfig) => {
    const { template_file } = imageConfig;
    console.log(imageConfig);
    console.log(platformConfig);
    const packer_var = [
        '-var', `ssh_name=${platformConfig.ssh}`,
        '-var', `public_netadp_service=${platformConfig.netadp_service}`,
        '-var', `disk_size=${imageConfig.disk_size || platformConfig.disk_size}`,
        '-var', `vm_type=${imageConfig.vm_builder_service || platformConfig.vm_builder_service}`,
        '-var', `repository=${platformConfig.repository}`,
        '-var', `cli_package=${platformConfig.cli_package}`,
        '-var', `scope_name=${platformConfig.scope_name}`,
    ];
    const packer_env = {
        HYPERONE_TOKEN: token,
        HYPERONE_API_URL: url,
    };
    const packer_argv = [
        'validate',
        ...packer_var,
        template_file,
    ];
    console.log(`Packer CMD: packer ${packer_argv.join(' ')}`);
    await runProcess('packer', packer_argv, { env: packer_env });
    const args = [
        'build',
        '-machine-readable',
        ...packer_var,
        template_file,
    ];
    const output = await runProcess('packer', args, { env: packer_env });
    const match = output.match(/hyperone,artifact,0,id,(.+?)$/m);
    if (!match) {
        throw 'Unable to identify image id from Packer';
    }
    return match[1];
};

const testPackerImage = async (imageConfig, platformConfig, imageId) => {
    const opts = {
        env: {
            HYPERONE_ACCESS_TOKEN_SECRET: token,
            ROOTBOX_ACCESS_TOKEN_SECRET: token,
        },
    };

    const args = [
        '-o', 'packer',
        '-i', imageId,
        '-s', platformConfig.scope,
        '-v', platformConfig.vm_gen1_test_service,
        '-c', platformConfig.ssh,
    ];
    const tasks = [];
    console.log('Tessting on Gen 1');
    await runProcess('./run_tests.sh', args, opts);

    if (imageConfig.uefi_support === '1' && platformConfig.vm_gen2_test_service) {
        const args = [
            '-o', 'packer',
            '-i', imageId,
            '-s', platformConfig.scope,
            '-v', platformConfig.vm_gen2_test_service,
            '-c', platformConfig.ssh,
        ];
        console.log('Tessting on Gen 2');
        await runProcess('./run_tests.sh', args, opts);
    }
    await Promise.all(tasks);
};

module.exports = {
    build: buildPackerImage,
    test: testPackerImage,
};
