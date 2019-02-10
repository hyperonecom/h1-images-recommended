'use strict';
const {spawn} = require('child_process');

module.exports = (cmd, args = [], env = {}) => new Promise((resolve, reject) => {
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