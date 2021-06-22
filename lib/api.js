'use strict';
const HyperOneApi = require('hyper_one_api');
const setScope = require('./setScope');
const superagent = require('superagent');
const delay = require('./delay');
const defaultClient = HyperOneApi.ApiClient.instance;
setScope(defaultClient, process.env);

defaultClient.defaultHeaders = {
    Prefer: `respond-async,wait=${60 * 60 * 24}`,
};
defaultClient.timeout = 10 * 60 * 1000;

const vmApi = new HyperOneApi.VmApi();
const imageApi = new HyperOneApi.ImageApi();
const diskApi = new HyperOneApi.DiskApi();
const ipApi = new HyperOneApi.IpApi();

const token = defaultClient.authentications.ServiceAccount.apiKey;
const url = defaultClient.basePath;

const createPrivateIp = (networkId) => {
    // Workaround for https://github.com/hyperonecom/h1-client-js/issues/1
    return superagent
        .post(`${defaultClient.basePath}/network/${networkId}/ip`)
        .set('x-auth-token', defaultClient.authentications.ServiceAccount.apiKey)
        .then(resp => resp.body);
};

const fetchImage = (imageId) => {
    return superagent
        .get(`${defaultClient.basePath}/image/${imageId}`)
        .set('x-auth-token', defaultClient.authentications.ServiceAccount.apiKey)
        .then(resp => resp.body);
};

const listRecommendedImage = () => {
    return superagent
        .get(`${defaultClient.basePath}/image/recommended`)
        .set('x-auth-token', defaultClient.authentications.ServiceAccount.apiKey)
        .then(resp => resp.body);
};



const ensureState = (resource, states) => states.includes(resource.state);

const waitState = async (vm, states) => {
    if (ensureState(vm, states)) {
        return vm;
    }
    console.log(`Waiting. The Virtual Machine '${vm._id}' status is '${vm.state}'.`);
    await delay(60 * 1000);
    const fresh_vm = await vmApi.vmShow(vm._id).catch(async err => {
        console.log('Error in checking state of VM', err);
        await delay(120 * 1000);
        return vmApi.vmShow(vm._id);
    });
    return waitState(fresh_vm, states);
};

const safeDeleteFail = async err => {
    // ignore if already deleted
    if (
        err.status == 404 ||
        err.response && err.response.res && err.response.res.text && (err.response.res.text.includes('not found') || err.response.res.text.includes('rocessing'))
    ) {
        console.log('Safe fail operation of delete:', err);
        return;
    }
    await delay();
    throw err;
};

module.exports = {
    imageApi,
    vmApi,
    diskApi,
    ipApi,
    createPrivateIp,
    fetchImage,
    token,
    waitState,
    ensureState,
    url,
    safeDeleteFail,
    listRecommendedImage,
};
