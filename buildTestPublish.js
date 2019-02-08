'use strict';
const { spawn } = require('child_process');
const HyperOneApi = require('hyper_one_api');
const defaultClient = HyperOneApi.ApiClient.instance;
const ServiceAccount = defaultClient.authentications['ServiceAccount'];
ServiceAccount.apiKey = process.env.H1_TOKEN;
const apiInstance = new HyperOneApi.ImageApi();

const sshKey = 'builder-ssh';

const runProcess = async (cmd, args=[], env = {}) => new Promise((resolve, reject) => {
    console.log(`Run ${cmd} ${args.join(' ')}`);

    const proc = spawn(cmd, args, {
        env: Object.assign({}, process.env, env),
        stdio: [null, 'pipe', 'pipe'],
    });
    let output = '';

    proc.on('close', (code) => {
        if (code !== 0) {
            const error = new Error(`Process exited with code ${code}`);
            error.code = code;
            error.output = output;
            return reject(error);
        }
        return resolve(output);
    });

    proc.stdout.on('data', (data) => {
        process.stdout.write(`${cmd}:${data}`);
        output += data;
    });

    proc.stderr.on('data', (data) => {
        process.stdout.write(`${cmd}:${data}`);
        output += data;
    });
});


const buildImage = async (template_file) => {
    const output = await runProcess('packer', ['build', '-machine-readable', '-var',`ssh_name=${sshKey}`, template_file], {
        HYPERONE_TOKEN: process.env.H1_TOKEN
    });
    const match = output.match(/hyperone,artifact,0,id,(.+?)$/m);
    if (!match) {
        throw "Unable to identify image id from Packer";
    }
    return match[1];
};

const testImage = (imageId) => runProcess('./run_tests.sh', ['-s', 'h1', '-i', imageId, '-v', 'a1.nano', '-c', sshKey], {
    H1_TOKEN: process.env.H1_TOKEN
});

const publishImage = async (imageId) => apiInstance.imagePostAccessrights(imageId, HyperOneApi.ImagePostAccessrights.constructFromObject({identity: '*'}));

const main = async (template_file) => {
    console.log({template_file});
    const imageId = await buildImage(template_file);
    await testImage(imageId);
    await publishImage(imageId);
};

main(process.argv[2]).then(console.log).catch(console.error);
