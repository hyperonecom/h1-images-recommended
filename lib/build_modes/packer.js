'use strict';
const { token, url } = require('./../api');
const runProcess = require('./../runProcess');

const getConfig = (name, imageConfig, platformConfig, scope) => {
    if (name in imageConfig) {
        if (typeof imageConfig[name] == 'object' && scope in imageConfig[name]) {
            return imageConfig[name][scope];
        }
        return imageConfig[name];
    }
    if (typeof platformConfig[name] == 'object' && scope in platformConfig[name]) {
        return platformConfig[name][scope];
    }
    return platformConfig[name];
};

const buildPackerImage = async (imageConfig, platformConfig, scope) => {
    const { template_file } = imageConfig;
    const getter = (name) => getConfig(name, imageConfig, platformConfig, scope);
    const packer_var = [
        '-var', `ssh_name=${getter('ssh')}`,
        '-var', `public_netadp_service=${getter('netadp_service')}`,
        '-var', `disk_size=${getter('disk_size')}`,
        '-var', `vm_type=${getter('vm_builder_service')}`,
        '-var', `repository=${getter('repository')}`,
        '-var', `cli_package=${getter('cli_package')}`,
        '-var', `scope_name=${getter('scope_name')}`,
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

const testPackerImage = async (imageConfig, platformConfig, imageId, scope) => {
    const getter = (name) => getConfig(name, imageConfig, platformConfig, scope);

    const opts = {
        env: {
            HYPERONE_ACCESS_TOKEN_SECRET: token,
            ROOTBOX_ACCESS_TOKEN_SECRET: token,
            CONFIG_DISTRO: getter('distro').toUpperCase(),
            CONFIG_NAME: getter('name'),
        },
    };

    const args = [
        '-o', 'packer',
        '-i', imageId,
        '-s', getter('scope'),
        '-v', getter('vm_gen1_test_service'),
        '-c', getter('ssh'),
        '-d', getter('test_disk_size') || 10,
    ];

    if (getter('test_disk_size')) {
        args.push('-d', getter('test_disk_size'));
    }

    console.log('Testing on Gen 1');
    await runProcess('./run_tests.sh', args, opts);

    if (getter('uefi_support') && getter('vm_gen2_test_service')) {
        const args = [
            '-o', 'packer',
            '-i', imageId,
            '-s', getter('scope'),
            '-v', getter('vm_gen2_test_service'),
            '-c', getter('ssh'),

        ];
        if (getter('test_disk_size')) {
            args.push('-d', getter('test_disk_size'));
        }
        console.log('Testing on Gen 2');
        await runProcess('./run_tests.sh', args, opts);
    }
};

module.exports = {
    build: buildPackerImage,
    test: testPackerImage,
};
