'use strict';
const runProcess = require('./lib/runProcess');

const setScope = require('./lib/setScope');
const HyperOneApi = require('hyper_one_api');
const defaultClient = HyperOneApi.ApiClient.instance;
setScope(defaultClient, process.env);
const apiInstance = new HyperOneApi.ImageApi();

const scopeActive = (process.env.SCOPE || 'h1').toLowerCase();

const config = {
    rbx: {
        ssh: 'builder-ssh',
        netadp_service: '5899b0f8d44c81202ab51308',
        vm_test_service: 'a1.nano',
        vm_builder_service: 'a1.medium',
    },
    h1: {
        ssh: 'builder-ssh',
        netadp_service: '561e7e30a8cfd461e469ad18',
        vm_test_service: 'a1.nano',
        vm_builder_service: 'rbx'
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

const publishImage = (imageId) => apiInstance.imagePostAccessrights(imageId, HyperOneApi.ImagePostAccessrights.constructFromObject({identity: '*'}));

const main = async (template_file) => {
    console.log({template_file});
    const imageId = await buildImage(template_file);
    await testImage(imageId);
    await publishImage(imageId);
};

main(process.argv[2]).then(console.log).catch(console.error);
