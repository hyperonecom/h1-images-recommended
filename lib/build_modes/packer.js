const {token, url} = require('./../api');
const runProcess = require('./../runProcess');

const buildPackerImage = async (imageConfig, platformConfig) => {
    const {template_file} = imageConfig;
    const packer_var = [
        '-var', `ssh_name=${platformConfig.ssh}`,
        `-var`, `public_netadp_service=${platformConfig.netadp_service}`,
        `-var`, `disk_size=${imageConfig.disk_size || platformConfig.disk_size}`,
        '-var', `vm_type=${platformConfig.vm_builder_service}`,
    ];
    const packer_env = {
        HYPERONE_TOKEN: token,
        HYPERONE_API_URL: url
    };
    await runProcess('packer', [
        'validate',
        ...packer_var,
        template_file
    ], {env: packer_env});
    const args = [
        'build',
        '-machine-readable',
        ...packer_var,
        template_file
    ];
    const output = await runProcess('packer', args, {env: packer_env});
    const match = output.match(/hyperone,artifact,0,id,(.+?)$/m);
    if (!match) {
        throw "Unable to identify image id from Packer";
    }
    return match[1];
};

const testPackerImage = (imageConfig, platformConfig, imageId) => {
    const args = [
        '-o', 'packer',
        '-i', imageId,
        '-s', platformConfig.scope,
        '-v', platformConfig.vm_test_service,
        '-c', platformConfig.ssh
    ];

    return runProcess('./run_tests.sh', args, {
        env: {
            H1_TOKEN: token,
        }
    });
}

module.exports = {
    build: buildPackerImage,
    test: testPackerImage,
}