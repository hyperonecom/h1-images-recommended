'use strict';
const HyperOneApi = require('hyper_one_api');
const setScope = require('./setScope');
const superagent = require('superagent');

const defaultClient = HyperOneApi.ApiClient.instance;
setScope(defaultClient, process.env);
defaultClient.defaultHeaders = {
    'Prefer': `respond-async,wait=${60 * 60 * 24}`
};
defaultClient.timeout = 10 * 60 * 1000;

const token = defaultClient.authentications.ServiceAccount.apiKey;
const url = defaultClient.basePath;

const createPrivateIp = (networkId) => {
    // Workaround for https://github.com/hyperonecom/h1-client-js/issues/1
    return superagent
        .post(`${defaultClient.basePath}/network/${networkId}/ip`)
        .set('x-auth-token', defaultClient.authentications['ServiceAccount'].apiKey)
        .then(resp => resp.body);
};
const ensureState = (resource, states) => states.includes(resource.state);

const waitState = async (vm, states) => {
    if (ensureState(vm, states)) {
        return vm
    }
    console.log(`Waiting. The Virtual Machine status is ${vm.state}.`);
    const fresh_vm = await vmApi.vmShow(vm._id).catch(async () => {
        await delay(120 * 1000);
        await vmApi.vmShow(vm._id)
    });
    await delay(60 * 1000);
    return waitState(fresh_vm, states)
};

module.exports = {
    imageApi: new HyperOneApi.ImageApi(),
    vmApi: new HyperOneApi.VmApi(),
    diskApi: new HyperOneApi.DiskApi(),
    ipApi: new HyperOneApi.IpApi(),
    createPrivateIp,
    token,
    waitState,
    ensureState
};
