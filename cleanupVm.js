const scope = require('./lib/setScope');
const HyperOneApi = require('hyper_one_api');
scope(HyperOneApi.ApiClient.instance, process.env);
const apiInstance = new HyperOneApi.VmApi();

// TravisCI has a 50-minute limit on the entire build.
// Therefore, it is safe to assume that Virtual Machines
// older than 90 minutes are unnecessary.
const old = image => new Date(image.createdOn) < (new Date() - 90 * 60 * 1000);

const main = async () => {
    const vms = await apiInstance.vmList();
    for (const vm of vms.filter(image => old(image))) {
        await apiInstance.vmDelete(vm._id, new HyperOneApi.VmDelete());
    }
};

main().then(console.log).catch(err => {
    console.error(err);
    process.exit(1);
});