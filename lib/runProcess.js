'use strict';
const {spawn} = require('child_process');

module.exports = (cmd, args = [], opts = {}) => new Promise((resolve, reject) => {
    const env = opts.env || {};
    const catch_stderr = opts.stderr === undefined ? true : opts.stderr;
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
        process.stdout.write(`${cmd}:STDOUT:${data}`);
        output += data;
    });
    if (catch_stderr) {
        proc.stderr.on('data', (data) => {
            process.stdout.write(`${cmd}:STDERR:${data}`);
            output += data;
        });
    }
});