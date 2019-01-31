const HyperOneApi = require('hyper_one_api');
const defaultClient = HyperOneApi.ApiClient.instance;
const ServiceAccount = defaultClient.authentications['ServiceAccount'];
ServiceAccount.apiKey = process.env.H1_TOKEN;
const apiInstance = new HyperOneApi.ImageApi();

const published = image => image.accessRights.includes("*");
const old = image => new Date(image.createdOn) < (new Date() - 2 * 24 * 60 * 60 * 1000);

const main = async () => {
    const images = await apiInstance.imageList();
    for (const image of images.filter(image => published(image) && old(image))) {
        await apiInstance.imageDelete(image._id);
    }
};

main().then(console.log).catch(console.error);

